---
name: Full Collection Sync Implementation
overview: Implement safe full collection sync pattern with deletion detection protection. Extend adapter interfaces with full collection methods, add silent delete operations, and implement full sync logic in SyncManager that protects pending items from deletion.
todos: []
isProject: false
---

# Full Collection Sync Implementation Plan

## Overview

Implement the Safe Full Collection Sync Pattern that:

- **PUSH FIRST**: Sends all pending local changes to Firestore
- **PULL SECOND**: Compares full remote vs local collections to detect deletions
- **PROTECTS PENDING ITEMS**: Only deletes local items that are already synced, never items pending push

The implementation extends existing adapter interfaces, implements new methods, and creates an isolated `FullCollectionSync` strategy class that can be easily swapped with different sync strategies in the future.

## Current Architecture Analysis

### Existing Abstractions (Good)

- **SyncManager** already depends on abstractions:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          - `SyncableStorageAdapter` (local sync operations)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          - `RemoteSyncAdapter` (remote sync operations)
- **Interfaces are properly separated** following Interface Segregation Principle

### What Needs to Change

1. **Extend `RemoteSyncAdapter` interface** with full collection pull methods
2. **Extend `SyncableStorageAdapter` interface** with:
  - Full collection retrieval methods
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          - Silent delete methods (delete without enqueueing)
3. **Implement new methods** in concrete adapters
4. **Create isolated `FullCollectionSync` strategy class** for full sync logic
5. **Update SyncManager** to delegate to the strategy class

## Implementation Steps

### Step 1: Extend RemoteSyncAdapter Interface

**File**: `src/data/storage/storageAdapter.ts`

Add methods to `RemoteSyncAdapter` interface:

```typescript
export interface RemoteSyncAdapter {
  // Existing methods
  applySyncItem(item: SyncQueueItem): Promise<void>;
  pullEntitiesSince(type: 'node' | 'field', since: number): Promise<Array<TreeNode | DataField>>;
  
  // New: Full collection pull methods
  pullAllNodes(): Promise<TreeNode[]>;
  pullAllFields(): Promise<DataField[]>;
}
```

**Rationale**: Keep return types simple (arrays) for consistency with `pullEntitiesSince`. Full collection methods don't need StorageResult wrapper since they're internal sync operations.

### Step 2: Extend SyncableStorageAdapter Interface

**File**: `src/data/storage/storageAdapter.ts`

Add methods to `SyncableStorageAdapter` interface:

```typescript
export interface SyncableStorageAdapter extends StorageAdapter {
  // Existing sync methods...
  
  // New: Full collection retrieval methods
  getAllNodes(): Promise<TreeNode[]>;
  getAllFields(): Promise<DataField[]>;
  
  // New: Silent delete methods (no sync queue entry)
  deleteNodeLocal(id: string): Promise<void>;
  deleteFieldLocal(id: string): Promise<void>;
}
```

**Rationale**:

- `getAllNodes/getAllFields` return arrays directly (consistent with `getSyncQueue`)
- Silent delete methods don't return `StorageResult` since they're internal sync operations
- These methods bypass the normal delete flow that enqueues sync operations

### Step 3: Implement Methods in IDBAdapter

**File**: `src/data/storage/IDBAdapter.ts`

Add implementations:

```typescript
async getAllNodes(): Promise<TreeNode[]> {
  return await db.nodes.toArray();
}

async getAllFields(): Promise<DataField[]> {
  return await db.fields.toArray();
}

async deleteNodeLocal(id: string): Promise<void> {
  // Silent delete - no sync queue entry, no transaction needed
  await db.nodes.delete(id);
}

async deleteFieldLocal(id: string): Promise<void> {
  // Silent delete - no sync queue entry, no history entry, no transaction needed
  await db.fields.delete(id);
}
```

**Rationale**:

- Simple implementations using Dexie directly
- No transactions needed since we're not updating multiple stores
- No sync queue entries (this is the key difference from `deleteNode`)

### Step 4: Implement Methods in FirestoreAdapter

**File**: `src/data/storage/firestoreAdapter.ts`

Add implementations:

```typescript
async pullAllNodes(): Promise<TreeNode[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.NODES));
  return snap.docs.map(d => d.data() as TreeNode);
}

async pullAllFields(): Promise<DataField[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.FIELDS));
  return snap.docs.map(d => d.data() as DataField);
}
```

**Rationale**: Simple Firestore queries to get all documents from collections.

### Step 5: Create FullCollectionSync Strategy Class

**File**: `src/data/sync/fullCollectionSync.ts` (new)

Create an isolated class that handles full collection sync logic. This keeps the strategy separate and easy to swap:

```typescript
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../storage/storageAdapter';
import type { TreeNode, DataField } from '../models';

/**
 * FullCollectionSync - Isolated full collection sync strategy.
 * 
 * Handles safe full collection sync with deletion detection protection.
 * This strategy can be easily replaced with different sync strategies in the future.
 */
export class FullCollectionSync {
  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private applyRemoteNode: (node: TreeNode) => Promise<void>,
    private applyRemoteField: (field: DataField) => Promise<void>
  ) {}

  async sync(): Promise<void> {
    await this.syncNodes();
    await this.syncFields();
  }

  private async syncNodes(): Promise<void> {
    const remoteNodes = await this.remote.pullAllNodes();
    const remoteIds = new Set(remoteNodes.map(n => n.id));
    
    const localNodes = await this.local.getAllNodes();
    const pendingQueue = await this.local.getSyncQueue();
    const pendingIds = new Set(
      pendingQueue
        .filter(item => item.entityType === 'node')
        .map(item => item.entityId)
    );
    
    // Delete local nodes not in remote (unless pending push)
    for (const localNode of localNodes) {
      if (!remoteIds.has(localNode.id) && !pendingIds.has(localNode.id)) {
        await this.local.deleteNodeLocal(localNode.id);
        console.log('[FullCollectionSync] Deleted local node (removed remotely):', localNode.id);
      }
    }
    
    // Apply remote nodes (LWW)
    for (const remoteNode of remoteNodes) {
      await this.applyRemoteNode(remoteNode);
    }
  }

  private async syncFields(): Promise<void> {
    const remoteFields = await this.remote.pullAllFields();
    const remoteIds = new Set(remoteFields.map(f => f.id));
    
    const localFields = await this.local.getAllFields();
    const pendingQueue = await this.local.getSyncQueue();
    const pendingIds = new Set(
      pendingQueue
        .filter(item => item.entityType === 'field')
        .map(item => item.entityId)
    );
    
    // Delete local fields not in remote (unless pending push)
    for (const localField of localFields) {
      if (!remoteIds.has(localField.id) && !pendingIds.has(localField.id)) {
        await this.local.deleteFieldLocal(localField.id);
        console.log('[FullCollectionSync] Deleted local field (removed remotely):', localField.id);
      }
    }
    
    // Apply remote fields (LWW)
    for (const remoteField of remoteFields) {
      await this.applyRemoteField(remoteField);
    }
  }
}
```

**Rationale**:

- **Isolated strategy**: Easy to swap with different sync strategies (incremental, hybrid, etc.)
- **Single Responsibility**: Only handles full collection sync logic
- **Clear and simple**: Nodes and fields kept separate for readability (could abstract further, but unnecessary for Phase 1)
- **Dependency injection**: Takes LWW apply functions as callbacks to avoid coupling to SyncManager internals
- **Minimal SyncManager changes**: SyncManager only needs to initialize and delegate

### Step 6: Update SyncManager to Use FullCollectionSync

**File**: `src/data/sync/syncManager.ts`

Replace `pullRemoteChanges()` to delegate to FullCollectionSync:

```typescript
import { FullCollectionSync } from './fullCollectionSync';

export class SyncManager {
  private fullSync: FullCollectionSync;

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private pollIntervalMs: number = 600000
  ) {
    // Initialize full collection sync strategy
    this.fullSync = new FullCollectionSync(
      this.local,
      this.remote,
      (node) => this.applyRemoteNode(node),
      (field) => this.applyRemoteField(field)
    );
  }

  // ... existing methods ...

  private async pullRemoteChanges(): Promise<void> {
    // Delegate to full collection sync strategy
    await this.fullSync.sync();
  }

  // Keep existing applyRemoteNode/applyRemoteField methods (used by FullCollectionSync)
}
```

**Rationale**:

- **Simplified SyncManager**: Just delegates to strategy class
- **Easy to swap**: Can inject different sync strategies in the future
- **Clear separation**: Sync orchestration vs sync strategy logic

## Decision Points

### DP1: Return Types for Full Collection Methods

**Decision**: Use simple arrays (`Promise<TreeNode[]>`) instead of `Promise<StorageResult<TreeNode[]>>`

**Rationale**:

- Consistency with `pullEntitiesSince` return type
- These are internal sync methods, not public API
- Simpler code, no need to unwrap `StorageResult`
- If metadata is needed later, can add optional return wrapper

### DP2: Always Full Sync vs Incremental

**Decision**: Always use full collection sync (replace incremental pull)

**Rationale**:

- Simpler implementation (one code path)
- Deletion detection requires full comparison anyway
- Performance acceptable for Phase 1 scale (<1000 items)
- Can optimize later if needed (hybrid approach)

**Alternative**: Keep both and switch based on config or sync count

**Future Strategy Swap**: With `FullCollectionSync` isolated, can easily inject different strategies:

```typescript
// Future: inject different strategy
this.pullStrategy = config.useIncremental 
  ? new IncrementalSync(local, remote, applyFns)
  : new FullCollectionSync(local, remote, applyFns);
```

### DP3: Silent Delete Implementation

**Decision**: Implement `deleteNodeLocal/deleteFieldLocal` as simple delete operations without:

- Sync queue entries
- History entries (for fields)
- Transactions (unless needed for consistency)

**Rationale**:

- These are sync cleanup operations, not user-initiated
- Should not trigger sync operations (would cause loops)
- Simpler and faster

**Alternative**: Use flags to control behavior in existing delete methods

### DP4: Field History During Full Sync

**Decision**: `deleteFieldLocal` does NOT create history entries

**Rationale**:

- History is for user-initiated changes, not sync cleanup
- Remote deletion doesn't need local history entry
- Simpler implementation

**Alternative**: Create history entry for sync deletions (more complex, questionable value)

## Files to Modify

1. `**src/data/storage/storageAdapter.ts**`
  - Extend `RemoteSyncAdapter` with `pullAllNodes()` and `pullAllFields()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          - Extend `SyncableStorageAdapter` with `getAllNodes()`, `getAllFields()`, `deleteNodeLocal()`, `deleteFieldLocal()`
2. `**src/data/storage/IDBAdapter.ts**`
  - Implement `getAllNodes()`, `getAllFields()`, `deleteNodeLocal()`, `deleteFieldLocal()`
3. `**src/data/storage/firestoreAdapter.ts**`
  - Implement `pullAllNodes()` and `pullAllFields()`
4. `**src/data/sync/fullCollectionSync.ts**` (new)
  - Create `FullCollectionSync` class with isolated sync strategy
5. `**src/data/sync/syncManager.ts**`
  - Import and initialize `FullCollectionSync` in constructor
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          - Replace `pullRemoteChanges()` to delegate to `fullSync.sync()`

## Testing Considerations

After implementation, test scenarios:

1. **Remote deletion of synced node**: Local node should be deleted on sync
2. **Remote deletion of pending node**: Local node should NOT be deleted (protected by queue)
3. **Wipe scenario**: All local nodes/fields deleted when remote is empty
4. **New local node**: After push, exists in Firestore, won't be deleted on pull
5. **Failed push**: Item stays in queue, protected from deletion

## Migration Notes

- **No breaking changes**: Only adding methods to interfaces
- **Backward compatible**: Existing code continues to work
- **Type safety**: TypeScript will enforce new interface requirements
- **SyncManager behavior change**: Switches from incremental to full sync (intended)
- **Strategy isolation**: Full sync logic isolated in separate class - easy to replace with different strategy without touching SyncManager core logic

