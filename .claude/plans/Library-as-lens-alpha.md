# Build the Library Lens

## Context

SPEC → *The Library* was rewritten this session (Library-As-Lens-Tree design, 2026-08-20) and the build item is ISSUES → Features #14. The Library is a **lens, not a place**: three new chrome kinds (`library`, `definitions`, `kinds`), three seeded Elements (`treeType: 'library'`), and **zero storage change to any Definition** — listings are pure gathers. No editing, no propagation, no config materialization, no Dexie bump, no provisioner change.

**Multi-commit: 4 slices**, each leaving `npm run typecheck` / `lint` / `test` green. Per house rules I implement and verify each slice, then hand over a proposed commit message — commits and pushes are the user's (this feature is not `[auto]`-tagged).

## Design decisions (verified against code)

- **Capabilities** (shapes confirmed in `src/kinds/types.ts:200,274-280`):
  - `library`: `children: { spec: { mode: 'template', allowedKinds: ['definitions', 'kinds'] } }` — owns exactly its two seeded children.
  - `definitions`, `kinds`: `reads: { resolver: true }` (the `internal-link` precedent, `capabilities.ts:138`). Deliberately NOT `derivation` (would leak into `isLensSurfaced`) and NOT `provision` (nothing reconciles per node). Passes `checkCoherence`.
  - All three: `mintVia: 'provision'` (never user-picked; stays out of `FIELD_KINDS`, `RE_ROOT_CREATE_KINDS`, `CONTAINER_CHILD_KINDS`; the `provision` boot check in `registry.ts:98-104` only fires for kinds with a `provision` *capability*, which these lack), `placement: 're-root'`, `KindValueMap` entries `never`.
- **Identity predicate**: one new component-free module `src/data/libraryChrome.ts` — `isLibraryChrome(kind)`, `isDefinitionRow(el)` (library root whose kind is not chrome — NOT "field-like": `fd_logbook_policy` is a Definition of kind `logbook`), `isConfigSubField(el)`, `isFieldLikeDefinitionKind(kind)` (`isInline && mintVia === 'add-surface'` — the DefinitionsIndex gather filter, drops policy + config-only kinds), `libraryIndexView(kind)`.
- **Ids**: `LIBRARY_CHROME_IDS = { root, definitions, kinds }` in `src/data/definitionIds.ts` — separate constant, NOT inside `DEFINITION_IDS`.
- **Inert preview**: `DataField` does **not** forward `pendingMode` (`DataField.tsx:94-101`), so the synthetic preview mounts `<DataField>` inside a wrapper with the HTML `inert` attribute — blocks pointer AND keyboard focus, so display-mode renderers can never fire a command against the synthetic id. `value: null` gets unfilled styling free (`DataField.tsx:73`). Config band reuses `ConfigSummary` (read-only by construction).
- **Routing**: plain kind check in BranchView via `libraryIndexView()` — no new `NodeRenderMode` variant (repo rule: hardcoded/simple; the gathers aren't expressible as `DerivationSpec` anyway). The `library` root renders as an ordinary plain branch: its two stored children arrive via `useElementChildren('nodes')`; `CreateNodeButton` self-suppresses on empty `availableKinds` (`CreateNodeButton.tsx:43`).
- **Node index**: widen to include chrome kinds (2 one-line filter edits) so breadcrumbs/internal-link work inside the Library. Requires **moving `seedDefinitions()` above `seedNodeIndexFromDb()`** in `initStorage.ts` (seeder writes `db.elements` directly, no bus emit — currently seeds at :102, index at :85, so fresh DBs would miss the chrome rows).

## Slice 1 — kinds: register the three chrome kinds

Vocabulary only; nothing reachable changes at runtime.

- New: `src/kinds/library.manifest.ts`, `definitions.manifest.ts`, `kinds.manifest.ts` — exact `jobs.manifest.ts:16-22` shape; pickerLabels "Field Library" / "Field Definitions" / "Kinds".
- Edit: `src/kinds/capabilities.ts` (3 entries), `placement.ts` (3× `'re-root'`), `mintVia.ts` (3× `'provision'`), `registry.ts` (register manifests), `src/data/models.ts` `KindValueMap` (3× `never`).
- New: `src/data/libraryChrome.ts`; `LIBRARY_CHROME_IDS` in `definitionIds.ts`.
- Tests: extend `placement.test.ts:12-24` (re-root list), `childrenPolicy.test.ts` (library allowlist is exactly the two chrome kinds — the one sanctioned provision-kind allowlist; `canHaveChildren` false for the lenses; comment update at :45-54), `provisionPolicy.test.ts:42-48` (`isProvisionedLens` false, `PROVISIONED_LENSES` still 2); new `src/test/libraryChrome.test.ts` covering all five helpers (incl. `isDefinitionRow` true for a `logbook`-kind policy root). `kindCoherence.test.ts` covers the new entries automatically.

## Slice 2 — storage: kind-aware Definition identity

Behavior-preserving until chrome rows exist; makes Slice 3 safe.

- `src/data/storage/IDBAdapter.ts` — replace five inline predicates with the helpers: `listDefinitions` (:80-82), config-child inverse (:86-90), `getDefinition` guard (:100-103), `createElement` definitionId validation (:271-276), `applyRemoteElement` DEFINITION_WRITTEN emit (:493-501).
- `src/data/sync/devTools.ts:61-80` — `__wipeDefinitions` count via `isDefinitionRow` (wipe still clears all library rows incl. chrome; seed-key reset re-seeds — correct).
- `src/components/AddFieldSurface/AddFieldSurface.tsx:314-319` — revise the stale identity comment.
- Tests: extend `definitionSync.test.ts` (~:59-68): chrome row excluded from `listDefinitions`; `getDefinition(chromeId)` → null; `createElement` with chrome `definitionId` → not-found; no DEFINITION_WRITTEN when a chrome row arrives via `applyRemoteElement`.

## Slice 3 — seed + surface the Library root on ROOT

After this commit: Library pinned on ROOT, navigable to a plain branch with the two child rows.

- `src/data/services/seedDefinitions.ts` — `SEED_VERSION` 8→9; `CHROME_SEEDS` branch before the SEEDS loop (the loop hardcodes `parentId: null / siblingOrder: 0`, wrong for the children): root at `siblingOrder: -1`, children at 0/1 parented to it; same upsert transaction, no sync enqueue, no history, `updatedBy: AUTHOR_ID_APP_DEVELOPER`.
- `IDBAdapter.listRootElements` (:214-222) — widen: `parentId === null && deletedAt === null && (treeType === 'business' || kind === 'library')`; the existing `siblingOrder` sort *is* the pin. (`nextSiblingOrder` stays business-only.)
- `src/data/storage/initStorage.ts` — move `seedDefinitions()` above `seedNodeIndexFromDb()`; widen the :186 index filter with `|| isLibraryChrome(el.kind)`. Same widening in `src/data/nodeIndexSubscriber.ts:25`.
- `src/components/TreeNode/TreeNodeDisplay.tsx` — chrome guard (reads `props.kind` inside thunks — `solid/reactivity` at error): hide the Delete Asset row (:113-122) and suppress the empty-card chevron (`showDataCard` at :86) for chrome kinds.
- Tests: `seedDefinitions.test.ts` — `libraryDefs` helper becomes `isDefinitionRow`-based (counts stay 9, name list unchanged); new chrome-shape test (ids, parents, siblingOrder −1/0/1, zero sync ops); new `listRootElements` test (library root first, lens children and Definitions absent); `nodeIndexSubscriber.test.ts` (chrome enters index, `logbook`-kind library row still doesn't); `provisionBackfill.test.ts` (chrome rows accrue no `::jobs`/`::logbook`).

## Slice 4 — views: DefinitionsIndex + KindsIndex

- New `src/components/LibraryViews/DefinitionsIndex.tsx` + `.module.css`: `createResource` over `getDefinitionQueries().listDefinitions()` (chrome-excluded and name-sorted after Slice 2), filtered by `isFieldLikeDefinitionKind` (drops `fd_logbook_policy`). Per Definition: lightweight row (name + id subtitle — own markup, not `TreeNode`), then
  `<div class={styles.previewInert} inert><DataField id={'library-preview::' + d.id} name={d.label} definitionId={d.id} kind={d.kind} value={null} /></div>` and `<ConfigSummary definitionId={d.id} />`. (If TS fights the `inert` attr, use `attr:inert=""`.)
- New `src/components/LibraryViews/KindsIndex.tsx`: iterate `FIELD_KINDS` (registry import is fine in a `.tsx` view); per kind a row (`pickerLabel`) + read-only card of `CONFIG_SCHEMAS[kind]` rows with defaults from `manifest.defaultConfig()`, formatted via `configValueFormat.ts` helpers.
- `src/components/views/BranchView.tsx` — route on `libraryIndexView(parentEl().kind)` in the children container, keeping the parent-row TreeNode so Up-navigation is untouched. No change needed for the `library` root itself.
- Tests: the gather filter is covered in Slice 1; view rendering is hand-tested (repo convention keeps component rendering out of unit tests).

## Not building (explicit)

No `readOnly` on `FieldRendererProps` (inert wrapper suffices) · no `SourceSpec` population relation (ISSUES #26) · no provisioning of the chrome children (ISSUES #27) · no Dexie bump · no provisioner edits · no `LENS_NAMES`/`LENS_POLICY_DEFINITIONS` entries · no editing/propagation/materialization · no delete affordance on chrome.

## Verification

Per slice: `npm run typecheck; npm run lint; npm run test`.

Hand-test (`npm run dev`, fresh profile or `__wipeDefinitions()` + reload — SEED_VERSION 9 reseeds existing profiles):
1. ROOT: "Field Library" pinned above business roots; no chevron; no Delete Asset in its details.
2. Re-root into it → "Field Definitions" and "Kinds" rows; no create button, no add surface.
3. Field Definitions → 8 rows (9 seeds minus Logbook Policy), name-sorted, id subtitles; each card shows the kind's unfilled state; clicks/tabs into previews do nothing (zero command-bus writes in console); ConfigSummary shows sparse knobs (Weight: kg; Status: options).
4. Kinds → the `FIELD_KINDS` roster with schemas + defaults, read-only.
5. Up walks Library → ROOT; breadcrumbs render inside the Library.
6. Regression: business node create still provisions Jobs/Logbook; Add Surface Kind band still lists Definitions.

## Project Context Management

After the user confirms the hand-test:
1. **docs/ISSUES.md** — delete Features #14; note anything observed during build (bottom of section).
2. **docs/IMPLEMENTATION.md** — short note: chrome-kind identity helper (`libraryChrome.ts`), the inert-preview choice (why `inert` and not `pendingMode`/`readOnly`), the seed-order move in `initStorage`.
3. **docs/LATER.md** — nothing expected; add only if build surfaces new deferrals.
