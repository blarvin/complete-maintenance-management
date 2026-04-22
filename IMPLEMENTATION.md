## Phase 1 Implementation Notes

Technical implementation details and architectural patterns. For feature scope, see SPECIFICATION.md. For feature status and detailed breakdowns, see ISSUES.md. For deferred work, see LATER.md.

---

## Critical Architectural Patterns

### Qwik Resumability and Service Registry

**Problem**: Qwik's resumability requires serializing closures captured in `$()` functions. Context-provided services can't serialize because they contain functions.

**Solution**: Module-level service registry instead of React-style context:

```typescript
// ❌ Won't work: nodes captured in closure, can't serialize functions
const { nodes } = useContext(DataContext);
const load$ = $(async () => {
  await nodes.getRootNodes();
});

// ✅ Works: nothing captured, service looked up at runtime
const load$ = $(async () => {
  await getNodeService().getRootNodes();
});
```

Services live at module scope (`src/data/services/index.ts`), swapped via `setNodeService()` for tests. This maintains Dependency Inversion Principle (components depend on `INodeService` interface) without serialization issues.

**Why This Matters**: Without this pattern, Qwik's resumability breaks—the app can't serialize state for server-side rendering.

---

### Storage Adapter Abstraction

**Pattern**: All storage operations go through `StorageAdapter` interface. Implementations include `IDBAdapter` (IndexedDB) and `FirestoreAdapter` (cloud sync).

**How It Works**:

- Services (`INodeService`, `IFieldService`) are created from adapters via `nodeServiceFromAdapter()` and `fieldServiceFromAdapter()` factories
- Default services use `FirestoreAdapter`
- `useStorageAdapter(adapter)` swaps both node and field services to delegate through any adapter
- Component-facing service contracts remain unchanged

**Why This Matters**: Enables swapping storage backends (IndexedDB/memory for tests) without touching components. Critical for testing and future backend changes.

**StorageResult Metadata**: Adapters return `StorageResult<T>` with lightweight metadata (adapter id, optional cache flag, latency). Enables future optimizations and debugging.

**StorageError Contract**: Normalized error shape with codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`), retryable flag, and helpers. Maps adapter-level failures to user-friendly messages (Snackbar integration pending).

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

**Deprecated but kept**: `INodeService` / `IFieldService` interfaces and `getNodeService()` / `getFieldService()` are marked `@deprecated` but remain for existing tests. `CreateNodeInput` is re-exported from `commands/types.ts` for backward compatibility.

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

1. **Template** (`DataFieldTemplate`) — declares `componentType` (discriminated union over the 4 Phase-1 Components: `text-kv`, `enum-kv`, `measurement-kv`, `single-image`), a human label, and per-Component `config`. Stored in its own Dexie table and Firestore collection (`dataFieldTemplates`).
2. **Instance** (`DataField`) — attaches a Template to a TreeNode with a typed `value: DataFieldValue | null`. Snapshots `fieldName` and `componentType` from the Template at creation so later Template label edits don't rewrite persisted user data.
3. **History** (`DataFieldHistory`) — discriminated union on `componentType`; `property` is always `"value"`; `prevValue` / `newValue` carry the Component's value shape (string for text/enum, number for measurement, image-metadata for single-image).

**Seeding on boot**: `src/data/services/seedTemplates.ts` writes 6 dev-Templates (Description, Type Of, Tags, Status, Weight, Main Image — one per componentType plus defaults) idempotently, guarded by a `syncMetadata.templatesSeededVersion` key. Seeds write directly to `db.templates` with no sync-queue enqueue: every client seeds identically, so propagating them as sync ops would be N redundant writes per N clients. Called from `initializeStorage()` after `initializeQueries()` but before `initializeSyncManager()` so queries are ready but the first-sync push doesn't see seed rows.

**Command shape**: writes go through `ADD_FIELD_FROM_TEMPLATE` (creates an instance of a Template on a node) and `CREATE_NODE_WITH_FIELDS` (whose `defaults` is `{ templateId }[]`). The older freeform `ADD_FIELD` is gone — there's no path to create a DataField without a Template.

**Schema v3 upgrade-clear**: `db.ts` `version(3)` upgrade function clears every table. `fieldValue` is gone from the row shape, and no migration path was worth writing for prototype data. Firestore emulator should be wiped alongside.

---

### DataField Component Dispatcher

**Pattern**: `DataField.tsx` is a thin dispatcher. It owns the row layout (chevron, label, details-expansion) and switches on `field.componentType` to render one of four per-Component renderers:

- `TextKvField.tsx` — text-kv
- `EnumKvField.tsx` — enum-kv (reuses CreateDataField's dropdown styles)
- `MeasurementKvField.tsx` — measurement-kv (with `measurementState.ts` pure function for ok/warn/alarm state)
- `SingleImageField.tsx` — single-image stub (Phase 1 placeholder only)

Sub-components render their own value column only; the dispatcher wraps them.

**Shared `rootRef`**: outside-click cancel needs to cover the entire DataField row (chevron + label + value), not just the value column. The dispatcher creates a single `Signal<HTMLElement | undefined>` and passes it down to each sub-component, which passes it into `useFieldEdit`. This is why `useFieldEdit` takes `rootRef` as an option rather than creating its own.

**Component-specific Template config is fetched inside the renderer** via `getTemplateQueries().getTemplateById()` wrapped in `useResource$`. For renderers that need the Template to compute display (enum options, measurement units/ranges), the resource is tracked on `props.templateId` so it re-fetches if the field's Template changes (rare but possible post-Phase-1).

---

### Generic `useFieldEdit<T>`

**Pattern**: `useFieldEdit<T extends DataFieldValue>` is parameterized on the stored value type T. The edit buffer is always a `Signal<string>` (user types into a text input regardless of T); callers supply `parse: (raw: string) => T | null` to convert on save and `format: (value: T | null) => string` to render for display and seed the edit buffer on begin.

- **text-kv**: identity parse/format, with `trim() === ''` → `null`.
- **measurement-kv**: `parseFloat` parse (throws on NaN, caught in `save$` → Snackbar error), `toFixed(decimals)` format. Optional `validate: (value: T | null) => void` callback rejects out-of-absolute-range values.
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

### UI Prefs Serialization

**Pattern**: Sets (`expandedCards`, `expandedFieldDetails`) stored as JSON arrays in localStorage. Converted on load/save in `uiPrefs.ts`.

**Why Arrays Not Sets**: localStorage only stores strings. Sets are converted to arrays on save, arrays converted back to Sets on load.

**Immediate Persistence**: Toggling always persists immediately—no debounce needed since localStorage writes are synchronous. No performance impact for this use case.

---

## Hook Patterns

**useNodeCreation**: Extracts duplicate creation flow from RootView/BranchView. Returns `{ ucNode, start$, cancel$, complete$ }`. Internally calls `startConstruction$` (FSM transition), then on complete calls `getNodeService().createWithFields()` (data layer).

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

**Service Testing**: Tests use the same registry abstraction as components (`getNodeService()`/`getFieldService()`). Tests can use `setNodeService()`/`setFieldService()` to swap implementations, or `useStorageAdapter()` to swap adapters. Integration tests use the real `FirestoreAdapter` against the emulator; no adapter mocks—tests exercise the real abstraction.

**Pure Function Testing**: `detectDoubleTap` is exported separately from hook for direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.

---

## Error Handling

**Pattern**: `safeAsync(operation, fallback, context)` wraps async calls with try/catch, logs with context string, returns fallback on error. Not currently applied everywhere—Firestore's offline persistence handles most failures. Becomes important when adding Snackbar error notifications.

**StorageError Contract**: Normalized error shape enables consistent error handling across adapters. Future: map to Snackbar-friendly messages via `describeForUser()` helper.
