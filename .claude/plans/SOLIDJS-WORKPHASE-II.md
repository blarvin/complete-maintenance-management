# SOLID-WORKPHASE-II — Read path (Qwik → SolidJS migration, Phase II)

> On pickup, rename this file to `.claude/plans/SOLIDJS-WORKPHASE-II.md` (project convention, matching Phase I).

## Context

Branch `MIGRATE-whole-app-move-to-SolidJS`, meta-plan `SOLIDJS-MIGRATION.md`. Phase I is done: the app boots a Solid shell (`src/App.tsx` renders ROOT/BRANCH placeholders on the Solid appState store), the kinds spine is Solid-typed with every manifest `Renderer` pointed at `ConfigFieldStubRenderer`, `eslint-plugin-solid` is at hard error with a Qwik-import ratchet, and tsconfig excludes `src/components`/`src/hooks` as *roots* (import-following still typechecks anything the ported graph reaches).

**Phase II scope (meta-plan §6):** the data-read hooks (`useElementChildren`/`useElementById`, `useLensGather`, `useLensPolicy`, `useFieldValueSync`) on Solid primitives; `RootView`/`BranchView`; the TreeNode display family; `DataCard`/`FieldList`/`NavigableRow`/`KindAdornment`/breadcrumbs — **read-only**. The app navigates and displays everything. Edit path (real field renderers, field details/history, delete+undo) is Phase III; create/author path (construction, composer, `LensCreate`, `CreateNodeButton`) is Phase IV.

**Phase gate:** `npm run typecheck` clean, all Vitest files green (39 at Phase I close), `npm run lint` clean. Cypress is not a gate (specs create data via UI surfaces that don't exist until Phase IV). Feature freeze: no data-model/sync/schema changes.

**Critical invariant:** no Qwik file may become reachable from the ported import graph. Reachability changes exactly once in this phase — when `App.tsx` imports the views (final commit) — and every file on the paths from there must already be Solid. Concretely: FieldList must drop its `FieldComposerSlot`/`CreateDataField` imports, DataField must not import `DataFieldDetails` or the five Qwik renderers, TreeNode must not import `TreeNodeConstruction`, LensRollup must not import `LensCreate`, views must not import `CreateNodeButton`/`useNodeCreation`.

## Strategy decisions

1. **tsconfig exclude stays `["node_modules", "src/components", "src/hooks"]`, untouched.** Import-following typechecks everything the ported graph reaches; narrowing the exclude buys nothing and risks pulling still-Qwik files into `tsc`. `npm run typecheck` becomes the reachability proof (a reached Qwik file fails under Solid JSX types), backed by the ratchet grep in Verification.

2. **ESLint re-include: one combined block, `files` array enumerating every ported path.** Generalize the Snackbar-only re-include block in `eslint.config.mjs` (lines 65-74); the array grows *in the same commit* as the files it covers (never negate global ignores — flat-config trap). Per-file patterns for the two mixed dirs (`src/components/TreeNode/` keeps Qwik `TreeNodeConstruction.tsx`; `src/components/DataField/` keeps the five Qwik renderers) and for the individual ported hooks in `src/hooks/`. Final array in Step 5.

3. **Hook signatures: `Accessor<T>` in, accessors out (Solid idiom).** Hooks stay `.ts`, JSX-free (Vitest has no Solid transform; Phase I discipline). Contracts:
   - `useElementChildren(parentId: Accessor<string | null>, filter: ChildKindFilter): { children: Accessor<Element[]>; isLoading: Accessor<boolean> }`
   - `useElementById(id: Accessor<string>): { element: Accessor<Element | null>; isLoading: Accessor<boolean> }`
   - `useLensGather(ownerId: Accessor<string>, targetKind: Accessor<Kind | null>): Accessor<Element[]>`
   - `useLensPolicy(lensEl: Accessor<Element | null>, targetKind: Accessor<Kind | null>): Accessor<LensPolicy>`
   - `useFieldValueSync<T>(fieldId: string, setValue: (value: T | null) => void): void` (fieldId non-reactive, as today)
   - `useDoubleTap(options?: UseDoubleTapOptions): { checkDoubleTap: (x: number, y: number) => boolean }` (now synchronous — no QRL await)

   Call sites pass thunks: `useElementById(() => props.parentId)`. Lifecycle pattern for the bus hooks: `createEffect` reads the tracked accessors once into locals, subscribes to `storageEventBus` **before** the first load (load-bearing ordering, kept — events during startup sync must not be missed), registers `onCleanup` (unsubscribe + clear debounce timer). Effect re-run on tracked change = fresh subscription + reload, exactly the Qwik `track` semantics. Debounces carry unchanged: `RELOAD_DEBOUNCE_MS = 30` (children), inline 50ms (lens gather, KindAdornment), none (by-id, value sync). `getElementQueries()`/`getDefinitionQueries()` stay called *inside* the async bodies, never captured (init-race discipline).

4. **`useAsyncOperation` is not ported.** Its only would-be Solid consumer is `useElementChildren`; inline a `createSignal(false)` + try/finally there. The Qwik file stays in place untouched (still imported by unported Qwik hooks); dies at mop-up or gets a Solid rewrite if Phase III wants one.

5. **`useDoubleTap` rides along now** (meta-plan roster puts it in III, but `EllipsisButton` — squarely in the Phase II display family — needs it). The pure `detectDoubleTap` + `DOUBLE_TAP_*` constants ship **byte-identical** (`doubleTap.test.ts` imports them; stays green); only the hook wrapper flips: three `useSignal`s become one plain mutable `TapState` closure variable, `checkDoubleTap$` → synchronous `checkDoubleTap`. Gesture constants keep per meta-plan §10.

6. **`useFieldValueSync` is ported now, dormant** (meta-plan §6 names "value sync" in Phase II). Consumers are the five Phase III renderers only, so import-following typecheck won't reach it until Phase III; the ESLint re-include does lint it. Accepted and noted in its doc comment.

7. **Stale-async guard in the loader hooks.** Solid effects capture values (vs Qwik re-reading `.value` at QRL run time), so an in-flight load from a previous `parentId` could land after navigation. Each effect keeps `let disposed = false`, sets it in `onCleanup`, and the async loader skips its `set*` calls when disposed. Cheap, idiomatic, closes a race Qwik only dodged accidentally.

8. **DataField Phase II slice: rewrite `DataField.tsx` in place as Solid, display-only.** Keeps the row chrome byte-compatible (wrapper classes, chevron with `aria-expanded`/`aria-label`, label, value-shape law `manifest.ownValue?.shape ?? 'scalar'`). The chevron **stays wired** to `toggleFieldDetailsExpanded` — FSM action + uiPrefs persistence work read-only, aria/classes flip — but no `DataFieldDetails` mounts (`TODO(Phase III)`). Renderer invoked via `<Dynamic component={manifest().Renderer} …/>` with the new `FieldRendererProps` contract: `rootRef={() => {}}` (no-op, `// TODO(Phase III): outside-click root`), no `onUpdated`. The stub renderers arrive through the registry — every kind displays a formatted read-only value for free.

9. **TreeNode orchestrator keeps the discriminated union; the construction branch returns `null`.** `types.ts` flips `PropFunction` → plain function types on **both** arms (`onNodeClick?: () => void`, `onNavigateUp?: (parentId: string | null) => void`, `onCancel: () => void`, `onCreate: (payload: CreateNodePayload) => void`), keeps `TreeNodeConstructionProps` and both type guards (Phase IV re-consumes them; `appState.types.ts`'s type-only import keeps working). `TreeNode.tsx` must NOT import `TreeNodeConstruction` — the branch is `null /* TODO(Phase IV): mount TreeNodeConstruction */`, tested inside the JSX expression so the `props.nodeState` read stays tracked.

10. **DataCard: drop the `actions` slot.** Solid slots are just props; Phase IV adds an optional `actions?: JSX.Element` when construction actually feeds it. `{/* TODO(Phase IV): actions prop for UC-mode buttons (was <Slot name="actions"/>) */}`.

11. **List rendering: `<For>` throughout** (drop Qwik `key=`). Accepted semantics: bus reloads produce fresh `Element` objects, so `<For>` (reference-keyed) recreates all rows per reload. Harmless read-only — expanded state lives in the FSM keyed by id, except `NavigableRow`'s local `expanded` signal, which resets on reload (matches "roughly live" tolerance). Flag for Phase III: if edit-focus churn appears, revisit with id-keyed mapping.

12. **Verification data: DEV-gated console hook in `App.tsx`** (user-approved). After `initializeStorage()` in `onMount`, `import.meta.env.DEV`-gated `window.__cmm = { execute, queries }` wrapping `getCommandBus()`/`getElementQueries()`. Migration verification tooling in an already-ported file, `TODO(mop-up): remove`. Not in devTools/sync files (feature freeze). Full seeding script in Verification; a pre-existing populated IndexedDB on the origin also works but isn't relied on.

13. **Commit structure: five green commits**, hooks → leaf chrome → field row → TreeNode family → views+App. Works because files are rewritten in place and nothing makes them reachable from the typechecked/bundled graph until commit 5 wires `App.tsx`; ESLint (per-file, not import-following) polices each commit's files via the re-include growing alongside. Per-commit gate: `lint` + `test` green (run typecheck too; it only meaningfully bites at commit 5). Still-Qwik consumers of rewritten hooks (`LensCreate`, the four `useFieldValueSync` renderers, `EnumKvField`'s `useDoubleTap`) become internally inconsistent — harmless: excluded from build/typecheck/lint, rewritten in III/IV anyway.

14. **Uniform idiom flips:** `component$` → plain function; `$` handlers → closures; `useSignal` → `createSignal`; `useComputed$` → `createMemo` (or plain thunks for cheap derivations); `useVisibleTask$` → `createEffect` + `onCleanup`; `.value` → accessor calls; `.map()`+`key` → `<For>`; `class={[...]}` truthy arrays → `classList={{…}}`; `<Slot/>` → `props.children`; never destructure props; loading early-returns become `<Show>` wrappers. DOM structure, CSS-module classes, global classes (`view-root`, `view-branch`, `branch-parent-row`, `branch-parent-node`, `branch-children`, `branch-child-row`, `no-caret`), aria-labels and visible text carry **unchanged** (meta-plan §2 scope guard — the Cypress contract selectors depend on it).

15. Use **context7** during implementation for current solid-js idioms where unsure (`Dynamic`, `<For>`/`<Index>`, effect/cleanup patterns).

## Steps

### 1. Read-path hooks on Solid primitives (commit 1)

All rewritten in place, all stay `.ts`/JSX-free. Imports of the Qwik-free deps (`storageEventBus`, `storageEventRelevance`, `effectiveChildren`, `capabilityEngine.gatherDescendants`, `lensPolicy`, `placement`, `userContext`, queries, `initStorage`) unchanged.

- **`src/hooks/useDoubleTap.ts`** — keep `detectDoubleTap`, `TapState`, `DOUBLE_TAP_THRESHOLD_MS/SLOP_PX`, `UseDoubleTapOptions` byte-identical. Replace the hook: one closure `let state: TapState = {…}`; `checkDoubleTap(x, y)` calls `detectDoubleTap(state, x, y, Date.now(), …)`, stores next state, returns the boolean. Drop the Qwik import.
- **`src/hooks/useElementChildren.ts`** — both hooks per decision 3. Skeleton for `useElementChildren`:
  ```ts
  const [children, setChildren] = createSignal<Element[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  createEffect(() => {
      const pid = parentId();            // tracked read, once, into a local
      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const load = async () => {
          await initializeStorage();
          setIsLoading(true);
          try {
              const q = getElementQueries(); // runtime lookup inside the async body — never captured
              const els = pid === null ? await q.getRootElements() : await q.getChildren(pid);
              const effective = effectiveChildren(els, getCurrentUserId());
              if (!disposed) setChildren(effective.filter(e => (filter === 'nodes') === isReRoot(e.kind)));
              console.log('[useElementChildren] Loaded', …);
          } finally { setIsLoading(false); }
      };
      const unsub = storageEventBus.subscribe((event) => {
          if (!affectsChildrenOf(event, pid)) return;
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => { timer = null; void load(); }, RELOAD_DEBOUNCE_MS);
      });
      onCleanup(() => { disposed = true; unsub(); if (timer !== null) clearTimeout(timer); });
      void load();                        // subscribe-before-first-load preserved
  });
  ```
  Keep `RELOAD_DEBOUNCE_MS = 30`, the `[useElementChildren] Loaded` console line, and the doc comments (update the Qwik-mechanics sentences). `useElementById`: same skeleton, no debounce, relevance `affectsElement`, refetch via `getElementById` (event payload lacks subtitle — keep that comment).
- **`src/hooks/useLensGather.ts`** — same skeleton; tracked locals `oid`/`tk`; early `setGathered([])` + return when either falsy; subscribe to **all** bus events (deliberately no relevance filter — keep the comment), inline 50ms debounce; `disposed` guard.
- **`src/hooks/useLensPolicy.ts`** — `createSignal<LensPolicy>({ entryLabel: '', staleness: 0 })`; `createEffect` reads `lensEl()?.definitionId ?? null` and `targetKind()` (the two tracked deps, exactly the Qwik `track`s); if no `tk` return; set fallback policy (`resolveLensPolicy(null, getKindManifest(tk).pickerLabel)`) synchronously; if `definitionId`, async fetch of the Definition → `resolveLensPolicy(def?.config ?? null, fallback)` with `disposed` guard. **Deliberately no bus subscription** (Definitions are fork-not-mutate; keep that doc comment; do not add one).
- **`src/hooks/useFieldValueSync.ts`** — per decisions 3/6: subscribe immediately at hook call (no effect — nothing is tracked), `onCleanup(unsub)`, patch via `setValue((event.element.value as T | null) ?? null)` on matching `ELEMENT_WRITTEN`. Doc comment: consumers arrive in Phase III.
- **Untouched:** `useAncestorPath.ts`, `useSyncTrigger.ts` (already Qwik-free), `useAsyncOperation.ts` (Qwik, orphaned from the ported graph — decision 4). Edit/create hooks (`useFieldEdit`, `useFocusManager`, `useEditableValue`, `useNodeCreation`, `usePendingForms`, `useDefinitionDraft`) untouched.
- **`eslint.config.mjs`**: convert the Snackbar block into the combined ported-paths block; add `src/hooks/{useElementChildren,useLensGather,useLensPolicy,useFieldValueSync,useDoubleTap,useAncestorPath}.ts`.
- Gate: `lint` + `test` (canary: `doubleTap.test.ts`). Commit.

### 2. Leaf display chrome (commit 2)

All in place, Solid, same DOM/classes/aria/text:

- **`src/components/UpButton/UpButton.tsx`** — props `{ parentId: string | null; onNavigate: (parentId: string | null) => void }`; keep `e.stopPropagation()`.
- **`src/components/EllipsisButton/EllipsisButton.tsx`** — props `{ onDoubleTap?: () => void; isExpanded?: boolean }`; uses ported `useDoubleTap` (pointerdown handler now synchronous); keep stopPropagation on pointerdown/click and the Enter/Space keydown path.
- **`src/components/NodeTitle/NodeTitle.tsx`**, **`src/components/NodeSubtitle/NodeSubtitle.tsx`** — trivial flips (they share `TreeNode.module.css`, unchanged).
- **`src/components/DataCard/DataCard.tsx`** — props `{ isOpen?: boolean; children: JSX.Element }`; `classList` for open states; `{props.children}` replaces `<Slot/>`; actions slot dropped per decision 10.
- **`src/components/TreeNodeDetails/TreeNodeDetails.tsx`** — props `{ nodeId: string; isOpen?: boolean; children: JSX.Element }`; same wrapper/inner structure.
- **`src/components/Breadcrumbs/TreeBreadcrumbs.tsx`** — `const path = createMemo(() => useAncestorPath(props.nodeId));` wrapped in `<Show when={path().length > 0}>`; `<For each={path()}>` with `(segment, index)`, `isCurrent = () => index() === path().length - 1`; ancestor `<button onClick={() => navigateToNode(segment.id)}>` (actions from `useAppTransitions()`), current segment a `<span>`. (Same staleness semantics as Qwik: nodeIndex mutations don't re-render — only `nodeId` changes do.)
- **`eslint.config.mjs`**: add `src/components/{UpButton,EllipsisButton,NodeTitle,NodeSubtitle,DataCard,TreeNodeDetails,Breadcrumbs}/**/*.{ts,tsx}`.
- Gate: `lint` + `test`. Commit.

### 3. Field row: DataField display slice + FieldList + NavigableRow (commit 3)

- **`src/components/DataField/DataField.tsx`** — in-place Solid rewrite per decision 8. Props:
  ```ts
  export type DataFieldProps = { id: string; name: string; definitionId: string; kind: Kind; value: DataFieldValue | null; updatedAt?: number };
  // TODO(Phase III): restore onUpdated
  ```
  Body: `const manifest = createMemo(() => getInlineManifest(props.kind));` `const shape = () => manifest().ownValue?.shape ?? 'scalar';` details-expanded thunk off `selectors.getDataFieldDetailsState`; chevron `onClick={() => toggleFieldDetailsExpanded(props.id)}` with the same aria strings; label shown per the shape law; body:
  ```tsx
  <Dynamic component={manifest().Renderer} id={props.id} definitionId={props.definitionId} value={props.value} updatedAt={props.updatedAt} rootRef={() => { /* TODO(Phase III): outside-click root */ }} />
  ```
  Where `DataFieldDetails` mounted: `{/* TODO(Phase III): mount <DataFieldDetails> + delete (commitWithUndo DELETE_ELEMENT/RESTORE_ELEMENT) */}`. Imports limited to solid-js (+`Dynamic` from `solid-js/web`), appState, registry, model types, CSS module — **not** `DataFieldDetails`, `commitWithUndo`, `getCommandBus`, or any Qwik renderer.
- **`src/components/FieldList/FieldList.tsx`** — keep the full `FieldListProps` type (incl. `isConstruction?`, `initialDefinitionIds?`, `hideAddSurfaces?` — Phase IV call sites reuse it). `const { children: fields } = useElementChildren(() => props.nodeId, 'fields');` `<For each={fields()}>` → `<DataField …/>`. **Delete the `FieldComposerSlot` and `CreateDataField` imports and both blocks entirely**, plus the now-unused `activeSurface` mutex and `maxPersistedCardOrder` memo: `{/* TODO(Phase IV): add-field surfaces (FieldComposerSlot / CreateDataField), activeSurface mutex, maxPersistedCardOrder */}`.
- **`src/components/NavigableRow/NavigableRow.tsx`** — `createSignal(false)` for expanded; name `<span role="button" tabIndex={0}>` with click/Enter/Space → `navigateToNode(props.id)`; chevron toggles; `<Show when={expanded()}>` → `<FieldList nodeId={props.id} hideAddSurfaces />`.
- **`eslint.config.mjs`**: add `src/components/DataField/DataField.tsx` (per-file — the five renderers stay Qwik), `src/components/{FieldList,NavigableRow}/**/*.{ts,tsx}`.
- Gate: `lint` + `test`. Commit.

### 4. TreeNode display family (commit 4)

- **`src/components/TreeNode/types.ts`** — per decision 9: drop the Qwik import; `onNodeClick$`→`onNodeClick`, `onNavigateUp$`→`onNavigateUp`, `onCancel$`→`onCancel`, `onCreate$`→`onCreate` as plain function types; everything else (union, guards, `DisplayNodeState`, `TreeNodeState`, `ConstructionField`, `CreateNodePayload`) byte-identical.
- **`src/components/TreeNode/KindAdornment.tsx`** — props `{ id: string; isParent: boolean }` (kept for call-site parity). `useElementById(() => props.id)`; `createEffect` tracking `element()`: null/non-`derivation-chip` → reset + return; else subscribe-all with 50ms debounce, regather = `gatherDescendants(el.id, getElementQueries())` filtered `isReRoot(e.kind) && !isProvisionedLens(e.kind)`, `disposed` guard, `onCleanup`. Render `<Show when={element() && nodeRenderMode(element()!.kind).mode === 'derivation-chip'}>` → same chip span, same "N descendant(s)" text.
- **`src/components/NodeHeader/NodeHeader.tsx`** — display-only props (id, titleId, isExpanded?, isDetailsExpanded?, isParent?, isClickable?, name, subtitle, parentId?, onNodeClick?, onNavigateUp?, onExpand?, onDetailsToggle?, showChevron?). `// TODO(Phase IV): construction props (isConstruction, nameInputRef, subtitleInputRef, onKeyDown, onNameInput, chevronDisabled) + the input branch`. The construction ternary collapses to the display branch (NodeTitle + NodeSubtitle + KindAdornment); UpButton wiring, EllipsisButton, chevron (`showChevron !== false`, `'▾' : '◂'`, aria strings) all carry; keydown handlers as plain closures.
- **`src/components/LensRollup/LensRollup.tsx`** — `useElementById(() => props.lensId)`; `ownerId = () => lensEl()?.parentId ?? ''`; `useLensGather(ownerId, () => props.targetKind)`; `useLensPolicy(lensEl, () => props.targetKind)`; `entryLabel` fallback to `getKindManifest(props.targetKind).pickerLabel`; `newestUpdatedAt` memo; `isStale = () => isLensStale(newestUpdatedAt(), policy().staleness, Date.now())`. Header `{entryLabel()} ({gathered().length})` + `<Show>` stale badge; `<For>` of `NavigableRow`; "none yet" empty div. **Omit `LensCreate`**: `{/* TODO(Phase IV): <LensCreate ownerId targetKind entryLabel> */}`.
- **`src/components/TreeNode/TreeNodeDisplay.tsx`** — derivations as thunks (`isExpanded`, `isDetailsExpanded` off selectors + store; `renderMode`/`lensTargetKind`/`isLens`/`ownsChildren`/`showDataCard` off `props.kind`; `--datacard-indent` style var). Structure unchanged: `TreeNodeDetails` (TreeBreadcrumbs + "Node Details" h3 + muted div) → `NodeHeader` → `<Show when={showDataCard()}>` → `DataCard` with `FieldList nodeId isConstruction={false}` (when `ownsChildren()`) and `LensRollup` (when lens and not PARENT). **Omit the Delete Asset button, its actionsRow div, and the `commitWithUndo`/`getCommandBus` imports**: `{/* TODO(Phase III): Delete Asset (commitWithUndo + DELETE_ELEMENT/RESTORE_ELEMENT + navigateUp) — edit path */}`.
- **`src/components/TreeNode/TreeNode.tsx`** — keep the type re-exports; construction branch `null /* TODO(Phase IV): <TreeNodeConstruction> — must not be imported before then */`, else `<TreeNodeDisplay …/>`; branch test inside the JSX expression. `TreeNodeConstruction.tsx` untouched, stays Qwik, stays unimported.
- **`eslint.config.mjs`**: add `src/components/TreeNode/{types.ts,TreeNode.tsx,TreeNodeDisplay.tsx,KindAdornment.tsx}` (NOT `TreeNodeConstruction.tsx`), `src/components/{NodeHeader,LensRollup}/**/*.{ts,tsx}`.
- Gate: `lint` + `test`. Commit.

### 5. Views + App wiring + verification hook (commit 5 — the graph becomes reachable)

- **`src/components/views/RootView.tsx`** — no props. `useElementChildren(() => null, 'nodes')`; `displayNodes = createMemo(() => nodes().filter(n => !isLensSurfaced(n.kind)))` (no UC filtering — nothing mints UC nodes yet). Loading guard as `<Show when={!(isLoading() && nodes().length === 0)} fallback={<main class="view-root">Loading...</main>}>`; `<For each={displayNodes()}>` → display `<TreeNode … nodeState={selectors.getDisplayNodeState(appState, n.id)} onNodeClick={() => navigateToNode(n.id)} />`. `{/* TODO(Phase IV): UC TreeNode (namespaced-key note carries) + <CreateNodeButton variant="root"> (useNodeCreation) */}`. Drop `useNodeCreation`/`CreateNodeButton` imports.
- **`src/components/views/BranchView.tsx`** — props `{ parentId: string }` (never destructure). `useElementById(() => props.parentId)`; `useElementChildren(() => props.parentId, 'nodes')`; memos `parentNode` (isReRoot check), `lensTargetKind` (via `nodeRenderMode`), `ownerId = () => parentEl()?.parentId ?? ''`; `useLensGather(ownerId, lensTargetKind)`; `useLensPolicy(element, lensTargetKind)`. Loading guard `<Show when={!isLoading() && parentNode()} fallback={<main class="view-branch">Loading...</main>}>`. Parent row: `<TreeNode … nodeState="PARENT" parentId={parentNode()!.parentId} onNavigateUp={navigateUp} />` in the same `branch-parent-row`/`branch-parent-node` divs. Children region `<Show when={lensTargetKind()} fallback={normal}>`: lens branch `<For each={derivedJobs()}>` CHILD TreeNodes + `{/* TODO(Phase IV): <LensCreate> */}`; normal branch `<For each={children().filter(c => !isLensSurfaced(c.kind))}>` CHILD TreeNodes + `{/* TODO(Phase IV): UC block + <CreateNodeButton variant="child"> */}`. Omit the construction-cancel `useTask$` (`{/* TODO(Phase IV): cancel in-flight construction on parentId change */}`), `useNodeCreation`, `LensCreate`, `CreateNodeButton`, `reRootCreateKindsFor` imports.
- **`src/App.tsx`** — replace the placeholder `<p>`s:
  ```tsx
  <Show when={selectors.isRootView(appState.state)} fallback={<BranchView parentId={selectors.getCurrentNodeId(appState.state)!} />}>
      <RootView />
  </Show>
  ```
  In `onMount` after `initializeStorage()` (decision 12, user-approved):
  ```ts
  if (import.meta.env.DEV) {
      // Phase II migration-verification tooling: creation surfaces land in Phase IV,
      // so expose the command bus for console seeding. TODO(mop-up): remove.
      (window as unknown as Record<string, unknown>).__cmm = {
          execute: (cmd: Command) => getCommandBus().execute(cmd),
          queries: () => getElementQueries(),
      };
  }
  ```
- **`eslint.config.mjs`**: add `src/components/views/**/*.{ts,tsx}`. Final combined `files` array: `src/components/Snackbar/**/*.{ts,tsx}`, `src/components/views/**/*.{ts,tsx}`, `src/components/{Breadcrumbs,DataCard,EllipsisButton,FieldList,LensRollup,NavigableRow,NodeHeader,NodeSubtitle,NodeTitle,TreeNodeDetails,UpButton}/**/*.{ts,tsx}`, `src/components/DataField/DataField.tsx`, `src/components/TreeNode/{types.ts,TreeNode.tsx,TreeNodeDisplay.tsx,KindAdornment.tsx}`, `src/hooks/{useElementChildren,useLensGather,useLensPolicy,useFieldValueSync,useDoubleTap,useAncestorPath}.ts`.
- Gate: full Verification battery below. Commit.

## Verification

1. `npm run typecheck` → 0 errors. This is the reachability proof: the whole view graph is typechecked by import-following; any accidentally reachable Qwik file fails under Solid JSX types.
2. `npm run test` → all Vitest files green (39). Canaries: `doubleTap.test.ts` (pure fn untouched), `appState.test.ts`, `storageEventRelevance`, `lensPolicy`, `kindCoherence`/`placement`.
3. `npm run lint` → 0 errors. Spot-check: `npx eslint --print-config src/components/views/BranchView.tsx` shows `solid/*` at error; `--print-config src/components/TreeNode/TreeNodeConstruction.tsx` shows none.
4. Ratchet grep: `grep -rl "@builder.io" src` → only the Phase III/IV remainder: `src/components/{CreateDataField,CreateNodeButton,DataFieldDetails,DataFieldHistory,FieldComposer,LensCreate,LensCreateButton}/**`, `src/components/DataField/{TextKv,EnumKv,NumberKv,SingleImage,AssetDoc}Field.tsx`, `src/components/TreeNode/TreeNodeConstruction.tsx`, `src/hooks/{useAsyncOperation,useDefinitionDraft,useEditableValue,useFieldEdit,useFocusManager,useNodeCreation,usePendingForms}.ts`. None of the Step 1–5 files may appear.
5. **Dev boot + console seeding.** Boot per Phase I discipline: DevTools Network → Offline, or `npm run emulator` + `http://localhost:5173/?emulator=true` — never against production Firestore. Expect: ROOT "Loading..." then an empty `view-root` main, storage-init logs, `window.__cmm` defined. Seed from the console (command shapes verified against `src/data/commands/types.ts`; `getCommandBus().execute` returns the created `Element`; definition ids from `src/data/definitionIds.ts`; provisioned jobs/logbook lenses arrive automatically on container-node creation):
   ```js
   const { execute } = window.__cmm;
   const truck = await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'node', parentId: null, name: 'Truck 42', subtitle: 'Bay 3' } });
   await execute({ type: 'CREATE_ELEMENT_FROM_DEFINITION', payload: { parentId: truck.id, definitionId: 'fd_description', initialValue: 'Big red truck' } });
   await execute({ type: 'CREATE_ELEMENT_FROM_DEFINITION', payload: { parentId: truck.id, definitionId: 'fd_status', initialValue: 'In Service' } });
   await execute({ type: 'CREATE_ELEMENT_FROM_DEFINITION', payload: { parentId: truck.id, definitionId: 'fd_weight', initialValue: 12000 } });
   const engine = await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'node', parentId: truck.id, name: 'Engine', subtitle: 'V8' } });
   await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'log-entry', parentId: truck.id, name: 'Oil change' } });
   await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'job', parentId: truck.id, name: 'Replace filter' } });
   const org = await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'org', parentId: null, name: 'Fleet North', subtitle: '' } });
   await execute({ type: 'CREATE_ELEMENT', payload: { kind: 'node', parentId: org.id, name: 'Depot A', subtitle: '' } });
   ```
   (A pre-existing populated IndexedDB on the origin works too; the hook is the path that doesn't depend on it.)
6. **Manual read-path walk** (the read-only slices of the behavior contract, cf. `lens-loop.cy.ts` display assertions):
   - ROOT shows Truck 42 (subtitle "Bay 3") and Fleet North; the bus reload appears live as you seed (30ms-debounced `[useElementChildren] Loaded` logs — a multi-create burst coalesces).
   - Fleet North shows the "1 descendant" KindAdornment chip (org = derivation-chip; count excludes provisioned lenses).
   - Click "Open Truck 42" → BranchView: PARENT card with Up button; children Engine + Jobs + Logbook; Up returns to ROOT; breadcrumbs in the ellipsis details panel navigate (double-tap ⋮ → panel; ancestor click re-roots). No Delete Asset button (Phase III).
   - Expand Truck's chevron → DataCard with Description/Status/Weight rows via the stub renderer ("Big red truck", "In Service", "12000" — unformatted; real renderers are Phase III). Field chevrons toggle aria-expanded but open no panel (Phase III). Expanded cards persist across reload (uiPrefs).
   - Logbook card expanded → "Entry (1)" header (bound policy Definition label), "Oil change" NavigableRow, no stale badge; row chevron peeks its (empty) FieldList; row name re-roots into the entry; Up returns. Jobs card → pickerLabel-fallback header "(1)" with "Replace filter". Re-root INTO Logbook → the entry renders as a CHILD TreeNode (lens branch of BranchView). No create affordances anywhere (Phase IV).
   - `window.__syncStatus()` still defined; no console errors.
7. Cypress: **not a gate** — all three specs still red at the runner (they create data via UI). Do not chase them.

## Project Context Management

After the coding work is believed complete, ask the user to run Verification §5–6 (seeded dev boot and the manual walk). **Only if the user confirms it works:**

1. **SOLIDJS-MIGRATION.md** — mark Phase II done (note: `useDoubleTap` rode along ahead of Phase III because `EllipsisButton` needs it; `useFieldValueSync` ported dormant; `useAsyncOperation` deliberately not ported).
2. **ISSUES.md** — nothing (migration tracked in SOLIDJS-MIGRATION.md only).
3. **IMPLEMENTATION.md** — short notes: Accessor-in/accessor-out hook contracts; the `disposed`-flag stale-async guard; the `window.__cmm` DEV seeding hook (removed at mop-up); `<For>` reference-keyed row recreation on bus reloads (revisit in Phase III if edit focus churns); DataField chevron wired but panel-less until Phase III.
4. **LATER.md** — nothing new deferred (all omissions are owned by meta-plan Phases III–IV).
