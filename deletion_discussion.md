# History Sync and Soft Delete Discussion

## Initial Issue: DIP Violation in initStorage.ts

**User Question:**
> ISSUES.md (52) - Is this still an issue? I thought we had taken care of this.

**Finding:**
The `migrateFromFirestore()` function in `initStorage.ts` directly uses Firestore SDK calls instead of going through FirestoreAdapter:

```typescript
// Current implementation uses direct SDK
const nodesSnap = await getDocs(
  query(collection(firestoreDb, COLLECTIONS.NODES), orderBy('updatedAt', 'asc'))
);
```

FirestoreAdapter already has:
- `pullAllNodes()` (line 446)
- `pullAllFields()` (line 455)
- No `pullAllHistory()` method yet

**Fix Needed:** Use FirestoreAdapter methods for migration. Need to add `pullAllHistory()` method.

---

## Architecture Discussion: Where Should pullAllHistory() Go?

**User Question:**
> Well, where should pullAllHistory() go? The goal should be full abstraction, for future swappable DB.

### Current Architecture

- **StorageAdapter (base)**
  - Domain queries (e.g., `getFieldHistory(dataFieldId)`)
  - Single-entity or filtered operations

- **SyncableStorageAdapter (local storage with sync support)**
  - `getAllNodes()`, `getAllFields()` — full local collection retrieval
  - Used by FullCollectionSync to compare local vs remote

- **RemoteSyncAdapter (remote storage for sync operations)**
  - `pullAllNodes()`, `pullAllFields()` — full remote collection pull
  - Used by sync strategies to fetch remote data

### Recommendation: RemoteSyncAdapter

**Reasons:**
1. Migration is conceptually a sync operation (remote → local)
2. Consistency with `pullAllNodes()` and `pullAllFields()`
3. Full abstraction: any remote storage swap only needs a RemoteSyncAdapter implementation

```typescript
export interface RemoteSyncAdapter {
  // ... existing methods
  pullAllNodes(): Promise<TreeNode[]>;
  pullAllFields(): Promise<DataField[]>;
  pullAllHistory(): Promise<DataFieldHistory[]>; // <-- here
}
```

---

## Deletion Detection: Are Fields Synced?

**User Question:**
> So at the moment, if I deleted some Data Fields from Firestore or from another client, and triggered sync, then my client has no way to update with the deleted Fields, right? We only implemented absence comparison sync with Nodes?

### Finding: Deletion Detection for DataFields is Implemented

In `fullCollectionSync.ts`, `syncFields()` mirrors `syncNodes()`:

**For Nodes:**
- Pulls all remote nodes via `pullAllNodes()`
- Gets all local nodes via `getAllNodes()`
- Compares sets to find local nodes not in remote
- Deletes local nodes absent from remote (unless pending push)

**For Fields:**
- Pulls all remote fields via `pullAllFields()`
- Gets all local fields via `getAllFields()`
- Compares sets to find local fields not in remote
- Deletes local fields absent from remote (unless pending push)

**Both use the same absence comparison pattern with pending push protection.**

### How It Works

When you trigger sync:
1. `syncFields()` runs
2. Gets complete remote field list
3. Gets complete local field list
4. If a local field ID is not in the remote set → delete it locally
5. Unless that field is in the sync queue (pending push)

**So if you delete a DataField from Firestore (or another client), on sync:**
- Remote: field is absent
- Local: field exists
- Result: `deleteFieldLocal()` is called

**The same logic applies to both nodes and fields. Deletion detection is symmetric.**

---

## The History Sync Gap

**User Question:**
> But not dataFieldHistory values?

### Current State: DataFieldHistory is NOT Synced

**Issues:**
1. FullCollectionSync only syncs nodes and fields — no history sync
   - `sync()` calls `syncNodes()` and `syncFields()` only
   - No `syncHistory()` method

2. History entries are orphaned on field deletion
   - When `deleteFieldLocal()` runs, it deletes the field but not its history
   - History entries remain in both IDB and Firestore with dangling `dataFieldId` references

3. History is not pulled from remote
   - History is created locally when operations occur
   - History is pushed to Firestore via sync queue (when field operations are synced)
   - But history entries created on other clients are never pulled/synced back

### What's Missing

If Field A is deleted from Firestore by another client:
- Field A gets deleted locally ✓
- History entries for Field A remain as orphans ✗

If Field B gets a new value on another client:
- Field B updates locally ✓
- New history entry for Field B is not pulled ✗

### User Requirement

> 2 and 3: We need to sync history. It is the same priority shared data as everything else. We need to pull missing field values and all historical Field values on sync, and delete locally any orphans from remote deletions. This means there should also be full cascade deletion of history records when a Field is deleted.

---

## Deep Dive: Restoration and Orphan Handling

**User Concern:**
> I think I need help thinking this through more. Not just this plan, but what I should actually do about history and data reversion. I mean, I hadn't intended to build an ACID event-sourced event stream API! But what if all the historical values were just left as data orphans (or refugees, you might say)? Is there anything in the current structure that would lend itself to any kind of restoration process?

### Current Data Relationships

**DataFieldHistory stores:**
- `dataFieldId` (FK to DataField)
- `parentNodeId` (denormalized FK to TreeNode)
- `action: "create" | "update" | "delete"`
- `prevValue`, `newValue`
- `updatedBy`, `updatedAt`, `rev`

**What's NOT on history:**
- `fieldName` - that's only on DataField

### The Orphan Problem

If a DataField gets deleted, its history entries become orphans with:
- A `dataFieldId` pointing to nothing
- A `parentNodeId` that might still exist
- **No way to know what field name those values belonged to**

This is a significant gap for restoration. You'd have historical values but no context about what they were (e.g., was this "Mileage" or "Last Service Date"?).

### Options Considered

**Option A: Keep history ephemeral (current behavior, with cleanup)**
- History is local-only audit trail
- Delete history when field is deleted
- Simple, but loses all historical data

**Option B: Orphan refugees (your suggestion)**
- Don't delete history when field is deleted
- Problem: Can't restore without knowing the field name
- Workaround: Add `fieldName` to DataFieldHistory (schema change)

**Option C: Soft delete fields**
- Instead of deleting DataField, mark as `deletedAt: timestamp`
- History stays linked
- Restoration = clear the `deletedAt` flag
- More complex queries (filter out deleted fields)

**Option D: Minimal event sourcing (defer to LATER.md)**
- This is heading toward event sourcing territory
- Could be valuable later but adds significant complexity now

### What Would Make Orphans Restorable?

If you added `fieldName` to DataFieldHistory, orphaned history could theoretically support:
- "Show me all historical values for node X" (via `parentNodeId`)
- "Restore field Y with its last known value" (create new field with same name + value)

But this is still manual reconstruction, not true undo.

---

## The Bigger Vision: Full Restoration Requirements

**User Requirement:**
> I want everything user facing. Right now, a technician could change a Field Value and a manager could change it back very easily. Or two technicians could keep reverting each others changes until a manager tells them to knock it off. (There are no permissions or User models right now of course). I guess I want to move in that direction with deletions as well. Someone may delete a Field and someone else may need to restore the whole field (with all its history). Not just for Data Fields, but whole nodes and sub-trees of nodes. And the Node Title and Node Sub Title. So this would take considerable UI.

**But here's another complication:**
> Data Fields will soon be all kinds of COMPONENTS! Components with a name, value, range, high warn, low warn, low alarm, units, dimensions, domain, etc. Or live SCADA values. Or images and image carousels from a CDN. Or links, both internal URI and external URLs. Many will be components composed of smaller components.

### The Vision

Entity-level versioning across:
- Nodes (title, subtitle, parent changes, deletions)
- Fields/Components (creation, deletion, all property changes)
- Nested component properties (value, range, alarms, units, images...)
- Subtree operations (delete branch, restore branch)

This is fundamentally different from the current model which only tracks:
- Single property (`fieldValue`) on DataFields
- Append-only log with no soft delete

### Three Architectural Paths

**Path A: Expand Current Model (Incremental)**
- Add more history tables, soft delete flags, expand property tracking.
- Pros: Familiar patterns, incremental work
- Cons: Gets messy fast. Each new component type needs new history handling. Restoration logic becomes complex. Schema migrations pile up.

**Path B: Event Sourcing**
- Every mutation is an immutable event. Current state = replay of events.
- Pros: Handles any entity/property uniformly. Time travel and restoration are built-in. Audit trail is complete.
- Cons: Significant complexity. Different query patterns. Needs projections for current state. Overkill for Phase 1.

**Path C: Soft Delete + Snapshots (Middle Ground)**
- Every entity gets `deletedAt: number | null`
- On delete, capture a snapshot (JSON blob of full state)
- Restoration = clear `deletedAt`, restore from snapshot
- Pros: Simpler than event sourcing. Handles deletion/restoration well.
- Cons: Doesn't give you property-level history for complex components. Snapshots can get large.

### Recommendation: Phase-by-Phase Approach

**Don't solve the component history problem now.** The current text-only field model is about to be replaced. Building elaborate history infrastructure for it would be throwaway work.

**For Phase 1:**
- Add `fieldName` to DataFieldHistory schema (makes orphans self-describing)
- Sync history across devices (your original plan, but simpler)
- Don't cascade delete history (keep orphans)
- Document the full vision in LATER.md

**For Phase 2:**
- Add soft delete (`deletedAt`) to DataField and TreeNode
- Add simple NodeHistory (title/subtitle changes)
- Build "Recently Deleted" UI for restoration

**For Phase 3 (components):**
- Design a unified change tracking model that works for any component type
- Consider event sourcing or a flexible property-change table
- This is where the real architecture decision lives

**Key Insight:** The component model will dictate the history model, so don't over-invest in history infrastructure until you know what components look like.

---

## Revised Initial Approach: fieldName + Orphan Preservation

**User Decision:**
> Yes, good points. I'm designing a history model that only fits one very simple component. But more complex components are not very far away! End of phase 1 I was planning for instance a UI dialog for adding ranges, thresholds, alarm levels, units, tolerances, etc. and also intra-links and inter-links are very important. Still just strings, small objects, arrays. Under the current paradigm, I would have to have each new sub-field have its own history view and reversion UI. That is doable, but a comprehensive abstract object would be better.

> I think you are right as usual:
> - Add `fieldName` to DataFieldHistory schema (makes orphans self-describing)
> - Sync history across devices (your original plan, but simpler)
> - Don't cascade delete history (keep orphans)

### Revised History Sync Plan

**Schema Change:**
```typescript
export type DataFieldHistory = {
  id: string;           // `${dataFieldId}:${rev}`
  dataFieldId: ID;
  parentNodeId: ID;
  fieldName: string;    // NEW - makes orphans self-describing
  action: "create" | "update" | "delete";
  property: "fieldValue";
  prevValue: string | null;
  newValue: string | null;
  updatedBy: UserId;
  updatedAt: number;
  rev: number;
};
```

**Sync Behavior:**
- `syncHistory()` becomes simpler:
  1. Pull all remote history via `pullAllHistory()`
  2. Upsert each entry locally (add missing, update if remote is newer)
  3. **Never delete local history** - orphans are intentional refugees

**What Changes vs. Original Plan:**

| Original Plan | Revised |
|--------------|---------|
| Cascade delete history when field deleted | Keep history (orphans) |
| Delete orphaned history during sync | Keep all history |
| `deleteHistoryForField()` method | Not needed |
| `deleteHistoryLocal()` method | Not needed |
| Complex deletion detection | Just upsert |

---

## The Node Deletion Problem

**User Question:**
> OK, but what about when Nodes are deleted? Even with a `fieldName`, `dataFieldHistory` entries would never be restorable to a deleted Node. And I need Node deletion during dev, or I'll fill up with trash. Also, I just realised: `fieldName` on a `dataFieldHistory` record isn't deterministic: the UI allows multiple Data Fields of the same name.

### Problem 1: Node Deletion Orphans History Completely

If a Node is deleted:
- Its child Fields are deleted (or orphaned)
- History entries have `parentNodeId` → points to nothing
- History entries have `dataFieldId` → points to nothing
- Even with `fieldName`, **where would you restore to?**

These orphans become audit-only, not restorable. They're just ghosts.

### Problem 2: fieldName Isn't a Unique Identifier

The UI allows multiple DataFields with the same name on one node. So:
- Node "Pump-001" has two fields named "Notes"
- Both get deleted
- History entries have same `parentNodeId` + `fieldName`
- Which history belongs to which field? Ambiguous.

The `dataFieldId` distinguishes them technically, but for restoration purposes you'd be guessing.

### A Practical Middle Ground

Given your need for real node deletion during dev, consider:

| Deletion Type | History Behavior | Rationale |
|--------------|------------------|-----------|
| Field deleted | Keep history (orphans) | Restorable if node still exists |
| Node deleted | Cascade delete history | Cleanup, no false promise of restoration |

**This gives you:**
- Field-level undo while the node exists
- Clean node deletion for dev/maintenance
- No misleading orphans that can never be restored

**What This Means for Sync:**
- Fields: Pull all, upsert, don't delete orphans (field might be restored)
- History: Pull all, upsert, but delete history for nodes that no longer exist locally
- Nodes: Pull all, delete absent (current behavior)

Or simpler: just let the cascade happen naturally when `deleteNodeLocal()` runs.

**The fieldName Uniqueness Issue:**
For Phase 1, accept the limitation:
- Duplicate field names are rare (user error)
- `dataFieldId` + `updatedAt` still distinguishes entries for audit
- Restoration UI could show all matching history and let user pick
- Or just restore the most recent one

This is an edge case not worth engineering around now.

---

## The Breakthrough: Soft Delete Solution

**User Realization:**
> Wait a second, `DataFieldHistory` already has `dataFieldId`. Doesn't that uniquely link it to its DataField owner? With soft deletion of DataField, and cascade soft deletion of DataFieldHistory, both would be restorable to their parent node by `parentNodeId` and `dataFieldId`. I would just need a "Deleted Fields" UI in the (not yet built) Node Tools fold. But I should also say, its not meant to be a local trail, these soft deletion flags will be persisted and synced. Is that all consistent logic?

> And yes, you are right, Node deletion can be the full wipe, that's a good balance.

### With Soft Delete, the Links Stay Valid

```
TreeNode - exists
  └── DataField - deletedAt: 123456
      ├── History rev:0 (linked via dataFieldId)
      ├── History rev:1 (linked via dataFieldId)
      └── History rev:2 (linked via dataFieldId)
```

- **DataField** has `deletedAt: number | null`
- **DataFieldHistory** entries stay as-is (their `dataFieldId` still points to the soft-deleted field)
- **No cascade soft-delete of history needed** - history just belongs to a soft-deleted field

### Restoration Flow

1. User opens Node Tools → "Deleted Fields"
2. Query: `fields.where('parentNodeId').equals(nodeId).filter(f => f.deletedAt != null)`
3. User clicks "Restore" on a field
4. Clear `deletedAt` on that DataField
5. History is already intact, linked by `dataFieldId`

### Deletion Summary

| Action | Behavior |
|--------|----------|
| Delete Field | Soft delete: set `deletedAt` on DataField |
| Restore Field | Clear `deletedAt` on DataField |
| Delete Node | Hard delete: wipe node + all fields + all history |

### Sync Behavior

- `deletedAt` is just another field property - syncs normally
- Soft-deleted fields appear on all clients (filtered from normal UI, visible in "Deleted Fields")
- Hard-deleted nodes cascade on all clients (via absence detection in FullCollectionSync)

### What This Means

**You don't need `fieldName` on DataFieldHistory** - the DataField record (soft-deleted) still has it.

**Schema change is just one field:**
```typescript
export type DataField = {
  // ... existing fields
  deletedAt: number | null;  // NEW - soft delete timestamp
};
```

**History schema stays unchanged.**

This is much simpler and more consistent. The only new complexity is:
1. Add `deletedAt` to DataField
2. UI queries filter out `deletedAt != null` by default
3. "Deleted Fields" UI shows only `deletedAt != null`
4. Node deletion cascades hard-deletes

---

## Final Decision: Soft Delete Implementation Plan

**User Request:**
> Yes, please update the plan. Well, redo the plan.

**Final Approach:**
- **Soft delete for DataFields** - Fields marked as deleted but restorable
- **History sync across devices** - DataFieldHistory pulls from remote
- **Hard delete for Nodes** - Cascade wipe of fields and history
- **Fix DIP violation** - Use FirestoreAdapter in initStorage.ts

**Key Points:**
- `dataFieldId` links stay valid with soft delete
- No need for `fieldName` on history (DataField still exists)
- History syncs via simple upsert (no deletion detection)
- Node deletion is hard delete (cascades everything)