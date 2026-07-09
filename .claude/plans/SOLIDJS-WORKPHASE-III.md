# SOLIDJS-WORKPHASE-III — Edit path (Qwik → SolidJS migration, Phase III)

## Context

Branch `MIGRATE-whole-app-move-to-SolidJS`, meta-plan `SOLIDJS-MIGRATION.md`. Phases I–II done: the app boots, navigates, and displays everything read-only; every field renders through `ConfigFieldStubRenderer`; the edit FSM seams (`getDataFieldState`, `startFieldEdit`/`stopFieldEdit`, chevron→`toggleFieldDetailsExpanded`) are live but mount nothing.

**Phase III scope (meta-plan §6):** the DataField dispatcher's edit wiring + the five real field renderers; the field-edit lifecycle (double-tap, focus, click-away); details/history/revert; delete + undo. Create/author surfaces (composer, construction, config forms, lens create) stay Phase IV — the renderers' `pendingMode` code paths land **dark** (no consumer until Phase IV).

**Files to port (the 10 in Phase III's ratchet slice):** `src/hooks/{useFieldEdit,useFocusManager,useEditableValue}.ts`; `src/components/DataField/{TextKvField,EnumKvField,NumberKvField,SingleImageField,AssetDocField}.tsx`; `src/components/DataFieldDetails/DataFieldDetails.tsx`; `src/components/DataFieldHistory/DataFieldHistory.tsx`. Plus wiring in already-Solid files: `DataField.tsx` (3 `TODO(Phase III)` seams), `TreeNodeDisplay.tsx` (Delete Asset TODO at line 80), `src/kinds/types.ts` (provisional `rootRef`), the five `*.manifest.ts` Renderer swaps, `eslint.config.mjs` re-include growth.

**Phase gate per commit:** `npm run lint` 0 errors, `npm run test` green (39 files / 419 tests). `npm run typecheck` bites from the first reachability commit (III-3) onward. Cypress still not a gate (specs create data via Phase IV surfaces). Feature freeze holds. Ratchet at start: 28 Qwik-importing files; at close: 18.

**Timing law (meta-plan §10, mandatory):** DELETE the Qwik-render workarounds — `useFocusManager` `FOCUS_DELAY_MS` (10ms), the `useFieldEdit` autoFocus `setTimeout(0)`, `EnumKvField`'s three `setTimeout(0)`s. KEEP the human/UI constants — `BLUR_SUPPRESS_WINDOW_MS` 220 (re-verify width by hand), double-tap 280ms/6px (already ported), SingleImageField 180ms flash.

## Strategy decisions

1. **`FieldRendererProps.rootRef` becomes a read accessor; DataField owns the row ref (own prep commit, III-1).** The Qwik dispatcher owned `rootRef = useSignal<HTMLElement>()` on its wrapper div (so outside-click containment covers chevron+label+value) and passed it down for *reads*; the provisional Solid `(el) => void` callback is write-only and can't serve that. New contract in `src/kinds/types.ts`: `rootRef: Accessor<HTMLElement | undefined>`. `DataField.tsx` gains `const [rootEl, setRootEl] = createSignal<HTMLElement>()`, `ref={setRootEl}` on the wrapper, passes `rootRef={rootEl}`. This touches the reachable graph (stub renderer ignores `rootRef`, so it stays green) — hence its own commit with typecheck. Phase IV ripple: `ComposerRow.tsx` (Qwik, unreachable) will own its own signal ref the same way when ported.

2. **`onUpdated` is deleted, not restored — it was dead plumbing pre-migration.** `git grep "onUpdated" 8b8bb50` shows *zero producers*: nothing ever passed `onUpdated$` into `DataField` or any renderer — it was optional-prop threading through 7 files with no caller. Bus-driven reload (`useElementChildren`) + `useFieldValueSync` cover every refresh path. Delete it from `FieldRendererProps`, don't add it to `useFieldEdit`, delete the `// TODO(Phase III): restore onUpdated` comment in `DataField.tsx`. No FieldList change needed.

3. **Solid `useFieldEdit` contract** (stays `.ts`, JSX-free):

   ```ts
   export type UseFieldEditOptions<T extends DataFieldValue> = {
       fieldId: string;              // mount-time constant — rows remount per field (<For> reference-keyed)
       initialValue: T | null;
       format: (value: T | null) => string;
       parse: (raw: string) => T | null;
       validate?: (value: T | null) => void;
       rootRef: Accessor<HTMLElement | undefined>;
       pendingMode?: { onChange: (value: T | null) => void | Promise<void>; autoFocus?: boolean };
   };
   export type UseFieldEditResult<T extends DataFieldValue> = {
       isEditing: Accessor<boolean>;          // memo over selectors.getDataFieldState === 'EDITING'
       displayValue: Accessor<string>;
       hasValue: Accessor<boolean>;
       editValue: Accessor<string>;           // no external writer existed; writes go via inputChange
       currentValue: Accessor<T | null>;
       setCurrentValue: (value: T | null) => void;   // ← renderers pass this to useFieldValueSync
       setEditInputRef: (el: HTMLInputElement | HTMLTextAreaElement) => void;  // JSX ref=
       beginEdit: () => void;
       save: () => Promise<void>;
       cancel: () => void;
       valuePointerDown: (ev: PointerEvent | MouseEvent) => void;
       valueKeyDown: (e: KeyboardEvent) => void;
       inputPointerDown: (ev: PointerEvent | MouseEvent) => void;
       inputBlur: () => void;
       inputKeyDown: (e: KeyboardEvent) => void;
       inputChange: (value: string) => void;
   };
   ```

   Behaviors 1:1 with the Qwik original (guards on `appState.editingElementId`, no-op save gate, pendingMode branch skipping command+snackbar, parse/validate → error snackbar, Enter→save / Escape→cancel, Enter/Space on display → beginEdit, double-tap display→edit / double-tap editing→cancel, `inputPointerDown` sets `suppressBlurUntil = now + BLUR_SUPPRESS_WINDOW_MS`, normal save → `commitWithUndo` `'Field updated'` UPDATE_ELEMENT_VALUE new/prev). `rootRef` is dropped from the *result* (no renderer read it back — they have it as a prop); `editInputRef` becomes a plain closure `let inputEl` + setter (nothing tracked it; the union type absorbs Qwik's textarea cast). Three deliberate deltas:
   - **beginEdit order swap**: seed `setEdit(format(current()))` *before* `startFieldEdit(fieldId)` — Solid mounts the input synchronously on the FSM write, so the buffer must hold the right text first.
   - **autoFocus mount task**: `onMount` with the same three guards, `setEdit(format(null))` + `startFieldEdit(fieldId)` — the `setTimeout(0)` is deleted (§10; the focus-manager effect fires on the FSM write), and the dead `.select?.()` is dropped (Qwik's focus-manager re-focus with cursor-at-end overrode it 10ms later anyway; cursor-at-end is the surviving behavior per the hand-test checklist).
   - **Outside-click (document pointerdown)**: attach `document.addEventListener('pointerdown', …)` **always-on at hook setup** with the first-line `editingElementId` guard — the exact `useOnDocument` shape — `onCleanup` removes. Ordering is safe: Solid's delegated component handlers run before our manually-added listener for the same event, so a double-tap that *begins* an edit sees the target inside `rootRef()` → no cancel; an outside pointerdown cancels mid-event, and the trailing blur either never fires (removed elements don't blur) or hits the guard. pendingMode inversion preserved: outside → `void save()` (COMMITS); normal → `stopFieldEdit()` + buffer reset.

   **Known-risk callout + ready fix (hand-test at III-3 decides):** the synchronous display→input swap during pointerdown means the browser's compatibility-mousedown focus action targets a removed element. If focus lands on body (input blurs instantly after double-tap), add `ev.preventDefault()` in `valuePointerDown` on the double-tap branch. Second escape hatch if delegation ordering misbehaves: native `on:pointerdown` on the JSX element (meta-plan §10).

4. **Solid `useFocusManager`**: `FOCUS_DELAY_MS`, the timeout id, and cleanup bookkeeping **deleted** (§10 — user effects run after render, so the input is mounted with `value` bound when `shouldFocus` flips). Keep + export `BLUR_SUPPRESS_WINDOW_MS = 220`.

   ```ts
   export function useFocusManager(
       inputEl: () => HTMLInputElement | HTMLTextAreaElement | undefined, // plain thunk over the closure ref
       shouldFocus: Accessor<boolean>,                                    // the tracked dependency
   ): { suppressBlurUntil: { value: number } } {
       const suppressBlurUntil = { value: 0 };
       createEffect(() => {
           if (!shouldFocus()) return;
           const input = inputEl();
           if (!input) return;
           const len = input.value.length;
           input.focus();
           input.setSelectionRange(len, len);   // cursor at end
       });
       return { suppressBlurUntil };
   }
   ```

   `suppressBlurUntil` is a **plain mutable box, deliberately not a signal** — nothing tracks it; handlers read/write `suppressBlurUntil.value` imperatively (call-site syntax stays byte-identical to the Qwik signal without pretending reactivity).

5. **Solid `useEditableValue`** (`.ts`, only consumer is `useFieldEdit`): `{ current: Accessor<T | null>; setCurrent; edit: Accessor<string>; setEdit; displayValue: Accessor<string>; hasValue: Accessor<boolean> }` — `displayValue`/`hasValue` become memos (Qwik recomputed per render). Implement `setCurrent = (v) => set(() => v)` so object values (`SingleImageValue`) never hit the function-overload of Solid setters.

6. **`useResource$` → `createResource`, no Suspense.** The three config-loading renderers use `createResource(() => props.definitionId, fetcher)` with an **error-catching fetcher** (never enters the throwing state — no ErrorBoundary), read via `<Show keyed>` with the exact Qwik `onPending` fallback markup. `createResource` gives latest-wins race handling; no `disposed` guard needed here. Keep the Wrapper/Body two-component split per file (the Body owns the `useFieldEdit` call so config is a mount-time constant it may capture — `makeValidate(config)` etc.):
   - **TextKvField**: fetcher returns `{}` for missing/wrong-kind def; `<Show when={config()} keyed fallback={<span class={styles.datafieldValue}>…</span>}>{(cfg) => <TextKvBody …config={cfg}/>}</Show>`.
   - **NumberKvField**: fetcher try/catches to `null`; outer `<Show when={!config.loading} fallback={… span}>` then `<Show when={config()} keyed fallback={— span}>` (matches onPending `…` / onRejected + resolved-null `—`).
   - **EnumKvField**: fetcher returns `{ options: [], allowOther: false }` on missing; pending renders *inside* the popover as the Qwik version did (`<div class={dropdownStyles.dropdownItem}>Loading…</div>`).

7. **EnumKvField port (the big self-contained one — it does NOT use `useFieldEdit`).** Signals: `isOpen`, `currentValue` (seeded from `props.value`, synced via `useFieldValueSync<string>(props.id, setter)`), `popoverPos`, `otherMode`, `otherText`; `triggerEl`/`popoverEl`/`otherInputEl` as plain callback-ref locals. `isEditing = () => selectors.getDataFieldState(appState, props.id) === 'EDITING'` drives `aria-expanded`; `open`/`close` call `startFieldEdit`/`stopFieldEdit` with the same guards. `positionPopover` keeps the viewport-clamp math verbatim. The three `setTimeout(0)`s collapse into effects (§10 deletions):
   1. `onMount` auto-open (pendingMode + autoFocus + `currentValue() === null`) → just `open()`; positioning/focus delegated to effect 2.
   2. Open-transition effect: `if (!isOpen()) return; options(); positionPopover(); if (popover doesn't contain document.activeElement) focusOption(0);` — **deliberate deviation, flagged**: also tracking the `options()` resource makes first-open focus deterministic (Qwik's `setTimeout(0)` raced the IDB config fetch and could miss); the activeElement guard prevents focus theft on re-runs.
   3. Other-mode effect: `if (!otherMode()) return; positionPopover(); otherInputEl?.focus();`

   Listeners always-on at setup with internal guards (1:1 with `useOnWindow`/`useOnDocument`), `onCleanup` removes: window `scroll`+`resize` → `if (isOpen()) positionPopover()`; document `pointerdown` → `if (!isOpen()) return` then dual containment (`props.rootRef()` row + `popoverEl`) → `close()`. Keyboard nav (`focusOption` modulo-clamp over `[role="option"]`, Arrow/Home/End, Escape→refocus trigger), `pick` (pendingMode branch, else `commitWithUndo` `'Field updated'` → on ok `setCurrent` + `close`), `startOther`/`commitOther` all carry 1:1 (minus the deleted `onUpdated` calls). All classes (incl. `dropdownStyles` from `../CreateDataField/CreateDataField.module.css` — a CSS import from a Qwik dir is ratchet-clean), aria strings, and visible text byte-identical.

8. **TextKv / NumberKv / SingleImage: mechanical `useFieldEdit` consumers.** Destructure the hook *result* (fine; never props), `ref={setEditInputRef}`, `value={editValue()}`, `onInput={(e) => inputChange(e.currentTarget.value)}`, pointerdown/blur/keydown wired, `class={[...]}` → `classList`. Keep the `autofocus` attribute for DOM parity (inert on dynamic insertion; the focus-manager does the real work). Each Body calls `useFieldValueSync<T>(props.id, setCurrentValue)`. NumberKv keeps affix/helper structure, `aria-describedby`, and `data-state` via `createMemo(() => computeNumberKvState(currentValue(), config, props.updatedAt ?? 0))` (`numberKvState.ts` is framework-free — untouched). SingleImage keeps the 180ms flash verbatim and the `emptyImage`/`CAPTION_MAX=50` helpers.

9. **AssetDocField**: plain function component typed directly on `FieldRendererProps` (as before, no manifest cast). `targetId` memo; the resolve `useVisibleTask$` becomes `createEffect` tracking `targetId()` with the Phase II `let disposed`/`onCleanup` guard around `await initializeStorage(); resolveEdge(id, getElementQueries())`. pendingMode branch → `<Show when={props.pendingMode}>` raw input whose `onInput` calls `props.pendingMode!.onChange(trimmed ? { targetId: trimmed } : null)` — its current half-Qwik `onChange$` inconsistency dies here.

10. **Manifest swaps restore the pre-migration localized-cast pattern, Solid-typed**: `Renderer: TextKvField as unknown as Component<FieldRendererProps>` (`import type { Component } from 'solid-js'`), TODO comment deleted. Registry/`Vitest` graph verified safe: no test imports `kinds/registry`, so pointing manifests at `.tsx` renderers puts no JSX in any test-reachable path.

11. **DataFieldDetails**: props become `{ fieldId; definitionId; kind; onDelete: () => void }` — **`currentValue` dropped: declared but never read in the body** (leftover from the retired preview-overlay UX; verified). Lifecycle in component setup (fieldId is a mount-time constant; the panel remounts per expand): **subscribe-before-first-load** with a shared `let disposed` guard — bus subscription (`ELEMENT_WRITTEN` for this field → refetch history) registered *before* the initial `Promise.all([fetchHistory(), getDefinitionById(definitionId)])` fires (Phase II discipline; strictly closes Qwik's missed-event window — note it). Derivations as thunks: `latestEntry`, `metadataText` (`formatTimestampShort` + `updatedBy`), `hasHistory = history().length > 1`. Same JSX: metadata span, history chevron (`aria-expanded`, disabled when `!hasHistory()`), `<DataFieldHistory>` mount, actionsRow + Delete Field button → `props.onDelete()`.

12. **DataFieldHistory**: memos `visibleAscending` (drop live-duplicate last entry), `allEntries` (reversed, newest first), `liveValue`; `selectedId` signal; `revert` keeps the no-op gate + `commitWithUndo` `'Field reverted'` (execute UPDATE_ELEMENT_VALUE target, undo restore `liveValue`). Per-row `formatted` via `getInlineManifest(props.kind).displayPreview(entry.newValue, props.config)` computed inside the `<For>` render fn; revert dot shown when selected ∧ formatted ≠ '' ∧ `newValue !== liveValue()`, with `ev.stopPropagation()`.

13. **DataField wiring (III-6)**: replace the TODO seam with `<Show when={isDetailsExpanded()}><DataFieldDetails fieldId={props.id} definitionId={props.definitionId} kind={props.kind} onDelete={handleDelete}/></Show>`; `handleDelete` = `commitWithUndo({ message: 'Field deleted', execute: DELETE_ELEMENT, undo: RESTORE_ELEMENT })`. **TreeNodeDisplay Delete Asset restores here too** (its line-80 TODO is explicitly Phase III scope): port `handleDeleteNode$` from `8b8bb50` — message `'Node deleted'`, on success `props.onNavigateUp?.(parentId ?? null)`, button aria-label `"Delete this asset"`, `detailsStyles.actionsRow`/`deleteButton` classes.

14. **Lint posture for mount-time-constant props**: `useFieldEdit({ fieldId: props.id, initialValue: props.value, … })` and `useFieldValueSync(props.id, …)` read props in setup scope; `solid/reactivity` (at error) may flag them. These are *genuinely* non-reactive by design (rows remount per field — `<For>` reference-keyed, Phase II decision 11; `useFieldValueSync(fieldId: string, …)` locked non-reactive in Phase II). Sanctioned fix if the rule fires: targeted `// eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field` at the call site. Do **not** contort the APIs into accessors that would falsely promise reactivity.

15. Use **context7** during implementation for current solid-js idioms where unsure (`createResource`, `<Show keyed>`, effect timing, `on:` native events).

## Steps

### III-1 — `MIGRATE(III-1): FieldRendererProps rootRef accessor contract; DataField owns the row ref` *(reachable graph)*

- `src/kinds/types.ts`: `rootRef: Accessor<HTMLElement | undefined>` (import `Accessor`), delete `onUpdated?`, update the doc comment (decision 1–2).
- `src/components/DataField/DataField.tsx`: `createSignal<HTMLElement>()` + `ref={setRootEl}` on the wrapper div + pass `rootRef={rootEl}` through `<Dynamic>`; delete the onUpdated TODO comment.
- eslint: no change (both paths already covered). Gate: lint + test + **typecheck**. Commit.

### III-2 — `MIGRATE(III-2): field-edit lifecycle hooks on Solid` *(unreachable)*

- `src/hooks/useEditableValue.ts` (decision 5), `src/hooks/useFocusManager.ts` (decision 4), `src/hooks/useFieldEdit.ts` (decision 3). All stay `.ts`. `useFieldEdit` calls `useFocusManager(() => inputEl, () => appState.editingElementId === options.fieldId)`; imports (`getCommandBus`, `getSnackbarService`, `commitWithUndo`, `useDoubleTap`, appState, `useEditableValue`) all already Solid/plain.
- `eslint.config.mjs`: hooks brace-list grows to `src/hooks/{useElementChildren,useLensGather,useLensPolicy,useFieldValueSync,useDoubleTap,useAncestorPath,useFieldEdit,useFocusManager,useEditableValue}.ts`.
- Gate: lint + test. Commit.

### III-3 — `MIGRATE(III-3): TextKvField on Solid — the edit stack becomes reachable`

- `src/components/DataField/TextKvField.tsx`: Wrapper/Body split (decision 6), Body per decision 8 — keep `formatText`/`parseText`/`countWords`/`makeValidate(config.maxWords)`, `config.multiline` → `<textarea rows={4}>` vs `<input>`, display div `role="button" tabIndex={0} aria-description="Press Enter to edit"` + `aria-labelledby`.
- `src/kinds/text-kv.manifest.ts`: Renderer swap + cast (decision 10).
- eslint: add `src/components/DataField/TextKvField.tsx`.
- Gate: lint + test + **typecheck (first reachability proof of the whole hook stack)**. Dev smoke on a seeded Description field: double-tap → focus + cursor at end, Enter-save, Escape, click-away, **fast-typing keystroke check** — this is where the decision-3 focus-steal contingency gets decided. Commit.

### III-4 — `MIGRATE(III-4): NumberKv, SingleImage, AssetDoc renderers on Solid`

- `src/components/DataField/NumberKvField.tsx` (decisions 6, 8: percent/decimals `formatEdit`/`parseEdit`, `[lowLow, highHigh]` hard-reject validate, `buildHelperText`, affix spans, `inputMode="decimal"`, `data-state`).
- `src/components/DataField/SingleImageField.tsx` (decision 8: caption edit via `useFieldEdit<SingleImageValue>`, 180ms flash kept).
- `src/components/DataField/AssetDocField.tsx` (decision 9).
- `src/kinds/number-kv.manifest.ts`, `single-image.manifest.ts`, `asset-doc.manifest.ts`: Renderer swaps (asset-doc needs no cast).
- eslint: add the three renderer files. Gate: lint + test + typecheck. Commit.

### III-5 — `MIGRATE(III-5): EnumKvField popover on Solid`

- `src/components/DataField/EnumKvField.tsx` per decision 7.
- `src/kinds/enum-kv.manifest.ts`: Renderer swap.
- eslint: replace the per-file `src/components/DataField/*` entries with `src/components/DataField/**/*.{ts,tsx}` (the dir is now fully Solid: dispatcher, 5 renderers, `numberKvState.ts`).
- Gate: lint + test + typecheck. Dev smoke: enum open/position/focus/outside-close/Escape/allowOther. Commit.

### III-6 — `MIGRATE(III-6): details/history/revert + delete surfaces`

- `src/components/DataFieldHistory/DataFieldHistory.tsx` (decision 12).
- `src/components/DataFieldDetails/DataFieldDetails.tsx` (decision 11).
- `src/components/DataField/DataField.tsx`: mount details + `handleDelete` (decision 13; imports `commitWithUndo`, `getCommandBus`, `DataFieldDetails` return here).
- `src/components/TreeNode/TreeNodeDisplay.tsx`: Delete Asset restore (decision 13).
- eslint: add `src/components/{DataFieldDetails,DataFieldHistory}/**/*.{ts,tsx}`.
- Gate: full Verification battery below. Commit.

*(Docs are a separate commit after user verification — see Project Context Management.)*

## Verification

1. `npm run typecheck` → 0 errors (reachability proof: manifests → renderers → hooks all import-followed under Solid JSX types).
2. `npm run test` → 39 files / 419 tests green. Canaries: `doubleTap.test.ts`, `numberKvState.test.ts`, `kindCoherence.test.ts` (registry stays out of Vitest), `appState.test.ts`, `snackbarService.test.ts`.
3. `npm run lint` → 0 errors. Spot-check: `npx eslint --print-config src/components/DataField/EnumKvField.tsx` shows `solid/*` at error; `--print-config src/components/FieldComposer/ComposerRow.tsx` shows none.
4. Ratchet: `grep -rl "@builder.io" src` → **exactly 18 files** (17 Phase IV + 1 mop-up):
   `src/components/CreateDataField/CreateDataField.tsx`, `src/components/CreateNodeButton/CreateNodeButton.tsx`, `src/components/FieldComposer/{ComposerRow,DefinitionAuthoringForm,FieldComposer,FieldComposerSlot}.tsx`, `src/components/FieldComposer/configForms/{EnumKv,Logbook,NumberKv,SingleImage,TextKv}ConfigForm.tsx`, `src/components/LensCreate/LensCreate.tsx`, `src/components/LensCreateButton/LensCreateButton.tsx`, `src/components/TreeNode/TreeNodeConstruction.tsx`, `src/hooks/{useAsyncOperation,useDefinitionDraft,useNodeCreation,usePendingForms}.ts`. None of the III-1…III-6 files may appear.
5. **Hand-test (user-run, dev build, offline or emulator — never production Firestore).** Seed via the Phase II `window.__cmm` console hook if IDB is empty (script in `SOLIDJS-WORKPHASE-II.md` §Verification-5); an enum field: `fd_status`; edit any field **twice** to mint history (chevron stays disabled under 2 entries). This is the meta-plan §10 checklist **minus the four composer items** (composer pending-row click-away commit, composer enum tick auto-open, tall-preview anchor, multi-field commit burst — those surfaces arrive in Phase IV; the pendingMode paths land dark now):
   - [ ] Double-tap a field value → enters edit, input focused, cursor at end
   - [ ] Double-tap *while editing* → cancels back to display
   - [ ] Single tap on a field value → does nothing
   - [ ] Enter/Space on a focused field value → enters edit
   - [ ] Enter while editing → saves ('Field updated' + Undo works); Escape → cancels and restores display value
   - [ ] Click away while editing → cancels
   - [ ] Pointerdown inside an already-focused input → does not close the editor (220ms blur-suppress width re-verify)
   - [ ] Save/cancel → focus lands somewhere sane; no focus loops or double-focus flicker
   - [ ] **Fast-typing keystroke retest** (§9 known bug: "Frst value") — should vanish with synchronous signal writes; if it persists, the bug is in this port, not the framework
   - [ ] Number field: bad input → error snackbar, stays editing; nominal-band helper text; `data-state` colors (warn/alarm/stale)
   - [ ] Enum: double-tap trigger → popover opens positioned at trigger, first option focused; pick commits + Undo
   - [ ] Enum: scroll/resize while open → popover tracks trigger; outside click closes; Escape returns focus to trigger; Other… → input focused, commit works
   - [ ] Field chevron → details panel: metadata (timestamp + user), history chevron disabled with <2 entries
   - [ ] History: newest first, row select, revert dot only on non-live rows → 'Field reverted' + Undo
   - [ ] Delete Field → row disappears, 'Field deleted' snackbar, Undo restores
   - [ ] Delete Asset on a branch parent → 'Node deleted', navigates up, Undo restores
   - [ ] Rapid edits to several fields → one sync push after the 500ms window (network/emulator)
   - [ ] Edit a field visible in a lens rollup → rollup + KindAdornment update within ~a beat
6. Cypress: **not a gate** — specs still create data via Phase IV UI surfaces. Do not chase them.

## Project Context Management

After the coding work is believed complete, ask the user to run Verification §5 (the hand-test checklist). **Only if the user confirms it works** (docs land as their own commit, Phase II convention):

1. **SOLIDJS-MIGRATION.md** — mark Phase III done in §6; note: `onUpdated` deleted as verified-dead plumbing (zero producers pre-migration); `DataFieldDetails.currentValue` prop dropped (unread); EnumKvField's open-effect deliberately tracks the options resource (closes a Qwik-era focus race); TreeNodeDisplay Delete Asset restored here per its Phase II TODO; §10 hand-test checklist walked minus the four composer items (re-walk with composer in Phase IV).
2. **ISSUES.md** — nothing (migration tracked in SOLIDJS-MIGRATION.md only).
3. **IMPLEMENTATION.md** — short notes: `rootRef` accessor-down contract (dispatcher owns the row ref); `suppressBlurUntil` as a plain mutable box (deliberately non-reactive); always-on document/window listeners with FSM guards replacing `useOnDocument`/`useOnWindow`; the §10 timing-workaround deletions (FOCUS_DELAY_MS, four `setTimeout(0)`s) and why.
4. **LATER.md** — nothing new deferred (all omissions are owned by meta-plan Phase IV; the composer-mode behaviors of `useFieldEdit`/EnumKv landed dark and get exercised there).
