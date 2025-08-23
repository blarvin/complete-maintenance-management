## Phase 1 Prototyping Simplifications
- **Skip virtualParents**: Focus on basic parent-child relationships only
- **Skip componentType and componentVersion**: Use hardcoded list of available DataFields 
- **Skip customProperties**: Focus on basic node and DataField types only
- **Skip isRequired**: No "required data field" features for now
- **Skip isEditable and isLocked**: All data fields are editable for now, no "locking" features for now

## Deferred to Later Phases

### Breadcrumbs & Ancestor Path
Moved from SPECIFICATION.md → Core component hierarchy / Data Model:

- UI: `NodeTitle` renders a breadcrumb: "Ancestor1 / Ancestor2 / Parent / CurrentNode" with the current node emphasized.
- Storage: Introduce `ancestorNamePath: string[]` as a denormalized cache of ancestor names for fast breadcrumb rendering and search. Root nodes have an empty array. Children inherit and append on create; update on reparent.
- Rendering: Breadcrumb joins `ancestorNamePath` with " / " and appends the current `nodeName`.
- Business Rules: Keep consistent on moves; recompute for descendants on reparent. Not required in Phase 1.

### Reordering on Data Card
Moved from SPECIFICATION.md → DataField Management:

When a Data Field is active for editing, a small "drag handle" appears to the left of the row. The user can drag the row up or down to reorder the DataFields on the DataCard. (Implementation: Show drag handle when isEditing=true. Use HTML5 drag events for interaction. Recalculate and persist cardOrdering numbers to storage.)

Note: Reintroduce with persistent `cardOrdering` recalculation and UI affordances.

- **tree-line and branch-lines**: Non-interactive CSS-only decorations inside the children container. The Tree Line is a vertical guide positioned slightly left of child nodes (as in `ASSET_view.svg`), derived from `--child-indent` with a small offset (e.g., `--tree-line-offset`). Each child row shows a short horizontal branch from the Tree Line to the node. These elements do not affect layout or capture pointer events. (See Styling Design below)

### Image / Media Fields
Moved from SPECIFICATION.md → Example DataFields:

- Image: <IMAGE>

Note: Media upload, preview, storage, and caching are out of scope for Phase 1. All fields treated as text in Phase 1.

### Data Fetching and Sync Strategy
Moved from SPECIFICATION.md → Data Fetching Strategy:

- **Offline-First Architecture**: All data operations work against local IndexedDB first, with automatic synchronization to cloud/server when connected.
- **Breadth-first data fetching**: Fetch top-level TreeNodeRecords + DataFieldRecords first, then their children, then their children's children, etc.
- **Bidirectional Auto-Sync**: All local changes immediately persist to IndexedDB and queue for cloud/server sync when connected
- **Background Progressive Loading**: Automatically fetch tree layers breadth-first
- **Each chunk**: One TreeNode + its DataFields (DataFields are fetched in parallel)
- **Display Strategy**: Show what's loaded, continue fetching in background
- **Cache Strategy**: IndexedDB + browser cache for offline resilience
- **Conflict Resolution**: Last-write-wins with version tracking for merge conflicts between local and cloud data 

Note: Phase 1 is local-only persistence without background fetching or server sync.

### Implementation Notes (moved as-is)
Moved from SPECIFICATION.md → Implementation Notes:

1. **Storage Strategy:**
   - Primary: IndexedDB for offline-first capability
   - Future: Cloud sync with conflict resolution

2. **ID Generation:**
   - Client-generated UUIDs (v4) for offline creation
   - No dependency on server for ID assignment; server echoes client IDs

3. **Indexing Requirements:**
   - TreeNode: Index on parentId, nodeName
   - DataField: Index on parentNodeId, fieldName

4. **Data Validation:**
   - Enforce at UI component level
   - Validate before IndexedDB writes
   - Server-side validation on sync

5. **Sync & Consistency (Phase 1):**
   - Conflict Resolution: Use Last-Write-Wins (LWW) when reconciling with the cloud. The authoritative winner is the record with the highest server `updatedAt` timestamp.
   - Timestamps: All authoritative timestamps (`updatedAt`) are assigned by the server during sync. Client may keep a local monotonic clock for UX, but must replace local values with server timestamps on ack.
   - Until server ack, updatedAt may be missing; treat as pending.
   - UUID Assignment: Default to client-generated UUIDv4 for offline creation (as specified above). Server must accept and echo IDs. If server-side IDs are adopted later, use a `provisionalId` remap strategy and update both IndexedDB and in-memory state atomically.
   - Cache/UI Update Rules: Apply local optimistic updates immediately; replace local `updatedAt` with the server timestamp on ack.
   - Deletions: Treat delete as a hard delete propagated to all clients. Clients must gracefully handle missing references (prune missing `DataField` IDs from `TreeNode.dataFields`) and recompute `cardOrdering`.
   - Duplicates/Moves: For Phase 1, treat move/duplicate as delete+create without special conflict handling. LWW applies to resulting records.

### Business Rules: Cascade Delete
Original text (SPEC): "Deleting a node must handle or cascade to all children"

Note: In Phase 1, only leaf nodes are deletable. Full cascade delete will be implemented later.

### Data Model: Server-assigned timestamps and componentType
### Rich New Node Construction UI
Moved from SPECIFICATION.md → Node Creation:

- New TreeNode DataField Construction UI with multiple default rows and five dropdowns for user-selected fields; an Add button in row 10; and Save/Cancel in row 11; defaults skipped if empty.

Note: Phase 1 creation is minimal (Name + Subtitle); fields added post-creation from the DataCard.
Original excerpts:

- TreeNode.updatedAt: Server-assigned on sync
- DataField.updatedAt: Server-assigned on sync
- DataField.componentType: Special rendering type (From allowed list)

Note: In Phase 1, timestamps are client-assigned; componentType rendering types deferred.

### History & Audit Enhancements
Moved from SPECIFICATION.md → Data Model / DataFieldHistory:

- Phase 1 implements minimal append-only history for `DataField.dataValue` in a dedicated `dataFieldHistory` store, keyed by `${dataFieldId}:${rev}` and indexed by `dataFieldId`, `updatedAt`.
- Phase 2 will expand history coverage and UI:
  - Record `fieldName` changes (label renames) with `property: "fieldName"` entries
  - Optional history for other properties (e.g., `cardOrdering` moves)
  - Rollback/restore to a given `rev`
  - Pagination, filtering, and search within history
  - Multi-user provenance with real user IDs and server-assigned timestamps
  - Merge strategy guidance for sync conflicts (event-level dedupe via `id`, causal ordering)
  - Pruning/archival policies for very long histories

Note: Single-user Phase 1 uses a constant `updatedBy` (e.g., "localUser"). Real user identity and trust features deferred to Phase 2.

- Export/import add “Export Collection (JSON)” and “Import Collection” to LATER.md.

- Cross-collection references and moves
- Per-collection settings and field libraries
- Multi-collection search and dashboards
- Implementation helpers to add:
  deriveCollectionId(nodeId): string
  stampCollectionIds() run on startup for migration
  filterByCollection<T>(records, collectionId) for UI queries

- Soft delete/recycle bin with restore window
- Audit-preserving deletes (keep history, tombstone nodes)
- Per-collection export before destructive ops
- Undo for last destructive action

**TreeNode Entity Phase 2 Fields (Future):**
- virtualParents: string[] - For cross-references (cables, pipes, connections)
- componentType: string - For special node types (settings, templates)
- componentVersion: string - For debugging and compatibility
- customProperties: string[] - For extensibility (API keys, sources)

- **Startup migration** (dev helper): If any record lacks `treeID`, derive it by walking up to root and stamp it.

5. (Phase 2) Reordering updates cardOrdering for all affected fields
- Label (`fieldName`) rename history is deferred to Phase 2.

Data Fields are either created by Users (simple Field Name + Field Value Type) or selected from a library sourced from previous creations of the Users

- Double-tap upButton navigates all the way to ROOT view.
- UpButton should be ready for action: it should store the parentId at each instance location (context) when created, rather than a function to find this prop. Or some kind of cache? [test which is faster / snappier]
- Down-tree nav as well?

- double-tap settings and options in User Settings

- newDataField custom entry + automatic add to library

- **"Node Metadata"**: History and metadata for the node: updatedBy, updatedAt. Timestamps are client-assigned. THIS SHOULD BE IN NODE TOOLS, NOT A DATAFIELD

- Note to self: What is "Keys must exist in TreeNode table" on line 160??

- For cascade deletes, no new history entries are appended ??

- **Unique Trees**: Creating node on ROOT view sets `treeID = id`. Creating a node on ASSET view (a child node) sets `treeID = parent.treeID`.

- **Partitioning**: All records include `treeID` and `treeType` (Phase 1: `treeType` = "AssetTree").

- **Creation**:
  - Root node: `treeID = id`.
  - Child nodes/fields/history: `treeID = parent’s treeID`.

| treeID | string | Yes | Tree boundary identifier | Root: equals `id`. Children: inherited root |
| treeType | string | Yes | Tree classification identifier | Phase 1 fixed: "AssetTree" |

| componentType | string | No | Special rendering type | (Phase 2) From allowed list |
| treeID | string | Yes      | Tree boundary identifier      | Inherited root |
| treeType | string | Yes | Tree classification identifier | Phase 1 fixed: "AssetTree" |

| treeID | string | Yes      | Tree boundary identifier      | Inherited root |
| treeType | string | Yes | Tree classification identifier | Phase 1 fixed: "AssetTree" |

[createNodeButton.isRoot] Creates a new Tree (sets `treeID = id`) and navigates to the new node’s ASSET (BRANCH) view.

ASSET View is always scoped to one `treeID` (the current root’s id).

**Phase 2 dataFields (Future):**
- componentVersion: string - For debugging
- customProperties: string[] - For extensibility
- isRequired: boolean - Validation flag
- isLocked: boolean - Edit protection
- isEditable: boolean - Permission control

### Interaction/UX risks
- Double‑tap to edit (L94–L98, L38): Double‑tap is unreliable on mobile, conflicts with OS zoom, and hurts accessibility/keyboard support. Prefer single‑tap edit affordance (icon/button), long‑press on mobile, Enter to save, Esc to cancel; keep double‑tap optional at most.
- Multiple inline Create buttons (L62–L65, L79): n+1 “Create Here” buttons between child rows add clutter and tab‑stop pain. Consider a single “+ Add sub‑asset” that inserts relative to a selected sibling or uses a simple append, and defer in‑between insertion to later.
- Delete/Undo timing (L86–L92): 5s Undo plus “irreversible” is brittle. Clarify whether Undo survives navigation and whether deletes are soft until timer elapses or applied immediately with a restore snapshot.
- “NodeTools” delete only (L43): Consider at least “Rename/Move” later; if Phase 1 is delete‑only, explicitly state edits happen in the node header and card.