# LATER.md — Deferred Work

Work intentionally deferred beyond Phase 1. Grouped by theme. For active issues see ISSUES.md; for product scope see SPECIFICATION.md; for architectural notes on what _is_ built see IMPLEMENTATION.md.

---

## Phase 1 Prototyping Simplifications

Scope exclusions that keep the Phase 1 MVP small:

- **Skip `virtualParents`** — focus on basic parent-child relationships only
- **Skip `componentType` and `componentVersion`** — use hardcoded DataField library
- **Skip `customProperties`** — basic node and DataField types only
- **Skip `isRequired`** — no required-field validation
- **Skip `isEditable` and `isLocked`** — all fields editable, no locking
- **Text-only DataFields** — all field values treated as text strings
- **Client-assigned timestamps** — `updatedAt` set by client; server-assigned timestamps deferred
- **Single-user** — constant `updatedBy: "localUser"`; real user identity deferred
- **Leaf-only deletion** — only leaf nodes are deletable; cascade delete deferred
- **No background progressive loading** — breadth-first lazy loading deferred

---

## Data Model & Schema

### Phase 2 TreeNode Fields

- `virtualParents: string[]` — cross-references (cables, pipes, connections)
- `componentType: string` — special node types (settings, templates); rendering variants from an allowed list
- `componentVersion: string` — for debugging and compatibility
- `customProperties: string[]` — extensibility (API keys, sources)

### Phase 2 DataField Fields

- `componentVersion: string` — for debugging
- `customProperties: string[]` — extensibility
- `isRequired: boolean` — validation flag
- `isLocked: boolean` — edit protection
- `isEditable: boolean` — permission control

### Server-Assigned Timestamps

- `TreeNode.updatedAt` and `DataField.updatedAt` assigned by server on sync
- Client keeps local monotonic clock for UX; replaces with server timestamp on ack
- Until server ack, `updatedAt` treated as pending
- Phase 1 uses client-assigned `Date.now()` via `now()` helper (already mockable)

### Tree Partitioning (Multi-Collection Support)

All records would carry `treeID` and `treeType` to support multiple independent trees per user.

**Semantics:**

- Root node: `treeID = id` (self-reference)
- Child nodes, fields, history: `treeID = parent.treeID` (inherited)
- `treeType` (Phase 1 would be fixed `"AssetTree"`; Phase 2 adds other tree kinds)
- ASSET/BRANCH view always scoped to one `treeID`
- `createNodeButton.isRoot` creates a new tree (sets `treeID = id`) and navigates to its BRANCH view

**Related follow-ups:**

- Cross-collection references and moves
- Per-collection settings and field libraries
- Multi-collection search and dashboards
- Startup migration: walk up to root and stamp `treeID` on any record missing it
- Implementation helpers: `deriveCollectionId(nodeId)`, `stampCollectionIds()`, `filterByCollection<T>(records, collectionId)`

### Breadcrumbs & Ancestor Path

Spec called for a breadcrumb in `TreeNodeDetails` (`"Ancestor1 / Ancestor2 / Parent / CurrentNode"`).

- Storage: denormalized `ancestorNamePath: string[]` on each node
- Root nodes: empty array; children inherit and append on create; recompute for descendants on reparent
- Rendering: join with `" / "` and append current `nodeName`

---

## DataField Component Library

Phase 1 `DataField.tsx` is a proto-component handling text values. Phase 2 expands into a library of typed components.

### Component Types

- **TextDataField** (current) — simple text values
- **ImageDataField** — single image with preview/upload
- **ImageCarouselDataField** — multiple images with carousel
- **NumberDataField** — numerical values with units
- **DateDataField** — date/datetime picker
- **SelectDataField** — dropdown from predefined options
- **LinkDataField** — URL with preview

### Refactoring Strategy

1. Extract shared layout/grid into `FieldRow` wrapper component
2. (Already done) Extract edit state management into `useFieldEdit` hook
3. Create `FieldValue` interface for pluggable value renderers
4. Each component type implements: display mode, edit mode, validation
5. Field type registry maps `componentType` → renderer component

Refactor when adding the second component type. Current pain points (edit FSM coupled to DataField, grid layout repeated in TreeNodeConstruction) resolve naturally during that refactor.

### Media / Image Fields

Media upload, preview, storage, and caching are out of scope for Phase 1. All fields treated as text.

### DataField Creation Enhancements

- **Typeahead filtering** on combo box — filter prefab list as user types (currently requires chevron click)
- **Dropdown flip behavior** — flip upward if insufficient space below
- **Custom entry + auto-library** — user-entered field names added to their personal library of previously used fields

### DataField Reordering UI

Spec calls for user-driven reordering within a DataCard (SPECIFICATION.md §DataField Reordering). UX TBD — drag handle, up/down buttons, or long-press + drag. Implementation will call the existing `computeCardOrderUpdates` helper (`src/data/utils/cardOrder.ts`) and write through the adapter. This is the point at which persisted gaps from deletions get compacted.

### cardOrder Compaction on Delete

Currently deleting a field leaves a gap in `cardOrder`. Display sorts ascending so the gap is invisible. Revisit only if accumulated gaps become user-visible or cause ordering surprises — then compact on delete, accepting the write cost.

---

## UI / UX

### Node Creation

**Rich Construction UI** (per spec): multiple default rows, five dropdowns for user-selected fields, Add button in row 10, Save/Cancel in row 11, empty rows skipped on save.

Phase 1 creation is minimal (Name + Subtitle); fields added post-creation from the DataCard.

### Tree Decorations

**Tree-line and branch-lines** — non-interactive CSS-only decorations inside the children container. Vertical guide slightly left of child nodes (per `ASSET_view.svg`), derived from `--child-indent` with a `--tree-line-offset`. Each child row shows a short horizontal branch. No layout impact, no pointer events.

### Navigation Enhancements

- **UpButton double-tap** navigates all the way to ROOT view
- **UpButton caching** — store `parentId` in context at instance creation rather than recomputing on each click. Benchmark cache vs. lookup for snappiness.
- **Down-tree navigation** — counterpart to UpButton for descending without tap-by-tap
- **User-configurable double-tap** — threshold and enable/disable in a future User Settings view

### CreateNodeButton Clutter

Multiple inline "Create Here" buttons (n+1 between child rows) add visual noise and tab-stop pain. Consider a single "+ Add sub-asset" that inserts relative to a selected sibling, or appends by default. Defer in-between insertion UI.

### TreeNodeDetails Beyond Delete

Phase 1 offers delete only. Add Rename and Move later; until then, edits happen in the node header and card.

### DataCard Animation Robustness

Currently, DataCard expansion repositions siblings via layout reflow (not physical push). Works because of current grid/flex structure. If page structure changes significantly and layout glitches appear, move to a model where expansion explicitly drives sibling positioning.

### Node Metadata Surface

`updatedBy` and `updatedAt` for nodes belong in **TreeNodeDetails**, not as a DataField on the DataCard. Timestamps client-assigned until server timestamps land.

---

## Destructive Operations

### Cascade Delete

Spec: "Deleting a node must handle or cascade to all children." Phase 1 allows leaf-only deletion.

- Full cascade delete (or soft-delete with implicit hiding of descendants)
- Orphan cleanup job — children of deleted parents remain in IDB, implicitly hidden; future cleanup pass removes
- Cascade delete semantics for history: no new history entries appended on cascade (descendant history preserved but hidden)

### Delete UX

- Confirmation dialog before delete
- Toast notification after delete (Snackbar)
- Undo / restore within a window
- Clarify: does Undo survive navigation? Are deletes soft until the timer elapses, or applied immediately with a restore snapshot?

### Recycle Bin / Audit-Preserving Delete

- Soft delete with restore window (user-visible recycle bin)
- Tombstone nodes that preserve history for audit
- Per-collection export before destructive ops
- Undo for last destructive action (session-level)

---

## History & Audit

Phase 1 implements minimal append-only history for `DataField.dataValue` in `dataFieldHistory`, keyed by `${dataFieldId}:${rev}` and indexed by `dataFieldId`, `updatedAt`.

### Phase 2 Expansion

- Record `fieldName` changes (label renames) with `property: "fieldName"` entries
- Optional history for other properties (e.g., `cardOrdering` moves)
- Rollback / restore to a given `rev`
- Pagination, filtering, and search within history
- Multi-user provenance with real user IDs and server-assigned timestamps
- Merge strategy guidance for sync conflicts (event-level dedupe via `id`, causal ordering)
- Pruning / archival policies for very long histories

### getFieldHistory and Soft-Deleted Fields

Currently history for soft-deleted fields is only _implicitly_ hidden (UI never requests it). Add explicit adapter check: `getFieldHistory(dataFieldId)` should return `[]` when the DataField's `deletedAt` is set. Needed for direct API use or a future restore/admin UI.

---

## Sync & Storage

### Breadth-First Quantized Background Lazy Loading

Fetch top-level TreeNodes + DataFields first, then children, then grandchildren. Each chunk is one TreeNode + its DataFields (fields fetched in parallel). Display what's loaded, continue in background. IndexedDB + browser cache for offline resilience.

Phase 1 loads eagerly; background progressive loading deferred.

### Sync Status & Pull-Applied Notifications

- Subtle sync-status indicator (e.g. "Synced · 2m ago" / "Offline" chip) — already noted in SPECIFICATION §Sync feedback.
- Snackbar toast when a background pull applies remote changes to an entity currently rendered (narrow rule to avoid chatty toasts). Successful pushes of the user's own writes stay silent.
- Snackbar toast only when `SyncQueueManager` exhausts retries for an item — otherwise sync stays silent per Phase 1.

### Export / Import

- "Export Collection (JSON)" and "Import Collection" actions
- Per-collection export before destructive ops (see Destructive Operations)

### Extract Sync System as Standalone Package (Refactoring Audit 8.3)

Package the offline sync subsystem as a reusable module — provisional name `@blarvin/offline-sync`. The pieces are already reasonably decoupled and event-driven, so the extraction is mostly a packaging exercise rather than a rewrite.

**What would move:**

- `src/data/sync/SyncManager.ts` — orchestrator
- `src/data/sync/SyncPusher.ts` — local→remote push loop
- `src/data/sync/SyncLifecycle.ts` — online/offline/interval triggers
- `src/data/sync/SyncQueueManager.ts` — queue abstraction (already extracted from IDBAdapter)
- `src/data/sync/ServerAuthorityResolver.ts` — LWW conflict resolution
- `src/data/sync/strategies/` — `FullCollectionSync`, `DeltaSync`
- `src/data/syncSubscriber.ts` — event-bus bridge (or leave as app-side glue)

**What would stay app-side:**

- `StorageEventBus` and domain event types (the package would accept a generic event stream)
- `IDBAdapter` / `FirestoreAdapter` (the package would define adapter interfaces, not implementations)
- App-specific domain models (`TreeNode`, `DataField`, `DataFieldHistory`)

**Shape of the public API (sketch):**

```typescript
interface SyncableAdapter<T> {
  /* push, pull, applyRemote, etc. */
}
interface SyncQueue {
  enqueue;
  getPending;
  markSynced;
  markFailed;
}
interface SyncStrategy<T> {
  pull(since: number | null): Promise<T[]>;
}

createSyncManager({
  local,
  remote,
  queue,
  strategies,
  resolver,
  eventStream,
});
```

**Prerequisites before extracting:**

1. Generify types — sync code currently imports `TreeNode` / `DataField` directly; these must become type parameters.
2. Finalize the adapter contract — `SyncableStorageAdapter` is close but has a few domain-shaped methods (e.g., `applyRemoteHistory`) that should become generic.
3. Decide on event transport — either accept an injected `EventBus` interface or expose hook points for the host app to wire up.
4. Decouple from app-specific conflict resolution — `ServerAuthorityResolver` assumes LWW on `updatedAt`; expose as a pluggable strategy.

**Why defer:** The current inlined form is fine for Phase 1 and there's only one consumer (this app). Extraction pays off when (a) a second project needs the same sync primitives, or (b) the sync system becomes stable enough that versioning it separately is an advantage rather than friction.

**Effort:** Medium. Most of the work is genericizing types and tightening the adapter interface; the runtime logic is already in the right shape.

---

## Refactoring & Technical Debt

### CQRS Follow-ups

- Command logging / audit middleware on CommandBus (pre/post hooks)
- Query caching / materialized views (beyond existing `nodeIndex`)
- Remove `INodeService` / `IFieldService` interface types from `services/index.ts` once no external code references them

### Structured Logger (Refactoring Audit 7.5)

Replace ad-hoc `console.log` with a lightweight logger (`src/utils/logger.ts`). Level filtering to silence debug/info in production. ~137 console statements across 27 files already use consistent `[Tag]` prefixes — migration is mechanical. Low priority: current logging works fine for dev.

### Error Handling & Resilience

Adopt `safeAsync()` from `withErrorHandling.ts` in view-layer data loads. Wraps async calls, returns fallback (empty arrays), logs with context. Low priority for Phase 1 because Firestore's offline persistence absorbs most network failures. Becomes valuable once:

1. Snackbar is implemented for user-facing error messages
2. Error monitoring (Sentry, etc.) is added
3. UI has explicit error/retry states

### File Organization Nits

- **Move `useSyncTrigger.ts`** from `src/hooks/` to `src/data/` — no longer UI-facing, only imported by `syncSubscriber.ts`. Works fine where it is; low priority.

### TailwindCSS (if adopted)

Limit to `@apply` within component CSS to keep markup uncluttered. Defer heavy utility-class usage.

---

## Resolved in Phase 1

### ✅ Accessibility & AI Agent Compatibility

Originally flagged as a risk: "Double-tap hurts accessibility/keyboard support."

Now implemented:

- Full keyboard navigation (Tab, Enter, Space, Escape)
- Semantic HTML (`<article>`, `<button>`, `<h2>`, `<label>`)
- ARIA attributes (`aria-expanded`, `aria-label`, `aria-labelledby`)
- `:focus-visible` styles for keyboard users
- AI agent compatibility — all elements appear in accessibility tree with descriptive names

See IMPLEMENTATION.md → Accessibility for details.

### ✅ Design Tokens

SPEC CSS variables implemented in `src/styles/tokens.css` with a three-layer system (primitives → semantic → component). See IMPLEMENTATION.md → CSS Architecture.
