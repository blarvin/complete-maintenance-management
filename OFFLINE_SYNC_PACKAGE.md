# Offline Sync Package Extraction

**Proposal**: Extract the sync system into a standalone reusable package `@blarvin/offline-sync`

---

## Current Sync System Architecture

The sync system is already well-isolated:

```
┌─────────────────────────────────────────────────────────────────┐
│                       SyncManager                                │
│  (Orchestrates sync lifecycle, push, and pull strategies)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ SyncLifecycle │  │  SyncPusher  │  │ ServerAuthority-   │     │
│  │ (Timer, Online)│ │ (Queue→Remote)│ │ Resolver (LWW)     │     │
│  └──────────────┘  └──────────────┘  └────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SyncStrategy (interface)                    │    │
│  │  ┌─────────────────┐  ┌─────────────────┐               │    │
│  │  │ FullCollectionSync│ │   DeltaSync     │               │    │
│  │  └─────────────────┘  └─────────────────┘               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────┐
            │  SyncableStorageAdapter (IDB)   │ ← Your domain
            │  RemoteSyncAdapter (Firestore)  │ ← Your domain
            └─────────────────────────────────┘
```

---

## What Makes This Extractable

### 1. Clean Interface Boundaries Already Exist

The `SyncableStorageAdapter` and `RemoteSyncAdapter` interfaces define the contract:

```typescript
// Already generic operations:
interface SyncableStorageAdapter {
  getSyncQueue(): Promise<SyncQueueItem[]>;
  markSynced(queueItemId: string): Promise<void>;
  markFailed(queueItemId: string, error: any): Promise<void>;
  getLastSyncTimestamp(): Promise<number>;
  setLastSyncTimestamp(timestamp: number): Promise<void>;
  applyRemoteUpdate(entityType: string, entity: unknown): Promise<void>;
  // ...
}
```

### 2. Domain-Agnostic Core Logic

`SyncLifecycle` has zero domain knowledge - it's pure timer/event management:

```typescript
// This class knows nothing about TreeNodes or DataFields
export class SyncLifecycle {
  constructor(
    private onTick: () => Promise<void>,  // Generic callback
    private pollIntervalMs: number
  ) {}
  // ...
}
```

### 3. Strategy Pattern Already Implemented

The pull strategy is already abstracted, making it easy to add new strategies.

---

## Package Design

### Package Structure

```
@blarvin/offline-sync/
├── src/
│   ├── index.ts              # Public API exports
│   │
│   ├── core/
│   │   ├── SyncManager.ts    # Main orchestrator
│   │   ├── SyncPusher.ts     # Push logic
│   │   ├── SyncLifecycle.ts  # Timer/events (unchanged)
│   │   └── types.ts          # Core types
│   │
│   ├── resolution/
│   │   ├── ConflictResolver.ts     # Interface
│   │   ├── ServerAuthorityResolver.ts
│   │   └── LastWriteWinsResolver.ts
│   │
│   ├── strategies/
│   │   ├── SyncStrategy.ts   # Interface
│   │   ├── FullSync.ts
│   │   ├── DeltaSync.ts
│   │   └── index.ts
│   │
│   └── adapters/
│       ├── LocalStorageAdapter.ts   # Interface
│       ├── RemoteStorageAdapter.ts  # Interface
│       └── SyncQueueAdapter.ts      # Interface (extracted!)
│
├── package.json
└── README.md
```

### Generic Type System

The key is making entity types generic:

```typescript
// @blarvin/offline-sync/src/core/types.ts

/**
 * Base entity interface - your entities must extend this
 */
export interface SyncableEntity {
  id: string;
  updatedAt: number;
  deletedAt: number | null;  // Soft delete support
}

/**
 * Sync queue item - generic payload
 */
export interface SyncQueueItem<TPayload = unknown> {
  id: string;
  operation: string;
  entityType: string;
  entityId: string;
  payload: TPayload;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

/**
 * Sync result metrics
 */
export interface SyncResult {
  entitiesApplied: Record<string, number>;  // e.g., { node: 5, field: 12 }
  duration: number;
}
```

### Adapter Interfaces

```typescript
// @blarvin/offline-sync/src/adapters/LocalStorageAdapter.ts

export interface LocalStorageAdapter<TEntity extends SyncableEntity = SyncableEntity> {
  // Entity operations
  getAll(entityType: string): Promise<TEntity[]>;
  getById(entityType: string, id: string): Promise<TEntity | null>;
  put(entityType: string, entity: TEntity): Promise<void>;
  delete(entityType: string, id: string): Promise<void>;

  // Sync metadata
  getLastSyncTimestamp(): Promise<number>;
  setLastSyncTimestamp(timestamp: number): Promise<void>;
}

// @blarvin/offline-sync/src/adapters/SyncQueueAdapter.ts

export interface SyncQueueAdapter<TPayload = unknown> {
  getQueue(): Promise<SyncQueueItem<TPayload>[]>;
  enqueue(item: Omit<SyncQueueItem<TPayload>, 'id' | 'status' | 'retryCount'>): Promise<void>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: unknown): Promise<void>;
  clear(): Promise<void>;
}

// @blarvin/offline-sync/src/adapters/RemoteStorageAdapter.ts

export interface RemoteStorageAdapter<TEntity extends SyncableEntity = SyncableEntity> {
  push(item: SyncQueueItem): Promise<void>;
  pullAll(entityType: string): Promise<TEntity[]>;
  pullSince(entityType: string, since: number): Promise<TEntity[]>;
}
```

### Conflict Resolution Interface

```typescript
// @blarvin/offline-sync/src/resolution/ConflictResolver.ts

export type ResolutionResult = 'apply-remote' | 'keep-local' | 'merge';

export interface ConflictResolver<TEntity extends SyncableEntity = SyncableEntity> {
  resolve(
    local: TEntity | null,
    remote: TEntity,
    hasPendingLocalChanges: boolean
  ): Promise<ResolutionResult>;
}

// Default implementation
export class ServerAuthorityResolver<TEntity extends SyncableEntity>
  implements ConflictResolver<TEntity> {

  async resolve(
    _local: TEntity | null,
    _remote: TEntity,
    hasPendingLocalChanges: boolean
  ): Promise<ResolutionResult> {
    // Protect pending local changes
    if (hasPendingLocalChanges) {
      return 'keep-local';
    }
    return 'apply-remote';
  }
}
```

### Main SyncManager (Generic)

```typescript
// @blarvin/offline-sync/src/core/SyncManager.ts

export interface SyncManagerConfig {
  pollIntervalMs?: number;
  entityTypes: string[];  // e.g., ['node', 'field', 'history']
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error) => void;
  logger?: Logger;
}

export class SyncManager<TEntity extends SyncableEntity = SyncableEntity> {
  private lifecycle: SyncLifecycle;
  private pusher: SyncPusher;
  private strategies: Map<string, SyncStrategy>;

  constructor(
    private local: LocalStorageAdapter<TEntity>,
    private remote: RemoteStorageAdapter<TEntity>,
    private queue: SyncQueueAdapter,
    private resolver: ConflictResolver<TEntity>,
    private config: SyncManagerConfig
  ) {
    this.pusher = new SyncPusher(queue, remote);
    this.lifecycle = new SyncLifecycle(
      () => this.syncOnce(),
      config.pollIntervalMs ?? 600000
    );

    // Register default strategies
    this.strategies = new Map();
    this.strategies.set('full', new FullSync(local, remote, resolver, config.entityTypes));
    this.strategies.set('delta', new DeltaSync(local, remote, resolver, config.entityTypes));
  }

  start(): void { this.lifecycle.start(); }
  stop(): void { this.lifecycle.stop(); }

  async syncOnce(strategy: 'full' | 'delta' = 'delta'): Promise<SyncResult> {
    // Push first, then pull
    await this.pusher.push();
    return this.strategies.get(strategy)!.sync();
  }
}
```

---

## Integration Example

How the app would use the extracted package:

```typescript
// src/data/sync/setupSync.ts
import {
  SyncManager,
  ServerAuthorityResolver,
  type LocalStorageAdapter,
  type RemoteStorageAdapter,
  type SyncQueueAdapter,
} from '@blarvin/offline-sync';
import type { TreeNode, DataField, DataFieldHistory } from '../models';

// Your domain entity union
type AppEntity = TreeNode | DataField | DataFieldHistory;

// Adapt your IDBAdapter to the interface
class IDBLocalAdapter implements LocalStorageAdapter<AppEntity> {
  constructor(private db: Dexie) {}

  async getAll(entityType: string): Promise<AppEntity[]> {
    switch (entityType) {
      case 'node': return this.db.nodes.toArray();
      case 'field': return this.db.fields.toArray();
      case 'history': return this.db.history.toArray();
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
  // ... implement other methods
}

// Adapt FirestoreAdapter to the interface
class FirestoreRemoteAdapter implements RemoteStorageAdapter<AppEntity> {
  // ... implementation
}

// Create sync manager
export function createSyncManager() {
  const local = new IDBLocalAdapter(db);
  const remote = new FirestoreRemoteAdapter();
  const queue = new IDBSyncQueueAdapter(db);
  const resolver = new ServerAuthorityResolver<AppEntity>();

  return new SyncManager(local, remote, queue, resolver, {
    entityTypes: ['node', 'field', 'history'],
    pollIntervalMs: 600000,
    onSyncComplete: (result) => {
      dispatchStorageChangeEvent();
      console.log('Sync complete:', result);
    },
  });
}
```

---

## Benefits of Extraction

### 1. Reusability
Use the same sync logic in other offline-first apps without reimplementing.

### 2. Testability
The package can have its own comprehensive test suite with mock adapters.

### 3. Separation of Concerns
Your app focuses on domain logic; sync is an infrastructure concern.

### 4. Community Contribution
Others could contribute strategies (CRDTs, operational transforms).

### 5. Versioning Independence
Upgrade sync logic independently of app features.

---

## Potential New Strategies

Once extracted, new strategies could be added:

```typescript
// Selective sync - only specific entity types
class SelectiveSync implements SyncStrategy { ... }

// Priority sync - critical entities first
class PrioritySync implements SyncStrategy { ... }

// Batched sync - group operations for efficiency
class BatchedSync implements SyncStrategy { ... }

// CRDT-based sync - for conflict-free types
class CRDTSync implements SyncStrategy { ... }
```

---

## Trade-offs

| Pro | Con |
|-----|-----|
| Reusable across projects | More indirection/abstraction |
| Independent versioning | Package maintenance overhead |
| Community contributions | Generic ≠ optimized for your use case |
| Clean architectural boundary | Initial extraction effort |

---

## Recommended Extraction Phases

### Phase 1: Extract Interfaces Only
Keep implementations in your app, but define the interfaces in a shared location.

### Phase 2: Move Generic Components
Move `SyncLifecycle` and `SyncPusher` (already domain-agnostic).

### Phase 3: Generalize Strategies
Move strategies with generic entity support using type parameters.

### Phase 4: Internal Package
Publish as internal package, dogfood in your app to validate the API.

### Phase 5: Open Source (Optional)
Consider open-sourcing if the package proves stable and useful.

---

## Files Involved in Current Implementation

```
src/data/sync/
├── syncManager.ts           # Main orchestrator (238 lines)
├── SyncPusher.ts            # Push logic (55 lines)
├── SyncLifecycle.ts         # Timer/events (71 lines)
├── ServerAuthorityResolver.ts  # Conflict resolution (63 lines)
├── devTools.ts              # Browser console helpers
└── strategies/
    ├── SyncStrategy.ts      # Interface (28 lines)
    ├── FullCollectionSync.ts   # Full sync (103 lines)
    ├── DeltaSync.ts         # Delta sync (75 lines)
    └── index.ts             # Barrel exports

src/data/storage/
├── storageAdapter.ts        # Interfaces (120 lines) - would need extraction
└── db.ts                    # SyncQueueItem type - would need extraction
```

**Total lines to extract**: ~750 lines of sync logic

---

---

## Summary: What This Enables

```
  Summary: What This Enables
  ┌────────────────────────────────────────┬──────────────────────┬────────────────────────────┐      
  │               Capability               │  Without Extraction  │   With Extracted Package   │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Different sync intervals per env       │ Hardcoded or env var │ Full config object         │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Different conflict resolution          │ Code change required │ Config switch              │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ A/B testing sync strategies            │ Very difficult       │ Feature flag integration   │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Per-tenant customization               │ Not possible         │ Config override layer      │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Different backends (Firestore vs REST) │ Major refactor       │ Adapter swap               │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Disable sync for testing               │ Mock everything      │ startupStrategy: 'none'    │      
  ├────────────────────────────────────────┼──────────────────────┼────────────────────────────┤      
  │ Enterprise on-prem deployment          │ Fork the code        │ Different adapter + config │      
  └────────────────────────────────────────┴──────────────────────┴────────────────────────────┘      
  The extraction essentially turns your sync system from code into infrastructure that can be
  configured declaratively.
```

## Next Steps

1. Review this proposal and decide if extraction is worthwhile
2. If yes, start with Phase 1 (interface extraction)
3. Create a new repo/package structure
4. Incrementally migrate components
5. Update app to use the package
