# SOLIDJS-WORKPHASE-IV — Create & author path (Qwik → SolidJS migration, Phase IV)

> On approval: save this file as `.claude/plans/SOLIDJS-WORKPHASE-IV.md` and commit it first (`PLAN: Solid migration phase IV plan written`), per phase convention.

## Context

Branch `MIGRATE-whole-app-move-to-SolidJS`, meta-plan `SOLIDJS-MIGRATION.md`. Phases I–III done and **user-verified**: the app boots, navigates, displays, and the whole edit path is live (real renderers, field-edit lifecycle, details/history/revert, delete+undo). The renderers' `pendingMode` code paths landed **dark** in Phase III — Phase IV lights them.

**Phase IV scope (meta-plan §6):** node construction + pending drafts; the create surfaces; the field composer + config forms + Definition drafts; lens creation.

**Files to port (17 of the 18 remaining Qwik files — all untouched pre-migration originals, newest commit `8b8bb50`; verified: the ported/unported split is clean, no half-migrated files):**
`src/components/FieldComposer/{FieldComposer,FieldComposerSlot,ComposerRow,DefinitionAuthoringForm}.tsx`; `configForms/{TextKv,EnumKv,NumberKv,SingleImage,Logbook}ConfigForm.tsx`; `src/components/TreeNode/TreeNodeConstruction.tsx`; `src/components/CreateNodeButton/CreateNodeButton.tsx`; `src/components/CreateDataField/CreateDataField.tsx`; `src/components/LensCreate/LensCreate.tsx`; `src/components/LensCreateButton/LensCreateButton.tsx`; `src/hooks/{useDefinitionDraft,usePendingForms,useNodeCreation}.ts`. **`src/hooks/useAsyncOperation.ts` is NOT ported** — zero importers (verified), dies at mop-up per IMPLEMENTATION.md. Plus wiring in already-Solid files: `TreeNode.tsx`, `FieldList.tsx` (+ `addFieldSurfaces.ts` doc), `DataCard.tsx`, `NodeHeader.tsx`, `RootView.tsx`, `BranchView.tsx`, `LensRollup.tsx`, the 5 manifest ConfigForm restores, `eslint.config.mjs` growth.

**Phase gate per commit:** `npm run lint` 0 errors, `npm run test` green (39 files / 419 tests). `npm run typecheck` bites on every commit that grows the reachable graph — note the manifests are already typechecked, so the config-form commits are reachability commits from day one (tsconfig excludes `src/components`+`src/hooks` from direct inclusion; files enter the program only via imports). Ratchet at start: 18 Qwik-importing files; at close: **1** (`useAsyncOperation.ts`). Feature freeze holds. **Cypress becomes a gate for the first time at phase close** — the three 2026-07-07 contract specs need exactly these surfaces (`Create New Asset`/`Node name`/`Create`, `+ Add Fields`/`Save`, `Create New Entry on X`).

**Timing law (meta-plan §10):** verified by grep — the entire port set contains exactly one timeout: `ComposerRow.tsx:49` `setTimeout(…, 220)` scroll anchor, an **animation constant → KEEP**. No Qwik-render-workaround `setTimeout(0)`s exist in this phase's files. `TreeNodeConstruction`'s mount focus and `LensCreate`'s focus task become `onMount`/`createEffect` with no delay.

## Deviations found (previous plans / notes vs. verified reality)

1. **Root create-kinds source is `RE_ROOT_CREATE_KINDS`, not `reRootCreateKindsFor`** (verified in `8b8bb50:RootView.tsx:72`): `<CreateNodeButton variant="root" availableKinds={RE_ROOT_CREATE_KINDS.filter((k) => !isLensSurfaced(k))} onClick$={start$}/>`. Only BranchView narrows by parent kind: `reRootCreateKindsFor(parentNode.value.kind).filter(!isLensSurfaced)`. Port both exactly.
2. **Cancel-on-navigation existed pre-migration** (`8b8bb50:BranchView.tsx:58-63`): a `useTask$` tracking `props.parentId` calls the **raw** `cancelConstruction$()` transition — not the hook's `cancel$` — so the localStorage draft survives navigation. It is defensive-only: `guards.notUnderConstruction` blocks all navigation transitions while UC is open (verified `appState.transitions.ts:35,54,75`). Port 1:1 anyway (decision 2).
3. **The "namespaced key" (`key={`uc-${ucNode.id}`}`) rationale dissolves in Solid** — the UC card renders in its own JSX position (a `<Show>`), never identity-matched against the `<For>` rows. The **dual-render filter carries** (the bus reload can land the created node in the list while `underConstruction` is still set, because `complete` awaits CREATE_ELEMENT + `commitPendingDraft` before `completeConstruction`). Replace the key comment with a one-liner saying the filter, not a key, prevents dual render.
4. **`usePendingForms`' `initialized` signal is Qwik-remount armor** (guards `useVisibleTask$` re-runs); Solid `onMount` runs once — dropped, replaced by the standard `disposed` guard around the await.
5. **Composer list refetch loses its loading flash — deliberate improvement, flagged.** Qwik `<Resource>` re-enters `onPending` on every `DEFINITION_WRITTEN` bump; Solid `createResource` serves the stale list while refetching. First mount still shows `Loading field definitions…`.
6. **Composer resource had no `onRejected`** (a listDefinitions failure rendered a blank rows region). The Phase III error-catching-fetcher convention (→ `[]`) renders `No field definitions available` instead. Micro-delta, flagged. `CreateDataField` *did* have `onRejected` — its three states (`Loading…` / `Failed to load field definitions` / `No field definitions available`) carry exactly.
7. **`CreateNodeButton` seed-once quirk carried 1:1**: `selectedKind` seeds from the first `availableKinds` seen and never reseeds on prop change (identical Qwik `useSignal(initial)` semantics). Latent pre-migration behavior; do not "fix" under feature freeze.
8. **`useDefinitionDraft.save` resets `kind` to `DEFAULT_KIND` after a successful save** — invisible (the form closes immediately), carried 1:1.
9. **Meta-plan §10 checklist already shows the four composer items checked** — they were verified in Phase III only *via the hook paths*; the composer surfaces themselves get their first real walk here (Verification §6 re-walks them on the real UI).

## Strategy decisions

1. **`useNodeCreation` takes an accessor and returns one:** `useNodeCreation(parentId: Accessor<string | null>)` → `{ ucNode: Accessor<UnderConstructionData | null>; start(kind?: Kind): void; cancel(): void; complete(payload: CreateNodePayload): Promise<void> }`. Qwik re-captured `options.parentId` per render; a Solid mount-time capture would go stale as BranchView navigates — `start` reads `parentId()` at call time. `ucNode` = `() => appState.underConstruction` (store read, tracked at the JSX read site). `start` goes synchronous (the `$` was the only async); `cancel` keeps `discardPendingDraft(uc.id)` + `cancelConstruction`; `complete` keeps CREATE_ELEMENT → `commitPendingDraft(uc.id, -1)` → `completeConstruction`; `'Untitled'` fallback and `subtitle || null` byte-identical. Re-exports `CreateNodePayload`.

2. **BranchView cancel-on-parentId-change: `createEffect(on(() => props.parentId, () => { if (appState.underConstruction) cancelConstruction(); }))`.** `on()` is load-bearing, not style: its callback runs *untracked*, so the `underConstruction` read doesn't become a dependency — a plain `createEffect` would re-run when `startConstruction` fires and **cancel the construction it just opened**. `on` without `defer` also runs at mount, matching `useTask$`. Calls the raw transition (deviation 2 — draft survives).

3. **UC insertion into views:** `<Show when={ucNode()} keyed>{(uc) => <TreeNode id={uc.id} name={uc.name} subtitle={uc.subtitle} nodeState="UNDER_CONSTRUCTION" onCancel={cancel} onCreate={complete}/>}</Show>` after the `<For>`, before `<CreateNodeButton>`; the dual-render filter folds into the list memos (RootView: `nodes().filter(n => { const uc = ucNode(); return (!uc || n.id !== uc.id) && !isLensSurfaced(n.kind); })`; BranchView same over `children()`, UC block wrapped in the pre-migration `<div class="branch-child-row">` with `isChildConstruction={true}`). `TreeNode.tsx`'s construction branch swaps `null` for `<TreeNodeConstruction id initialName initialSubtitle isChildConstruction onCancel onCreate/>` — the props union + `isConstructionProps` guard in `TreeNode/types.ts` are already Solid-shaped.

4. **`FieldComposerSlot` keyed-remount idiom: value-keyed `<Show>`.** Qwik's `key={restoreSeed.value ? 'restored' : 'fresh'}` becomes an outer `<Show when={composerOpen()}>` + inner `<Show when={restoreSeed() ? 'restored' : 'fresh'} keyed>{() => <FieldComposer … restoreSeed={restoreSeed()} onDismiss={handleDismiss} onRequestRestore={handleRequestRestore}/>}</Show>` — `<Show keyed>` recreates children whenever the `when` value changes, which is exactly Qwik's key semantics: Undo-restore flips `'fresh'→'restored'`, remounting the composer so `usePendingForms`' mount seed-loader runs against the restore seed. `composerOpen = () => isConstruction() || props.activeSurface?.() === 'composer'`; the `+ Add Fields` button (`aria-label="Add fields (open composer)"`) renders when `!composerOpen() && !isConstruction()`.

5. **`activeSurface` mutex prop shape: explicit accessor + setter pair** (the rootRef-accessor precedent, not a smuggled signal tuple): `activeSurface?: Accessor<ActiveSurface>; setActiveSurface?: (s: ActiveSurface) => void` on `FieldComposerSlot` (optional — construction passes neither), required on `CreateDataField`. FieldList owns `const [activeSurface, setActiveSurface] = createSignal<ActiveSurface>('none')`. Update the surface-contract doc comment in `addFieldSurfaces.ts` (types unchanged). Last-writer-wins semantics identical.

6. **`usePendingForms` Solid contract** (stays `.ts`): `usePendingForms({ nodeId: string; initialSeedLoader?: () => Promise<PendingForm[]> })` → `{ forms: Accessor<PendingForm[]>; lastToggledId: Accessor<string | null>; togglePending(def): void; setPendingValue(formId, value): void; commitAll(currentMaxCardOrder): Promise<number>; discardAll(): PendingForm[] }`. Mount seed in `onMount` with a `disposed` guard (deviation 4), **stored-draft-wins order preserved exactly**: `loadPendingForms(nodeId)` first; only when empty run `initialSeedLoader` and `savePendingForms` the seed. All mutators keep the **write-through** `savePendingForms` calls — now genuinely same-tick before any commit read. `nodeId` is a mount-time constant by contract (the composer remounts per session via the keyed `<Show>`). Re-export `pendingFormFromDefinition`/`PendingForm`.

7. **`useDefinitionDraft`: mechanical signal port.** Four `createSignal`s, plain actions, `save(): Promise<Definition | null>` with the same gate (`!trimmed || configError()` → null), `fd_user_${generateId()}` id, try/catch → null, post-save reset (deviation 8). `LABEL_MAX = 50`, `DEFAULT_KIND`, `defaultConfigFor` exports unchanged.

8. **`FieldComposer`: subscribe-before-resource + `createResource` keyed on `refreshKey` + keyed `<Show>`.** Setup order: (a) `usePendingForms` with the seed-loader closure (reads `props.restoreSeed`/`props.mode`/`props.lockedDefinitionIds` — mount-time constants via the keyed remount, lint posture 15); (b) `storageEventBus.subscribe` for `DEFINITION_WRITTEN → setRefreshKey(k => k+1)` with `onCleanup(unsub)`, registered **before** (c) `createResource(refreshKey, fetcher)` first fires (subscribe-before-first-load discipline). Fetcher = `listDefinitions()` → `isInline` filter → `localeCompare` sort, try/catch → `[]` (deviation 6). Render behind `<Show when={definitions()} keyed fallback={…Loading field definitions…}>`: `justCreated()` pinned pre-checked rows above the alphabetical rest, affordance `+ New Field Definition…`, empty state `No field definitions available` — all byte-identical. `lockedSet` computed once at setup. `handleCancel` → `commitWithUndo({ execute, undo, message })` **plain fns**: execute = capture `discardAll()` + `props.onDismiss()`; message = `` (n) => n ? `${n} field(s) discarded` : null `` (exact pre-migration string incl. pluralization); undo = `props.onRequestRestore?.(captured)`. Footer (`Cancel`/`Save`, Save `disabled={forms().length === 0}`) only in display mode. `handleAuthored`: append to `justCreated`, `togglePending(def)` (now sync), bump `refreshKey`, close authoring.

9. **`ComposerRow` owns the row ref as a signal — the first pendingMode producer (the dark path goes live).** `const [rootEl, setRootEl] = createSignal<HTMLElement>()`, `ref={setRootEl}` on the row div (covers checkbox+label+renderer for outside-click containment), `rootRef={rootEl}` down to the renderer — exactly the Phase III DataField pattern. `checkboxEl` is a plain closure ref. The scroll anchor — the phase's one KEEP timeout — ports as `createEffect(() => { void props.checked; const t = setTimeout(() => checkboxEl?.scrollIntoView({ block: 'nearest' }), 220); onCleanup(() => clearTimeout(t)); })` (runs at mount too, as the visible task did; `block:'nearest'` no-ops when already visible). `RowBody` mounts only when `checked && pendingForm` (as today) via `<Dynamic component={getInlineManifest(props.definition.kind).Renderer} id={pendingForm.id} definitionId={definition.id} value={pendingForm.value ?? null} rootRef={rootEl} pendingMode={{ onChange: (v) => props.onValueChange(formId, v), autoFocus: props.autoFocus }}/>` — `formId` captured at mount (`pendingForm.id` is stable across value patches; rows remount per definitions refetch). Checkbox attrs (`title="Required"`, `aria-disabled`, `tabIndex={-1}` when locked), `(required)` tag, `composer-label-${definition.id}` id byte-identical.

10. **`DefinitionAuthoringForm`: `<Dynamic>` for the kind-picked ConfigForm.** `<Dynamic component={getDefinitionAuthoring(kind())!.ConfigForm} config={config()} onChange={(cfg, error) => { setConfig(cfg); setConfigError(error ?? null); }}/>` — swaps reactively on segmented-picker change; `pickKind` wraps its writes in `batch()` (or orders config-before-kind) so the newly mounted form never sees the previous kind's config. `onChange$` → plain two-arg `onChange` per `ConfigFormProps` (`src/kinds/types.ts:86-89`). Segmented control via `<For each={COMPONENT_CHOICES}>` with `role="radio"`/`aria-checked`; label input keeps `maxLength={50}`, placeholder `e.g. Serial Number`, `autofocus` attribute. Save `disabled={!label().trim() || !!configError()}`.

11. **Config forms are mechanical flips; manifests restore the pre-migration localized cast, Solid-typed:** `ConfigForm: TextKvConfigForm as unknown as Component<ConfigFormProps>` (`import type { Component } from 'solid-js'`), TODO comments deleted; `asset-doc` keeps `ConfigFieldStubConfigForm` permanently (genuine stub). Each form keeps its narrow prop type and the shared `update(patch)` closure — handlers reading `props.config` at event time are lint-clean. Enum: use `<Index>` for the options string array so per-keystroke edits don't remount inputs; keep add/remove/default-clearing logic and `` aria-label={`Remove option ${i + 1}`} ``. **NumberKvConfigForm (415L, own commit):** signals `commonOpen`/`advancedOpen`/`refreshAmount`/`refreshUnit`/`dirty`/`selectedPrecision` → `createSignal`; `errorMessage` → `createMemo(() => dirty() ? validateNumberKvConfig(props.config) : null)` (`validateNumberKvConfig` from the already-ported `numberKvState.ts`); the refresh seed (`initialRefreshSecs`/`unitFromSeconds`) stays a setup-scope read — mount-time by design, the form remounts per kind pick via `<Dynamic>` (lint posture 15); `pickDisplayFormat` (currency → prefix, clears `currencyCode`), `pickNominalMode` (clears the other mode's fields), `setRefresh` canonical-seconds logic verbatim; `NumericInput`/`ThresholdInput` stay file-local components; progressive disclosure keeps `aria-expanded`, `▾`/`▸`, the `LL ≤ L ≤ … ≤ H ≤ HH` chain aria, `role="alert"` error.

12. **NodeHeader construction props: ref *callbacks*, not signal boxes.** Add `isConstruction?: boolean; nameInputRef?: (el: HTMLInputElement) => void; subtitleInputRef?: (el: HTMLInputElement) => void; onKeyDown?: (e: KeyboardEvent) => void; onNameInput?: (e: Event) => void; chevronDisabled?: boolean`. Title block branches `<Show when={props.isConstruction} fallback={…display branch…}>` → the two inputs, ported **verbatim from `8b8bb50:NodeHeader.tsx`** (classes, placeholders, and the `Node name`/`Node subtitle` aria-labels are Cypress selectors); chevron button gains `disabled={props.chevronDisabled}`. **TreeNodeConstruction** owns plain `let nameInputEl/subtitleInputEl` locals + setter callbacks, a `nameValue` signal mirroring the name input for Create `disabled={!nameValue().trim()}`, `onMount(() => nameInputEl?.focus())` (no delay), Enter→create (keep the empty-name guard — Enter bypasses the disabled button) / Escape→cancel, `--datacard-indent` `'18px'`/`'50px'`, `DEFAULT_DEFINITION_IDS` (typeOf/description/tags via `DEFINITION_IDS`) passed as `initialDefinitionIds`.

13. **DataCard grows `actions?: JSX.Element`, rendered after `children`** — the `<Slot name="actions"/>` successor. TreeNodeConstruction passes the Cancel/Create actionsRow; DOM output identical minus Qwik-internal `q:slot` attrs.

14. **FieldList add-field surfaces restore the exact pre-migration gating:** `maxPersistedCardOrder = createMemo(() => fields().length === 0 ? -1 : Math.max(...fields().map(f => f.siblingOrder)))`; composer slot when `!props.hideAddSurfaces && (props.isConstruction || ENABLED_ADD_FIELD_SURFACES.includes('composer'))` with `mode`, `currentMaxCardOrder={maxPersistedCardOrder()}`, `initialDefinitionIds`, the mutex pair; `CreateDataField` when `!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('legacy') && !props.isConstruction`. The declared-but-unused props (`isConstruction`/`initialDefinitionIds`/`hideAddSurfaces`) finally get consumers. **CreateDataField:** `createResource` loading once at mount (parity — no refetch key), fetcher catches to a sentinel so the dropdown renders its exact three states; toggle flips the mutex `'legacy'`↔`'none'`; pick closes then `CREATE_ELEMENT_FROM_DEFINITION` at `currentMaxCardOrder + 1`; `aria-haspopup="listbox"`/`aria-expanded`/`role="listbox"`/`role="option"` carry.

15. **Lint posture — sanctioned `solid/reactivity` disables (Phase III convention, one-line reason each):** `usePendingForms({ nodeId: props.nodeId, … })` + the seed-loader closure + `lockedSet` in FieldComposer (*mount-time constant; composer remounts via keyed `<Show>`*); RowBody's `formId`/Renderer captures (*mount-time; rows remount per definitions refetch*); NumberKvConfigForm's refresh-seed reads (*mount-time seed; form remounts per kind pick via `<Dynamic>`*); CreateNodeButton's `createSignal(props.availableKinds[0] …)` (*seed-once, matches Qwik semantics — deviation 7*). Do not contort APIs into false-reactive accessors.

16. **`LensCreate`/`LensCreateButton`:** `useElementById(() => props.ownerId)`; `creating` signal; `inputEl` plain closure ref; focus via `createEffect(() => { if (creating()) inputEl?.focus(); })` (input mounts synchronously on the signal flip); `commit` (read → clear → close → guard-empty → `CREATE_ELEMENT { kind: targetKind, parentId: ownerId, name }` — parented to the **owner**), commit-on-blur, Enter/Escape, button label `` `Create New ${entryLabel} on ${ownerEl()?.name ?? 'this asset'}` ``. `LensCreateButton` is a stateless `onClick` flip. Mount points: `LensRollup.tsx:58` (`entryLabel={entryLabel()}`) and BranchView's lens branch with `entryLabel={lensPolicy().entryLabel || undefined}` — BranchView starts *consuming* the `useLensPolicy` result it already calls (line 48-50).

17. **`CreateNodeButton`:** early-return-null → `<Show when={props.availableKinds.length > 0}>`; picker `<Show when={props.availableKinds.length > 1}>` `<select aria-label="Kind of asset to create">` over `getKindManifest(k).pickerLabel`; labels/classes byte-identical (`Create New Asset` / `+ Add Sub-Asset`, `no-caret`); `onClick?: (kind: Kind) => void` plain.

18. Use **context7** during implementation for current solid-js idioms where unsure (`<Show keyed>` value-change semantics, `on()` untracked callback, `batch`, `<Dynamic>`).

## Steps

### IV-1 — `MIGRATE(IV-1): text/enum/single-image/logbook config forms on Solid; manifest restores` *(reachable — manifests are already in the typecheck graph)*

- `configForms/{TextKv,EnumKv,SingleImage,Logbook}ConfigForm.tsx` (decision 11).
- `src/kinds/{text-kv,enum-kv,single-image,logbook}.manifest.ts` — restore real ConfigForms with the cast; delete TODOs. (Logbook's stays dark — no authoring surface offers re-root kinds; restored for parity.)
- eslint: add the four files per-file (NumberKv still Qwik).
- Gate: lint + test + **typecheck**. Commit.

### IV-2 — `MIGRATE(IV-2): NumberKvConfigForm on Solid` *(reachable)*

- `configForms/NumberKvConfigForm.tsx` (decision 11 — heaviest file, own commit) + `number-kv.manifest.ts` restore.
- eslint: collapse to `src/components/FieldComposer/configForms/**/*.{ts,tsx}`.
- Gate: lint + test + typecheck. Commit.

### IV-3 — `MIGRATE(IV-3): author/create hooks on Solid (useDefinitionDraft, usePendingForms, useNodeCreation)` *(unreachable)*

- The three hooks per decisions 1, 6, 7. All stay `.ts`; deps (`pendingDraft`, `getCommandBus`, `generateId`, appState, `getDefinitionAuthoring`) already Solid/plain.
- eslint: hooks brace-list grows by `useDefinitionDraft,usePendingForms,useNodeCreation` (NOT useAsyncOperation).
- Gate: lint + test. Commit.

### IV-4 — `MIGRATE(IV-4): ComposerRow + DefinitionAuthoringForm on Solid` *(unreachable)*

- `ComposerRow.tsx` (decision 9), `DefinitionAuthoringForm.tsx` (decision 10).
- eslint: add both files.
- Gate: lint + test. Commit.

### IV-5 — `MIGRATE(IV-5): FieldComposer + FieldComposerSlot on Solid` *(unreachable)*

- `FieldComposer.tsx` (decision 8), `FieldComposerSlot.tsx` (decisions 4–5).
- eslint: collapse to `src/components/FieldComposer/**/*.{ts,tsx}` (dir fully Solid).
- Gate: lint + test. Commit.

### IV-6 — `MIGRATE(IV-6): FieldList add-field surfaces go live (+ CreateDataField)` *(reachability: the whole composer stack + 2 hooks enter typecheck)*

- `CreateDataField.tsx` + `FieldList.tsx` + `addFieldSurfaces.ts` doc (decisions 5, 14); delete FieldList's Phase IV TODO.
- eslint: add `src/components/CreateDataField/**/*.{ts,tsx}`.
- Gate: lint + test + **typecheck**. Dev smoke on an existing node — the four Phase III-deferred behaviors become testable here: `+ Add Fields`, tick → renderer auto-opens focused, click-away **commits** the pending value, tall-preview 220ms anchor, Save burst → one reload. Commit.

### IV-7 — `MIGRATE(IV-7): NodeHeader construction branch + DataCard actions prop` *(reachable prep, inert until IV-8)*

- `NodeHeader.tsx` (decision 12), `DataCard.tsx` (decision 13); TODOs deleted.
- eslint: no change (both dirs already covered).
- Gate: lint + test + typecheck. Commit.

### IV-8 — `MIGRATE(IV-8): node construction goes live — TreeNodeConstruction, CreateNodeButton, views UC wiring`

- `TreeNodeConstruction.tsx` (decision 12), `TreeNode.tsx` construction-branch mount (decision 3), `CreateNodeButton.tsx` (decision 17).
- `RootView.tsx`: `useNodeCreation(() => null)`, UC filter folded into `displayNodes`, UC `<Show keyed>`, `<CreateNodeButton variant="root" availableKinds={RE_ROOT_CREATE_KINDS.filter(k => !isLensSurfaced(k))} onClick={start}/>` (deviation 1).
- `BranchView.tsx`: `useNodeCreation(() => props.parentId)`, cancel-on-parentId `createEffect(on(…))` (decision 2), UC block in `branch-child-row` with `isChildConstruction`, `<CreateNodeButton variant="child" availableKinds={reRootCreateKindsFor(parentNode()!.kind).filter(k => !isLensSurfaced(k))} onClick={start}/>`.
- eslint: collapse TreeNode entries to `src/components/TreeNode/**/*.{ts,tsx}`; add `src/components/CreateNodeButton/**/*.{ts,tsx}`.
- Gate: lint + test + typecheck. Dev smoke: root + child construction end-to-end (create, cancel, Enter/Escape, defaults appear as `(required)` rows). Commit.

### IV-9 — `MIGRATE(IV-9): lens creation — LensCreate mounts in LensRollup + BranchView`

- `LensCreateButton.tsx`, `LensCreate.tsx` (decision 16).
- `LensRollup.tsx` + `BranchView.tsx` lens-branch mounts; TODOs deleted.
- eslint: add `src/components/{LensCreate,LensCreateButton}/**/*.{ts,tsx}`.
- Gate: full Verification battery below. Commit.

*(Docs are a separate commit after user verification — see Project Context Management.)*

## Verification

1. `npm run typecheck` → 0 errors (the entire UI graph is now import-followed under Solid JSX types).
2. `npm run test` → 39 files / 419 tests green. Canaries: `appState.test.ts` (construction transitions get first callers), `kindCoherence.test.ts` (manifests point at real ConfigForms; registry stays out of Vitest-reachable paths, same as the Phase III Renderer swaps).
3. `npm run lint` → 0 errors. Spot-check: `npx eslint --print-config src/components/FieldComposer/FieldComposer.tsx` and `…TreeNode/TreeNodeConstruction.tsx` show `solid/*` at error; `--print-config src/hooks/useAsyncOperation.ts` shows none.
4. Ratchet: `grep -rl "@builder.io" src` → **exactly 1 file**: `src/hooks/useAsyncOperation.ts` (dies at mop-up).
5. **Cypress — NEW GATE (first phase where it bites).** Prereqs: `npm run emulator` (8080) + `npm run dev` (5173); run cleanup first per repo convention, then `npm run cypress:run`. All 3 specs green: `core-loop.cy.ts` (construction card → defaults → edit → composer → revert → delete/undo; offline-stubbed), `lens-loop.cy.ts` (in-lens create → rollup; offline-stubbed), `offline-sync.cy.ts` (queue drain against the emulator). These specs ARE the behavior contract — failures are port bugs, not spec drift; **do not edit specs to pass**.
6. **Hand-test (user-run, dev build, offline or emulator — never production Firestore).** Completes the meta-plan §10 checklist (the four composer items get their first real-surface walk — deviation 9) plus the create/author walk:
   - **Composer (§10 leftovers):** click away on a pending row → **commits** the typed value; enum tick → auto-open + first option focused, seeded rows steal no focus; tick a tall-preview (single-image) row → checkbox stays anchored after the ~220ms animation; multi-field Save burst → one reload per view, no flicker storm.
   - **Composer general:** `+ Add Fields` opens; tick materialises the live renderer; untick discards the row; Save persists the batch in order after existing fields; Cancel → `N field(s) discarded` snackbar → **Undo reopens the composer with rows + typed values restored**; draft persistence — tick + type, reload page, reopen composer on the same node → rows restored (stored draft wins over seeds).
   - **Definition authoring:** `+ New Field Definition…` → form; each kind's config form works (text maxLength/multiline/placeholder; enum options add/remove/default + "at least one option" error gates Save; single-image knobs; number-kv progressive disclosure, currency→prefix, nominal-mode switch clears the other mode, threshold-chain violation → `role="alert"` error + Save gated); Save → pre-checked pinned focused row; next composer open shows it alphabetically.
   - **Legacy A/B mutex:** `+ Add Field` dropdown ↔ composer are mutually exclusive; single pick creates immediately.
   - **Node construction:** `Create New Asset` (root) and `+ Add Sub-Asset` (child; kind picker only when >1 kind; lens-surfaced kinds absent); name input focused on mount; Create disabled until name; Enter creates / Escape cancels; Cancel discards; defaults Type Of/Description/Tags as locked `(required)` rows; typed construction values land as single history rows on Create; UC card never dual-renders with the created node; pending draft survives a mid-construction reload.
   - **Lens create (both mounts):** rollup `Create New Entry on X` → input focused → Enter mints under the **owner**, appears in rollup; empty Enter/blur just closes; same affordance in the re-rooted lens view.
7. Post-phase sanity: `window.__cmm` and `window.__syncStatus` still defined (mop-up removes them, not Phase IV).

## Project Context Management

After the coding work is believed complete, ask the user to run Verification §5–6. **Only if the user confirms it works** (docs land as their own commit, phase convention):

1. **SOLIDJS-MIGRATION.md** — mark Phase IV done in §6; note: §10 checklist fully walked on real surfaces; Cypress promoted to a gate; deliberate deltas (composer stale-while-revalidate list — no loading flash on `DEFINITION_WRITTEN`; composer fetch-error renders the empty-state string instead of Qwik's blank region); `useNodeCreation` parentId/ucNode became accessors; ratchet at 1 (`useAsyncOperation.ts`, mop-up).
2. **ISSUES.md** — nothing (migration tracked in SOLIDJS-MIGRATION.md only).
3. **IMPLEMENTATION.md** — short notes: value-keyed `<Show keyed>` as the Qwik `key=` remount idiom (FieldComposerSlot); accessor+setter pair as the `Signal<T>`-prop successor (activeSurface); `createEffect(on(…))` where tracking must be deps-only (BranchView cancel — a plain effect would cancel the construction it just opened); DataCard `actions` prop replacing the named Slot; the namespaced-key dissolution (filter, not key, prevents UC dual render).
4. **LATER.md** — nothing new deferred (composer slide-in animation note pre-exists; `useAsyncOperation` deletion + `window.__cmm`/`window.__syncStatus` removal are owned by mop-up).
