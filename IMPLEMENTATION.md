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

---

### Data Model Conventions

**Root Nodes**: Use `parentId: null`, not sentinel value like `"ROOT"`. Adapter queries use `where('parentId', '==', null)` directly. TypeScript type is `parentId: string | null`.

**History ID Scheme**: `${dataFieldId}:${rev}` composite key. `rev` is monotonic per field (0 on create, increments on update). Enables ordered history without timestamp collisions.

**Timestamps**: `Date.now()` wrapped in `now()` from `src/utils/time.ts` for future mockability. Currently client-assigned; LATER.md tracks server-assigned timestamp migration.

**cardOrder**: Auto-assigned on creation based on `nextCardOrder(parentNodeId)`. Reflects creation order (via `updatedAt`) but allows future reordering without changing all fields.

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
