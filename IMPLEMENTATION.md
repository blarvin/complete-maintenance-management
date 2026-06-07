## Phase 1 Implementation Notes

Technical implementation details and architectural patterns. For feature scope, see SPECIFICATION.md. For feature status and detailed breakdowns, see ISSUES.md. For deferred work, see LATER.md.

---

## Unified Element Model (in progress on `REFACTOR-single-unified-data-model`)

`TreeNode` and `DataField` are unified into a single `Element` primitive discriminated by `kind` (`"node"` for containers; the four `componentType` literals for value-bearing kinds). One `elements` Dexie store and one `elementHistory` log replace the previous `nodes` / `fields` / `history` triple.

**Wipe-on-upgrade.** v7 introduces `elements` / `elementHistory` alongside the legacy stores; the legacy stores will be dropped in a v8 bump once the sync layer is retargeted. No migration path — matches the wipe pattern established by v3/v4/v5/v6.

**Composite history key.** Each `ElementHistory` row uses `${elementId}:${rev}` as its primary key with a `[elementId+rev]` compound index. `property` widens from the value-only enum to `value | name | subtitle | parentId | siblingOrder`, so renames, moves, and reorders are now logged — closing a long-standing audit gap.

**View-model mappers, not prop reshape.** UI components keep their TreeNode/DataField-shaped props; hooks call `getElementQueries()` and project rows through `elementToTreeNode` / `elementToDataField` (in `models.ts`) before handing them to renderers. This is a defensible permanent boundary — TreeNode/DataField become view-model DTOs rather than storage types — and let the refactor land without touching every renderer. With the renderer registry now in place (below), the prop reshape to `{ element: Element }` is downgraded from "pending" to optional — the mappers can stay as the DTO seam.

**Uniform `siblingOrder`.** Every child (nodes and value-bearing kinds alike) is sorted by `siblingOrder` ascending. Mint assigns the next integer; midpoint insertion will renumber-the-run rather than use fractional keys (fractional deferred to LATER.md).

**FSM rename.** `ViewState.nodeId` → `elementId`, `editingFieldId` → `editingElementId`, `UnderConstructionData` gains `kind: Kind`. UIPrefs key bumped to `treeview:ui:prefs:v2` so any stale persisted expansion sets discard cleanly.

---

## Renderer Registry (`src/kinds/`)

The per-kind dispatch that used to be smeared across six `switch (componentType)` sites is consolidated into one manifest per value-bearing kind. `KIND_REGISTRY` (in `src/kinds/registry.ts`) maps each `ComponentType` to a `KindManifest` of `{ Renderer, ConfigForm, defaultConfig, displayPreview, pickerLabel }`, and is typed `satisfies Record<ComponentType, KindManifest>` so registering a kind and declaring it in the `ComponentType` union are checked as one act — forget a kind and it's a compile error. Consumers call `getKindManifest(type)` and render `<manifest.Renderer …>` / `<manifest.ConfigForm …>` dynamically.

**`node` is privileged, not registered.** The recursion and navigation logic is inseparable from the node kind, so `TreeNode` stays in the component layer rather than becoming just-another-renderer. The registry is keyed by the four value-bearing kinds only — node is deliberately absent.

**Uniform-props-via-cast seam.** Renderer props are near-uniform but not identical (`single-image` ignores `fieldDefinitionId`; only `number-kv` reads `updatedAt`) and config-form `onChange$` is 1-arg for text/single-image vs 2-arg `(cfg, error)` for enum/number. Rather than rewrite all eight components, each manifest bridges its component into the uniform `FieldRendererProps` / `ConfigFormProps` with one localized `as unknown as Component<…>` cast. Runtime is sound because the registry is keyed by the same discriminant that determines the value/config type; the small type-unsafety is confined to the manifest boundary.

**Files in place, no vertical-slice move (yet).** Manifests import the existing components where they already live (`components/DataField/*`, `components/FieldComposer/configForms/*`) — the cheap "name the seam" step. The full `src/kinds/<kind>/` vertical-slice reorg and the Phase-2 manifest fields (`placement` nest-vs-navigate, `nature` data-vs-reference, lazy renderers) are deferred until a second non-field surface (Logbook / Equipment Plate) forces them — see LATER.md.

**Residual switch.** `DataFieldHistory.formatHistoryValue` still switches on `componentType` — it's a units-aware *history* formatter with different single-image semantics (`'[image]'` always vs. the manifest's `caption ?? '[image]'`), so folding it into `displayPreview` would change behavior. Left intentionally.

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

**Pattern**: All storage operations go through `StorageAdapter` interface. Implementations include `IDBAdapter` (IndexedDB) and `FirestoreAdapter` (cloud sync).

**How It Works**:

- Query objects are created from adapters via `elementQueriesFromAdapter()` / `fieldDefinitionQueriesFromAdapter()` factories (`src/data/queries/index.ts`); the command bus routes through the same adapter
- `initializeQueries(adapter)` / `initializeCommandBus(adapter)` wire the active adapter (see `initStorage.ts`)
- Swapping the adapter (or calling `setElementQueries()` in tests) redirects all reads/writes without touching components
- Component-facing query/command contracts remain unchanged

**Why This Matters**: Enables swapping storage backends (IndexedDB/memory for tests) without touching components. Critical for testing and future backend changes.

**StorageResult Metadata**: Adapters return `StorageResult<T>` with lightweight metadata (adapter id, optional cache flag, latency). Enables future optimizations and debugging.

**StorageError Contract**: Normalized error shape with codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`), retryable flag, and helpers. Both adapters normalize failures uniformly (see Error Handling below); surfaced to users via the Snackbar.

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

**Post-Sync UI Refresh**: `dispatchStorageChangeEvent()` triggers components to reload data. Components listen for `storage-change` CustomEvent and refresh their queries.

**Event-Driven Sync Triggering**: Sync is triggered via `StorageEventBus` rather than manual `triggerSync()` calls in UI code. `IDBAdapter` emits typed events (`NODE_WRITTEN`, `NODE_HARD_DELETED`, `FIELD_WRITTEN`, `FIELD_DELETED`) after local CUD operations. `syncSubscriber.ts` subscribes to all events and calls `triggerSync()`, which debounces at 500ms. Remote/sync-originated operations (`applyRemoteUpdate`, `applyRemoteHistory`, `deleteFieldLocal`) do NOT emit events to avoid sync loops. UI code never calls `triggerSync()` directly.

**SyncQueueManager Extracted from IDBAdapter**: The sync queue (`getSyncQueue`, `enqueue`, `markSynced`, `markFailed`) lives in `src/data/sync/SyncQueueManager.ts` rather than on the adapter. `IDBAdapter` holds a `SyncQueueManager` instance and delegates to it. This keeps the adapter a pure storage adapter and makes the queue reusable across storage backends.

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

**Service Testing**: Tests use the same registry abstraction as components (`getElementQueries()` / `getCommandBus()`). Tests can call `setElementQueries()` to swap a mock query object, or swap the adapter to redirect reads/writes. Integration tests use the real `FirestoreAdapter` against the emulator; no adapter mocks—tests exercise the real abstraction.

**Pure Function Testing**: `detectDoubleTap` is exported separately from hook for direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.

---

## Error Handling

**Pattern**: `safeAsync(operation, fallback, context)` wraps async calls with try/catch, logs with context string, returns fallback on error. Not currently applied everywhere—Firestore's offline persistence handles most failures. Becomes important when adding Snackbar error notifications.

**StorageError Contract**: Normalized error shape enables consistent error handling across adapters. Both adapters wrap every public method in the same `try/catch → (isStorageError passthrough) → toStorageError({ code, retryable })` shape, each with a backend-specific code mapper: `mapFirestoreError` keys off `FirestoreError.code`, `mapDexieError` (in `IDBAdapter.ts`) keys off the IndexedDB/Dexie `.name` (`QuotaExceededError → unavailable`, `ConstraintError → conflict`, `NotFoundError → not-found`, `DataError → validation`, etc.; unknown → `internal`). The `isStorageError` guard preserves hand-thrown `makeStorageError` validation/not-found errors from being re-wrapped. UI surfaces these via `describeForUser()` through the Snackbar (`useFieldEdit`, `DataField`).
