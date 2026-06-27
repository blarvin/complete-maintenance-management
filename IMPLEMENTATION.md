## Phase 1 Implementation Notes

Technical implementation details and architectural patterns. For feature scope, see SPECIFICATION.md. For feature status and detailed breakdowns, see ISSUES.md. For deferred work, see LATER.md.

---

## Unified Element Model (in progress on `REFACTOR-single-unified-data-model`)

`TreeNode` and `DataField` are unified into a single `Element` primitive discriminated by `kind` (`"node"` for containers; the four field-kind literals for value-bearing kinds). One `elements` Dexie store and one `elementHistory` log replace the previous `nodes` / `fields` / `history` triple.

**Wipe-on-upgrade.** v7 introduces `elements` / `elementHistory` alongside the legacy stores; the legacy stores will be dropped in a v8 bump once the sync layer is retargeted. No migration path — matches the wipe pattern established by v3/v4/v5/v6.

**Composite history key.** Each `ElementHistory` row uses `${elementId}:${rev}` as its primary key with a `[elementId+rev]` compound index. `property` widens from the value-only enum to `value | name | subtitle | parentId | siblingOrder`, so renames, moves, and reorders are now logged — closing a long-standing audit gap. **Next-rev is an index seek (audit §4.2, done 2026-06-13):** `IDBAdapter.nextElementRev` reads the highest existing rev via a single `[elementId+rev]` range seek (`.between(...).last()`) rather than loading the element's whole history to take `max(rev)+1`; `createElement` skips the query entirely and writes rev 0 by construction (a fresh id has no prior history). The old `computeNextRev` array helper is gone.

**Element-shaped view props (done 2026-06-13, audit §2.4).** The view layer now speaks Element vocabulary end-to-end. The legacy `TreeNode` / `DataField` / `DataFieldHistory` types, the `elementToTreeNode` / `elementToDataField` mappers, and `projectValueHistory` are all deleted. View components consume `Element` / `ElementHistory` fields directly: `name`, `subtitle`, `siblingOrder`, `kind` (the `componentType` synonym survives only on `FieldDefinition` and `KindManifest`, where it's a real concept). Props are **flat**, not `{ element: Element }` — the construction branch (`TreeNodeConstruction`) has no persisted Element and `NodeHeader` is shared between display and construction, so a wrapper object would just be re-destructured immediately; flat renames removed every synonym with no destructuring churn. The component *names* `TreeNode` / `DataField` survive as renderer identifiers (per SPEC), only their data shapes changed.

**Uniform `siblingOrder`.** Every child (nodes and value-bearing kinds alike) is sorted by `siblingOrder` ascending. Mint assigns the next integer; midpoint insertion will renumber-the-run rather than use fractional keys (fractional deferred to LATER.md).

**FSM rename.** `ViewState.nodeId` → `elementId`, `editingFieldId` → `editingElementId`, `UnderConstructionData` gains `kind: Kind`. UIPrefs key bumped to `treeview:ui:prefs:v2` so any stale persisted expansion sets discard cleanly.

---

## Draft Store & commit-with-undo (audit §2.5/§2.6, done 2026-06-13)

**Composer draft is the single commit source.** The pending-field batch was always persisted in `localStorage` keyed by nodeId (`pendingFields:${nodeId}`); the commit logic now lives in a plain module `src/data/services/pendingDraft.ts` (`commitPendingDraft(nodeId, baseOrder)` / `discardPendingDraft(nodeId)`), not in the mounted component. `usePendingForms` is a thin Qwik layer over it. This deleted the entire handle-threading graph — three handle types (`FieldComposerHandle`, `FieldComposerSlotHandle`, `FieldListHandle`), every `handleRef` prop, and the `afterNodeCreated$` callback relayed through `CreateNodePayload`/`useNodeCreation`.

**Construction commit moved into `useNodeCreation.complete$`.** That function already had the new node's id and already cleared the draft; it now commits the draft (`commitPendingDraft(id, -1)`) right after `CREATE_ELEMENT` succeeds. No component reaches into the composer anymore.

**Write-through persistence.** Because the construction commit reads localStorage from a *different* component than the mounted composer, `setPendingValue$`/`togglePending$` now write to localStorage synchronously rather than relying on a reactive `useTask$` auto-save (which could lag the Create click by a tick). The race — whether the last keystroke flushes before Create — is browser-timing-only, so it's covered by a Cypress spec, not a unit test (ISSUES.md Tech Debt).

**`commitWithUndo` is a plain function, deliberately not `$`-suffixed.** It wraps *execute → success snackbar with Undo → error snackbar via `describeForUser(toStorageError(err))`* (six former copies). A `$` suffix makes the Qwik optimizer treat `commitWithUndo$({…})` as an implicit-QRL API and try to hoist the whole options object — but that object holds inline `$()` QRLs capturing local ids (`nodeId`, `prevVal`), which it can't. As a plain function, those `$()` args are captured in the *caller's* handler scope, exactly like the snackbar action handlers were before. The execute result is threaded into both the message builder and the undo handler, so the discard/restore variant (`FieldComposer` cancel) rides the same path as the command sites.

---

## Renderer Registry (`src/kinds/`)

The per-kind dispatch that used to be smeared across six `switch (componentType)` sites is consolidated into one manifest per value-bearing kind. `KIND_REGISTRY` (in `src/kinds/registry.ts`) maps each `ComponentType` to a `KindManifest` of `{ Renderer, ConfigForm, defaultConfig, displayPreview, pickerLabel }`, and is typed `satisfies Record<ComponentType, KindManifest>` so registering a kind and declaring it in the `ComponentType` union are checked as one act — forget a kind and it's a compile error. Consumers call `getKindManifest(type)` and render `<manifest.Renderer …>` / `<manifest.ConfigForm …>` dynamically.

**`node` is privileged, not registered.** The recursion and navigation logic is inseparable from the node kind, so `TreeNode` stays in the component layer rather than becoming just-another-renderer. The registry is keyed by the four value-bearing kinds only — node is deliberately absent.

**Uniform-props-via-cast seam.** Renderer props are near-uniform but not identical (`single-image` ignores `fieldDefinitionId`; only `number-kv` reads `updatedAt`) and config-form `onChange$` is 1-arg for text/single-image vs 2-arg `(cfg, error)` for enum/number. Rather than rewrite all eight components, each manifest bridges its component into the uniform `FieldRendererProps` / `ConfigFormProps` with one localized `as unknown as Component<…>` cast. Runtime is sound because the registry is keyed by the same discriminant that determines the value/config type; the small type-unsafety is confined to the manifest boundary.

**Files in place, no vertical-slice move (yet).** Manifests import the existing components where they already live (`components/DataField/*`, `components/FieldComposer/configForms/*`) — the cheap "name the seam" step. The full `src/kinds/<kind>/` vertical-slice reorg and the Phase-2 manifest fields (`placement` nest-vs-navigate, `nature` data-vs-reference, lazy renderers) are deferred until a second non-field surface (Logbook / Equipment Plate) forces them — see LATER.md.

**History routes through `displayPreview` (audit §4.5, done 2026-06-13).** `DataFieldHistory.formatHistoryValue`'s `switch (componentType)` is gone — history rows now call `getKindManifest(kind).displayPreview(value, config)`, the same formatter the live row uses, so the two can no longer diverge. To make this possible, `displayPreview` was widened to `(value, config?)` (the three config-free kinds ignore the second arg; a 1-arg function stays assignable), and the `number-kv` value formatting (`formatNumber` + `withAffix`) was lifted out of `NumberKvField` into `numberKvState.formatNumberKvDisplay` so both the renderer and the manifest share one implementation — history now shows fully-formatted numbers (decimals / affix / percent / currency) instead of raw `value units`. Two intentional behavior changes rode along: single-image history shows the manifest's `caption ?? '[image]'` (previously always `'[image]'`), and `DataFieldDetails` passes the FieldDefinition `config` down in place of the old precomputed `units` string.

**Label/layout are manifest flags, not kind comparisons.** `DataField`'s dispatcher previously compared `kind === 'single-image'` to suppress the label and pick the block-layout wrapper class. Those are now two `KindManifest` booleans — `hideLabel` and `blockValueLayout` — so the dispatcher learns each kind's framing from the manifest like everything else. Only `single-image` sets them `true`; the registry's `satisfies` clause forces every kind to declare both.

**`componentType` → `kind`, and `Kind` is registry-derived (done 2026-06-26, ISSUES Architecture Migration #1).** The two-tier vestige is gone: the discriminant is named `kind` everywhere (`FieldDefinition`, `KindManifest`, the four manifests, the `DataField`/`ComposerRow` dispatch, command payloads, draft state, seed rows) — there is no longer a separate `componentType` field or `ComponentType` type. `Kind` (in `models.ts`) is now **derived from the registry**: `"node" | keyof typeof KIND_REGISTRY`, via a type-only `import type { KIND_REGISTRY }` (erased at runtime, so no `models → kinds` cycle). Adding a manifest widens `Kind` automatically — a kind can't drift from its manifest. `KIND_REGISTRY` is now typed `satisfies Record<string, KindManifest>` (it *is* the source of truth for the kind set, so it no longer checks against an external union). `node` is still absent from the registry (it has no manifest until Migration #2), so `getKindManifest(kind: Kind)` owns the one node-excluding cast internally (`KIND_REGISTRY[kind as keyof typeof KIND_REGISTRY]`); call sites pass `Kind` freely and `FieldList`'s old `as ComponentType` cast is gone. This supersedes the "maps each `ComponentType`", "`satisfies Record<ComponentType, …>`", and "node is privileged, not registered" phrasing above — node stays unregistered *for now*, but `Kind` is no longer a hand-declared union. Deferring the parallel **`Value`-union** derivation (it needs a separate type-level kind→value map) to the config/value rework in Migration #2/#3 — see LATER.md.

**`node` registers; `KindManifest` is placement-discriminated (done 2026-06-27, ISSUES Architecture Migration "Widen `KIND_REGISTRY`" — *structural seam only* scope).** `node` now has a manifest (`src/kinds/node.manifest.ts`) and is a `KIND_REGISTRY` key like any other kind, so its privileged status is gone. `KindManifest` split into a `placement`-discriminated union: `InlineManifest` (field-like — keeps the full `Renderer`/`ConfigForm`/`defaultConfig`/`displayPreview`/`hideLabel`/`blockValueLayout` surface) `| ReRootManifest` (node-like — identity only: `kind`/`pickerLabel`/`mintVia`/`placement`). `Kind` (in `models.ts`) collapsed from `"node" | keyof typeof KIND_REGISTRY` to just `keyof typeof KIND_REGISTRY`, and `getKindManifest`'s node-excluding cast is gone. The five inline-only consumers (`DataField`, `DataFieldHistory`, `ComposerRow`, `FieldDefinitionAuthoringForm`, `useFieldDefinitionDraft`) now call a new `getInlineManifest(kind)` that narrows the union (throws on a re-root kind) so they keep the inline surface without hand-narrowing; `FIELD_KINDS` is derived by `placement === 'inline'` rather than hardcoded. Deliberately **out of scope** this cluster (no consumers yet): the six capability descriptors (`ownValue`/`children`/`edges`/`derivation`/`action`/`reads` + `SourceSpec`/`provision`/`container`/`coherence`) — built later with the lens / node-like kinds; and `node`'s manifest `Renderer` / `RendererProps` generalization — the Chrome-entailment cluster. This supersedes the "node is privileged, not registered" / "node is still absent from the registry" / internal-cast phrasing in the notes above.

**Dexie v9 — `fieldDefinitions` index `componentType` → `kind`.** The only store that indexed `componentType` was `fieldDefinitions` (the legacy `fields`/`templates` stores were dropped at v8); `elements` already indexed `kind`. v9 re-declares `fieldDefinitions: 'id, kind, authorId, updatedAt, deletedAt'` with the established clear-on-upgrade (no migration — prototype data wipes, syncMetadata clears so seeds re-run).

---

## Config-as-Elements (done 2026-06-27, ISSUES Architecture Migration #1)

The `FieldDefinition.config` blob is retired. A Definition is now a **`library`-tree Element** (`treeType: 'library'`, `parentId: null`, `kind` = the kind it defines, `name` = the label, `value: null`) and its config **is its child sub-field subtree**. The standalone `fieldDefinitions` Dexie table and its `config` JSON column are gone (Dexie **v10**, clear-on-upgrade).

**`FieldDefinition` is now an assembled read-model view, not a stored row.** It keeps its `.config` field, but the adapter assembles it on read from the Definition's config sub-field children — there is **no persisted derived config object** (SPEC §599). The payoff: the value renderers (`TextKvField`/`EnumKvField`/`NumberKvField`) and the four `ConfigForm`s are **unchanged** — they still read/produce a plain config object through `getFieldDefinitionById(...).config`; only persistence and assembly moved. `authorId` folds into the Definition Element's `updatedBy` (`"appDeveloper"` for seeds).

**`treeType` is a minimal `business | library` axis** on `Element` (the full four-value axis + `effectiveChildren` overlay is cluster 4). The only business-tree leak points were the `parentId: null` scans — `IDBAdapter.listRootElements` and `nextSiblingOrder(null)` now filter `treeType === 'business'` so library Definitions never surface as roots. `createElement` only mints `business` elements and validates `fieldDefinitionId` against the library Definition Element (not the dropped table); the `nodeIndex` already ignores non-`node` kinds, so Definitions never enter navigation.

**(De)serialize is `configSchema`-driven with deterministic ids.** Each field kind declares a `configSchema: ConfigSubField[]` (`{key, label, kind, disposition, options?, validate?, pack?, unpack?}`). `serializeConfig`/`assembleConfig`/`configChildId` (`src/kinds/configElements.ts`) map a config object ⇄ child Elements at id `${defId}::cfg::${key}` — deterministic, so seeds are idempotent and the inverse needs no id parsing. Sparse config stays sparse (only present keys emit a child). `pack`/`unpack` default to `config[key]` ⇄ `{[key]: value}`; only the **thresholds compound** overrides them, bundling the four flat `{lowLow,low,high,highHigh}` fields into one atomic `compound`-kind child (SPEC §596). `validateNumberKvConfig`'s threshold-ordering portion was extracted to `validateThresholds` and attached to that sub-field's `validate`; the composite validator stays in `NumberKvConfigForm` as the cross-field override.

**Three new config-only kinds — `flag` / `compound` / `string-list`.** Config decomposes into existing field kinds plus these (booleans; the thresholds object; enum `options` as one list value). They register like any kind but carry `mintVia: 'config-only'`, so `FIELD_KINDS` (now filtered by `mintVia === 'composer'`) excludes them from the authoring picker. In Phase 1 they only ever exist inside config subtrees, never as standalone Data Card rows, so their manifests use a shared stub `Renderer`/`ConfigForm` (`configFieldStub.tsx`) — full standalone-row UX is deferred (LATER.md).

**The schemas live in a Qwik-free module (`src/kinds/configSchema.ts`), not behind the registry.** This is the one non-obvious seam: importing `registry.ts` pulls the `component$` renderers into whatever imports it, and the Qwik optimizer doesn't transform those under Vitest (`component$` throws "Optimizer should replace all usages of `$()`"). Because the storage layer (`configElements` → IDB adapter → seed) needs the schemas, they had to be component-free. `configSchema.ts` imports only types + the pure `numberKvState` helpers; the manifests re-expose the same arrays as `manifest.configSchema`, and `configElements` reads `CONFIG_SCHEMAS` directly. **Rule of thumb: never import `src/kinds/registry.ts` (or a `*.manifest.ts`) from the storage layer or a unit test.**

**`disposition` is encoded, not honored.** Each sub-field carries `owned | delegated | pinned`, but nothing acts on it yet — all config lives on the Definition and is read live (delegated-like, = current behaviour). Copy-at-mint for `owned` and override-disable for `pinned` land with the cascade arbiter (cluster 7 / ISSUES #4).

**Sync — the FieldDefinition lane is retired.** Definitions are Elements, so they ride the element sync lane (`create/update-element` ops, `applyRemoteElement`, the element pull). The `create/update-fieldDefinition` ops, `pull*FieldDefinitions*`, `applyRemoteFieldDefinition`/`getAllFieldDefinitions`/`resolveFieldDefinition`, and the strategies' `fieldDefinitionsApplied` lane are all gone. `FIELD_DEFINITION_WRITTEN` survives as the "Library changed" UI signal the Composer subscribes to: emitted by `createFieldDefinition` and re-emitted by `applyRemoteElement` when a `library`/`parentId: null` Element arrives. Seeds still write directly (no enqueue, deterministic ids → identical per client); user-authored Definitions enqueue element ops and sync across devices.

---

## Critical Architectural Patterns

### Qwik Resumability and Service Registry

**Problem**: Qwik's resumability requires serializing closures captured in `$()` functions. Context-provided services can't serialize because they contain functions.

**Solution**: Module-level registry (command bus + query objects) instead of React-style context:

```typescript
// ❌ Won't work: queries captured in closure, can't serialize functions
const { elements } = useContext(DataContext);
const load$ = $(async () => {
  await elements.getRootElements();
});

// ✅ Works: nothing captured, registry looked up at runtime
const load$ = $(async () => {
  await getElementQueries().getRootElements();
});
```

The registry lives at module scope (`getCommandBus()` for writes in `src/data/commands/`, `getElementQueries()` / `getFieldDefinitionQueries()` for reads in `src/data/queries/`), swapped via `setElementQueries()` for tests. This maintains Dependency Inversion (components depend on the query/command interfaces) without serialization issues.

**Why This Matters**: Without this pattern, Qwik's resumability breaks—the app can't serialize state for server-side rendering.

---

### Storage Adapter Abstraction

**Pattern**: All domain reads/writes go through the `StorageAdapter` interface, implemented solely by `IDBAdapter` (IndexedDB via Dexie) — the single write model owning history diffing, rev minting, and sibling ordering. `FirestoreAdapter` implements only `RemoteSyncAdapter` (`applySyncItem` + pull methods): Firestore is a sync mirror, not a second CRUD backend.

**How It Works**:

- Query objects are created from adapters via `elementQueriesFromAdapter()` / `fieldDefinitionQueriesFromAdapter()` factories (`src/data/queries/index.ts`); the command bus routes through the same adapter
- `initializeQueries(adapter)` / `initializeCommandBus(adapter)` wire the active adapter (see `initStorage.ts`)
- Swapping the adapter (or calling `setElementQueries()` in tests) redirects all reads/writes without touching components
- Component-facing query/command contracts remain unchanged

**Why This Matters**: Enables swapping storage backends (IndexedDB/memory for tests) without touching components. Critical for testing and future backend changes.

**StorageResult Metadata**: Adapters return `StorageResult<T>` with lightweight metadata (adapter id, optional cache flag, latency). Enables future optimizations and debugging.

**StorageError Contract**: Normalized error shape with codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`), retryable flag, and helpers. `IDBAdapter` normalizes all failures uniformly (see Error Handling below); surfaced to users via the Snackbar.

---

### State Management: FSM via Discriminated Unions

**Pattern**: ViewState uses `{ state: 'ROOT' } | { state: 'BRANCH'; nodeId: string }` rather than separate `view` and `currentNodeId` fields.

**Why**: TypeScript's discriminated unions prevent invalid states. You can't have `state: 'BRANCH'` without `nodeId`, or `state: 'ROOT'` with a `nodeId`.

**Selectors**: Components ask "what state am I in?" via selectors (`getTreeNodeState`, `getDataCardState`) rather than storing their own state. Single source of truth prevents state drift.

**Single-Field Editing**: `editingFieldId: string | null` in AppState ensures only one DataField edits at a time. `startFieldEdit$(fieldId)` overwrites any existing value (per SPEC: "If another DataField is already editing, it is cancelled").

---

### Discriminated Union Props

**Pattern**: TreeNode accepts `TreeNodeDisplayProps | TreeNodeConstructionProps`, discriminated on `nodeState`. Type guards (`isConstructionProps`, `isDisplayProps`) narrow the union.

**Why**: Prevents passing construction callbacks to display nodes or vice versa—TypeScript catches misuse at compile time:

```typescript
export type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

// Type guard narrows in component
if (isConstructionProps(props)) {
  // TypeScript knows: props.onCancel$, props.onCreate$ exist
}
```

**Component Split Strategy**: TreeNode orchestrates, delegates to:

- `TreeNodeDisplay.tsx` — renders persisted nodes, delegates fields to FieldList
- `TreeNodeConstruction.tsx` — renders in-situ creation form
- `FieldList.tsx` — orchestrates persisted fields + pending forms

Orchestrator picks sub-component based on state.

---

### CQRS: Command/Query Responsibility Segregation

**Pattern**: Thin CommandBus dispatcher + separate query interfaces. Not a full mediator — no middleware, no logging pipeline (yet).

**Write path**: UI hooks call `getCommandBus().execute({ type: 'DELETE_NODE', payload: { id } })`. The CommandBus routes to a handler registered in `src/data/commands/handlers.ts`. Handlers call `StorageAdapter` methods directly.

**Read path**: UI hooks call `getNodeQueries().getRootNodes()` or `getFieldQueries().getFieldsForNode(id)`. Query implementations in `src/data/queries/index.ts` unwrap `StorageResult<T>` from adapter methods.

**Event emission stays in IDBAdapter**: The adapter emits `StorageEvent` after writes. The CommandBus doesn't emit events — it delegates to the adapter which handles events + sync queue. This means `applyRemoteUpdate` (sync pull path) still keeps the node index current without extra work.

**Node Index as Event Subscriber**: The in-memory `nodeIndex` (read model used by `getAncestorPath`) is updated exclusively via `nodeIndexSubscriber.ts`, which subscribes to `StorageEventBus`. Adapters no longer call `upsertNodeSummary`/`removeNodeSummary` directly. Local writes and remote sync updates both flow through the same event → subscriber path, so the index stays consistent without the write path "knowing" about the read model.

**Query layer reads from adapter directly**: No materialized views yet (beyond the existing `nodeIndex`). Queries delegate to `StorageAdapter.listRootNodes()`, etc., same as the old service layer did.

**Initialization**: `initStorage.ts` calls `initializeCommandBus(idbAdapter)` and `initializeQueries(idbAdapter)` after creating the adapter, ensuring the command bus and queries share the same adapter instance that SyncManager uses.

**Legacy service layer removed**: the old `INodeService` / `IFieldService` interfaces and `getNodeService()` / `getFieldService()` registry are gone — all reads/writes now flow through the command bus and query objects above. `CreateNodeInput` lives in `commands/types.ts`.

---

## Non-Obvious Implementation Details

### DataCard Animation: Dual-Transition Technique

**Problem**: Need content-aware height animation without explicit heights, plus slide-in effect.

**Solution**: Two synchronized CSS transitions:

1. Wrapper: `grid-template-rows: 0fr → 1fr` (height animation)
2. Inner `.datacard`: `translateY(-100%) → none` (content slides in)

Both use identical `100ms cubic-bezier(0.4, 0, 0.2, 1)` timing. The grid technique avoids setting explicit heights while remaining content-aware. Transform uses `none` (not `translateY(0)`) to avoid creating a containing block for fixed-position descendants (dropdowns).

```css
.wrapper {
  grid-template-rows: 0fr;
  transition: grid-template-rows 100ms...;
}
.wrapperOpen {
  grid-template-rows: 1fr;
}
.datacard {
  transform: translateY(-100%);
  transition: transform 100ms...;
}
.datacardOpen {
  transform: none; /* Not translateY(0) */
}
```

**Why `none` instead of `translateY(0)`**: `translateY(0)` creates a containing block, which breaks fixed-position dropdowns. `none` removes the transform entirely.

---

### Double-Tap Detection Algorithm

**Pure Function Design**: `detectDoubleTap(state, x, y, now, threshold, slop)` is a pure function returning `[isDouble, newState]`. The hook (`useDoubleTap`) wraps it with Qwik signals for state persistence across renders.

**Why Pure Function**: Enables direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**Slop Distance**: Allows slight finger movement between taps. Uses Manhattan distance (`dx <= slop && dy <= slop`) rather than Euclidean—simpler and good enough for touch tolerance. Default: 6px slop, 280ms threshold.

**Suppression Window**: After double-tap-to-save while editing, `suppressCancelUntil` prevents immediate `onBlur` from canceling the save. Set to `Date.now() + 220` on input pointerdown. Without this, the blur event fires before the double-tap is recognized, canceling the edit.

---

### Soft Deletion Implementation

**Pattern**: Both `TreeNode` and `DataField` have `deletedAt: number | null`. When `deletedAt` is set, entities are filtered from normal queries.

**Implicit Hiding**: Children of soft-deleted nodes are implicitly hidden (not cascade soft-deleted). Queries filter by `deletedAt: null` and exclude children where `parent.deletedAt !== null`. This avoids recursive queries while maintaining referential integrity.

**Sync Behavior**: Soft deletes sync normally—`deletedAt` is just another field. Remote soft deletes are applied via LWW conflict resolution. This enables delta sync to detect deletions (hard-deleted entities wouldn't appear in `updatedAt > since` queries).

**History**: DataFieldHistory entries remain linked but are implicitly hidden when the field is soft-deleted. No cascade deletion of history—preserves audit trail.

---

### Sync Architecture

**Bidirectional Sync**: Push-first (local→remote), then pull (remote→local). Ensures local changes are sent before applying remote changes.

**Sync Queue**: Local changes are enqueued in IndexedDB `syncQueue` table. Queue items processed sequentially. Failed items marked for retry. Queue survives page reloads.

**Conflict Resolution**: Last-Write-Wins (LWW) based on `updatedAt` timestamps. Server timestamps are authoritative when available. During sync, remote entity with higher `updatedAt` wins.

**Sync Strategies**:

- **FullCollectionSync**: Pulls all entities (used on startup, ensures complete reconciliation)
- **DeltaSync**: Pulls only changes since last sync (faster, used periodically)

**Protect Pending Items**: Don't delete local items that are pending push. Ensures local changes aren't lost if remote has newer version.

**Post-Sync UI Refresh (audit §2.3 + §4.4, 2026-06-11)**: One reactive model — *writes emit; readers subscribe*. Every write (local command or remote sync apply via `applyRemoteElement`/`applyRemoteFieldDefinition`) emits a per-element event on `storageEventBus` from `IDBAdapter`. Views read through `useElementChildren`/`useElementById` (`src/hooks/useElementChildren.ts`), which subscribe to the bus and reload when a relevant event lands (relevance predicates in `src/data/storageEventRelevance.ts`; 30ms trailing debounce coalesces write bursts). The former window `storage-change` CustomEvent and the `onDeleted$`/`onCreated$`/`onCommitted$` reload-callback threading were deleted — no reload callbacks are threaded through props.

**Under-construction TreeNode key must be namespaced (`uc-${id}`)**: the bus reload puts a newly created node into the view's `nodes` list while the construction card is still mounted (it's filtered from display, but present). If the UC `<TreeNode>` and the display `<TreeNode>` share the raw element id as key, Qwik's keyed reconciler identity-matches them on the completion render and *reuses the construction component instance* instead of unmounting it — the construction card sticks on screen even though the FSM cleared correctly. Namespacing the UC key (`RootView.tsx` / `BranchView.tsx`) forces a clean unmount+mount. Regression spec: `cypress/e2e/repro-create-node.cy.ts`.

**Event-Driven Sync Triggering**: Sync is triggered via `StorageEventBus` rather than manual `triggerSync()` calls in UI code. `IDBAdapter` emits typed events (`NODE_WRITTEN`, `NODE_HARD_DELETED`, `FIELD_WRITTEN`, `FIELD_DELETED`) after local CUD operations. `syncSubscriber.ts` subscribes to all events and calls `triggerSync()`, which debounces at 500ms. Remote/sync-originated operations (`applyRemoteUpdate`, `applyRemoteHistory`, `deleteFieldLocal`) do NOT emit events to avoid sync loops. UI code never calls `triggerSync()` directly.

**SyncQueueManager Extracted from IDBAdapter**: The sync queue (`getSyncQueue`, `enqueue`, `markSynced`, `markFailed`) lives in `src/data/sync/SyncQueueManager.ts` rather than on the adapter. `IDBAdapter` holds a `SyncQueueManager` instance and delegates to it. This keeps the adapter a pure storage adapter and makes the queue reusable across storage backends.

**Single offline cache (audit §2.2, 2026-06-11)**: Firestore is initialized with `memoryLocalCache()` unconditionally — Dexie + syncQueue is the app's only offline cache; Firestore is a dumb wire. `clearFirebaseIndexedDB()` remains as the console cleanup tool for orphaned SDK mirror DBs on devices that ran older builds.

**Sync retry policy (audit §4.3, 2026-06-11)**: No dedicated backoff machinery — failed queue items simply ride existing sync cycles (write-debounce, `online` event, 10-min timer) up to `MAX_SYNC_RETRIES = 5` attempts. `getSyncQueue()` returns pending + under-cap failed items; at the cap an item is parked as exhausted. On exhaustion `SyncManager` shows an error snackbar with a **Retry** action that re-arms (`requeueFailed()`: status→pending, retryCount→0, `lastError` kept for forensics) and syncs immediately. App startup also re-arms all failed items, so a missed toast isn't permanent.

**Fail-fast sync timeouts**: The Firestore SDK *never rejects* writes against an unreachable server — it buffers them and retries the transport forever — so an awaited `setDoc` hangs and would wedge the whole sync layer (`isSyncing` stuck true, every later cycle skipped). `SyncPusher` therefore races each `applySyncItem` against `SYNC_WRITE_TIMEOUT_MS` (10s); a `TimeoutError` is treated as connection-level failure and the rest of the queue is failed in lockstep (no per-item wait, items exhaust on the same cycle → one toast, not a drip-feed). Pull strategies are likewise wrapped in `SYNC_PULL_TIMEOUT_MS` (30s). Helper: `src/utils/withTimeout.ts`.

**Retry-action QRL without `$()`**: `ToastAction.handler` must be a QRL, but a module-level `$()` in `syncManager.ts` crashes every Vitest import (no Qwik optimizer in tests: "Optimizer should replace all usages of $()"). The handler lives in `src/data/sync/retryFailedSync.ts` and `syncManager.ts` wraps it with the runtime API: `qrl(() => import('./retryFailedSync'), 'retryFailedSync')` — works with and without the optimizer, captures nothing, resolves `getSyncManager()` at invoke time per the registry-getter pattern.

---

### DataField Components / Templates / Instances

**Pattern**: DataField is split into three entities:

1. **Template** (`DataFieldTemplate`) — declares `componentType` (discriminated union over the 4 Phase-1 Components: `text-kv`, `enum-kv`, `number-kv`, `single-image`), a human label, and per-Component `config`. Stored in its own Dexie table and Firestore collection (`dataFieldTemplates`).
2. **Instance** (`DataField`) — attaches a Template to a TreeNode with a typed `value: DataFieldValue | null`. Snapshots `fieldName` and `componentType` from the Template at creation so later Template label edits don't rewrite persisted user data.
3. **History** (`DataFieldHistory`) — discriminated union on `componentType`; `property` is always `"value"`; `prevValue` / `newValue` carry the Component's value shape (string for text/enum, number for number-kv, image-metadata for single-image).

**Seeding on boot**: `src/data/services/seedTemplates.ts` writes 6 dev-Templates (Description, Type Of, Tags, Status, Weight, Main Image — one per componentType plus defaults) idempotently, guarded by a `syncMetadata.templatesSeededVersion` key. Seeds write directly to `db.templates` with no sync-queue enqueue: every client seeds identically, so propagating them as sync ops would be N redundant writes per N clients. Called from `initializeStorage()` after `initializeQueries()` but before `initializeSyncManager()` so queries are ready but the first-sync push doesn't see seed rows.

**Command shape**: writes go through `ADD_FIELD_FROM_TEMPLATE` (creates an instance of a Template on a node) and `CREATE_NODE_WITH_FIELDS` (whose `defaults` is `{ templateId }[]`). The older freeform `ADD_FIELD` is gone — there's no path to create a DataField without a Template.

**Schema v3 upgrade-clear**: `db.ts` `version(3)` upgrade function clears every table. `fieldValue` is gone from the row shape, and no migration path was worth writing for prototype data. Firestore emulator should be wiped alongside.

---

### DataField Component Dispatcher

**Pattern**: `DataField.tsx` is a thin dispatcher. It owns the row layout (chevron, label, details-expansion) and switches on `field.componentType` to render one of four per-Component renderers:

- `TextKvField.tsx` — text-kv
- `EnumKvField.tsx` — enum-kv (reuses CreateDataField's dropdown styles)
- `NumberKvField.tsx` — number-kv (with `numberKvState.ts` pure function for ok/warn/alarm state)
- `SingleImageField.tsx` — single-image stub (Phase 1 placeholder only)

Sub-components render their own value column only; the dispatcher wraps them.

**Shared `rootRef`**: outside-click cancel needs to cover the entire DataField row (chevron + label + value), not just the value column. The dispatcher creates a single `Signal<HTMLElement | undefined>` and passes it down to each sub-component, which passes it into `useFieldEdit`. This is why `useFieldEdit` takes `rootRef` as an option rather than creating its own.

**Component-specific Template config is fetched inside the renderer** via `getTemplateQueries().getTemplateById()` wrapped in `useResource$`. For renderers that need the Template to compute display (enum options, number units/ranges), the resource is tracked on `props.templateId` so it re-fetches if the field's Template changes (rare but possible post-Phase-1).

---

### Generic `useFieldEdit<T>`

**Pattern**: `useFieldEdit<T extends DataFieldValue>` is parameterized on the stored value type T. The edit buffer is always a `Signal<string>` (user types into a text input regardless of T); callers supply `parse: (raw: string) => T | null` to convert on save and `format: (value: T | null) => string` to render for display and seed the edit buffer on begin.

- **text-kv**: identity parse/format, with `trim() === ''` → `null`.
- **number-kv**: `parseFloat` parse (throws on NaN, caught in `save$` → Snackbar error), `toFixed(decimals)` format. Optional `validate: (value: T | null) => void` callback rejects out-of-absolute-range values.
- **enum-kv**: doesn't use `useFieldEdit` — the dropdown pick is a one-step save, not a text-buffer edit.
- **single-image**: stub, no edit flow.

The `save$` flow: parse → validate (if provided) → `getCommandBus().execute({ type: 'UPDATE_FIELD_VALUE', ... })` → Snackbar with Undo action. Parse/validate errors surface as a Snackbar error variant and leave edit mode open.

**Preview/revert from history was removed** during the Component split — it was tightly coupled to the old monolithic `useFieldEdit` and hoisting it across the Component boundary is deferred (see ISSUES.md).

---

### Add-Field Surfaces: A/B Roster + Mutex

**Pattern**: FieldList hosts multiple "add field" UX surfaces side by side as a deliberate A/B comparison (currently `FieldComposerSlot` and the legacy `CreateDataField` dropdown; more variants planned). Which surfaces render in display mode is controlled by the `ENABLED_ADD_FIELD_SURFACES` roster in `src/constants.ts` — adding/removing a surface is a roster edit, not new conditional logic.

Coordination is a single parent-owned mutex signal: `useSignal<ActiveSurface>('none')` in FieldList. Each surface is open iff `activeSurface.value === <its own id>`, opens by writing its own id, closes by writing `'none'` — last writer wins, so opening any surface implicitly closes the rest, and that property holds for any number of surfaces. The `ActiveSurface` / `AddFieldSurfaceId` types and the full surface contract (including the post-persist reload callback) live in `src/components/FieldList/addFieldSurfaces.ts`, deliberately neutral ground so no surface imports from a competitor. Construction mode bypasses the roster: the composer is always rendered there (locked-defaults flow requires it) and ignores the mutex.

---

### Data Model Conventions

**Root Nodes**: Use `parentId: null`, not sentinel value like `"ROOT"`. Adapter queries use `where('parentId', '==', null)` directly. TypeScript type is `parentId: string | null`.

**History ID Scheme**: `${dataFieldId}:${rev}` composite key. `rev` is monotonic per field (0 on create, increments on update). Enables ordered history without timestamp collisions.

**Timestamps**: `Date.now()` wrapped in `now()` from `src/utils/time.ts` for future mockability. Currently client-assigned; LATER.md tracks server-assigned timestamp migration.

**cardOrder**: Auto-assigned on creation based on `nextCardOrder(parentNodeId)`. Reflects creation order (via `updatedAt`) but allows future reordering without changing all fields.

**cardOrder compaction policy**: Gaps are tolerated; the UI sorts ascending so they're invisible. Compaction (via `computeCardOrderUpdates` in `src/data/utils/cardOrder.ts`) runs only at three points:

1. **Cancel during UC** — `usePendingForms.cancel$` / empty-name `save$` resequence in-memory pending forms starting from `maxPersisted + 1`. Free (no I/O).
2. **Incoming remote field sync** — `IDBAdapter.applyRemoteUpdate('field', ...)` resequences active siblings locally using `sortByCardOrder` (cardOrder asc, id asc tiebreak). Writes are IDB-only; not enqueued to the sync queue. Two clients independently converge on the same deterministic order.
3. **Reorder UI** (future) — will call the same helper.

**Not compacted on delete**: soft-delete leaves a gap; would cost N field writes + N sync ops per delete for no user-visible benefit.

**Construction-mode field creation races**: `CREATE_NODE_WITH_FIELDS` iterates `defaults` sequentially with explicit `cardOrder: i`. A prior `Promise.all(defaults.map(createField))` raced — every concurrent call saw an empty fields table in `nextCardOrder` and returned 0, collapsing all fields to cardOrder=0.

---

### Unified Element Model — Design Rationale

> Design decided on `REFACTOR-single-unified-data-model`; **not yet built**. Captures *why*, so the choices aren't re-litigated. Migration steps live in ISSUES.md; full deliberation in `opus_chat_unified_data_model.md`.

**One primitive, many renderers.** `TreeNode` and `DataField` collapse into one `Element`. The payoff is where complexity lands: with two primitives, every new kind of thing (Job, Logbook, Equipment Plate) risks a schema change; with one, variety lives in **renderers keyed by `kind`** — pure presentation, addable without touching storage. The schema stops being the axis that proliferates.

**Why `siblingOrder` is uniform (and not `updatedAt`).** Order is an explicit, addressable scalar on every element rather than an implicit "position in the parent's array." Two reasons: (1) an explicit scalar can be *shadowed* by a future per-user override (a sparse overlay layered at read time) — an implicit position can't, without duplicating the whole array per user; (2) stable positions beat the old `updatedAt` re-sort, which reshuffled a node's siblings every time it was edited. Cost: inserting between siblings can't use plain `max+1` — the strategy is **renumber-the-run** (reassign sequential integers to the affected siblings via `computeCardOrderUpdates`), not fractional keys.

**Why history keys to the element and spans all properties.** One append-only audit spine for the whole model, not just field values. Keying to `elementId` and widening `property` to `value | name | subtitle | parentId | siblingOrder` means renames, moves (a move *is* a `parentId` change), reorders, and structural deletes are all auditable and revertible through the existing `rev`/`prev`/`new` mechanism — no second system.

---

### UI Prefs Serialization

**Pattern**: Sets (`expandedCards`, `expandedFieldDetails`) stored as JSON arrays in localStorage. Converted on load/save in `uiPrefs.ts`.

**Why Arrays Not Sets**: localStorage only stores strings. Sets are converted to arrays on save, arrays converted back to Sets on load.

**Immediate Persistence**: Toggling always persists immediately—no debounce needed since localStorage writes are synchronous. No performance impact for this use case.

---

## Hook Patterns

**useNodeCreation**: Extracts duplicate creation flow from RootView/BranchView. Returns `{ ucNode, start$, cancel$, complete$ }`. Internally calls `startConstruction$` (FSM transition), then on complete dispatches the node-creation command via `getCommandBus()` (data layer).

**useDoubleTap**: Returns `{ checkDoubleTap$ }` which takes `(x, y)` and returns boolean. Caller handles what to do on double-tap. Internal state persists across taps via Qwik signals.

**usePendingForms**: Extracts pending form management from TreeNodeDisplay. Handles localStorage persistence of in-progress field creation forms. Returns `{ forms, add$, save$, cancel$, change$ }`.

**useFieldEdit**: Extracts all edit state/interaction logic from DataField. Handles FSM integration, double-tap detection, focus management, outside-click cancellation, preview mode. Returns refs, state, and handlers. Reduced DataField from 274 to 141 lines.

---

## CSS Architecture

**Three-Layer Token System** (`tokens.css`):

1. Primitives — raw color palette (`--color-gray-600: #666`)
2. Semantic tokens — purpose-mapped (`--text-muted: var(--color-gray-600)`)
3. Component tokens — specific overrides in CSS modules

Semantic tokens used throughout; primitives never referenced directly in components. Enables future theming by overriding semantic layer.

**Utility Classes** (`global.css`):

- `.no-caret` — prevents text cursor on interactive non-input elements
- `.btn-reset` — strips button defaults (background, border, padding)
- `.input-reset` — strips input defaults for inline editing
- `.input-underline` — common underline pattern with focus color change

**Deliberate Non-Abstractions**: Evaluated and skipped these components:

- **ActionButtons component** — Cancel/Save patterns vary enough (different labels, sizing, slot usage, conditional rendering) that abstraction would be more complex than duplication.
- **Input component** — Utility classes (`.input-reset`, `.input-underline`) cover the patterns. A component would just wrap these without meaningful benefit.

---

## Testing Patterns

**Service Testing**: Tests use the same registry abstraction as components (`getElementQueries()` / `getCommandBus()`). Tests can call `setElementQueries()` to swap a mock query object, or swap the adapter to redirect reads/writes. Sync tests (`SyncPusher.test.ts`, `fieldDefinitionSync.test.ts`) mock `RemoteSyncAdapter`; no automated test currently exercises the real `FirestoreAdapter` against the emulator (see LATER.md §Emulator Round-Trip Sync Coverage).

**Pure Function Testing**: `detectDoubleTap` is exported separately from hook for direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.

---

## Error Handling

**StorageError Contract**: Normalized error shape enables consistent error handling at the write model. `IDBAdapter` wraps every public method in a single private `run()` helper implementing `try/catch → (isStorageError passthrough) → toStorageError({ code, retryable })`, with `mapDexieError` keying off the IndexedDB/Dexie `.name` (`QuotaExceededError → unavailable`, `ConstraintError → conflict`, `NotFoundError → not-found`, `DataError → validation`, etc.; unknown → `internal`). The `isStorageError` guard preserves hand-thrown `makeStorageError` validation/not-found errors from being re-wrapped. UI surfaces these via `describeForUser()` through the Snackbar (`useFieldEdit`, `DataField`). `FirestoreAdapter`'s sync methods throw raw Firestore errors; the sync layer (`SyncPusher`) catches per-item failures and marks the queue item failed rather than surfacing them to the UI.
