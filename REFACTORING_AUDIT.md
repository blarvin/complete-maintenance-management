# Refactoring Audit Report

**Date**: February 2026
**Scope**: Full codebase review for Phase 1 MVP
**Focus**: Clean code, SOLID, composition, orchestration, CQRS opportunities, decoupling

---

## Executive Summary

The codebase has a solid foundation with excellent architectural patterns already in place:
- **FSM-based navigation** with discriminated unions
- **Adapter pattern** for storage abstraction
- **Service registry** for dependency injection
- **Strategy pattern** for sync operations
- **Hooks for composition** (`useFieldEdit`, `useNodeCreation`, etc.)

However, there are opportunities to improve consistency, reduce duplication, and better align with CQRS principles as the in-memory node index indicates a direction toward read model separation.

### Refactoring checklist

- [ ] **2.1 SRP** Extract `SyncQueueManager` from `IDBAdapter`
- [ ] **2.1 SRP** Extract `useFocusManager` from `useFieldEdit`
- [ ] **2.2 OCP** Event-based node index updates (or adopt event bus from 4.2)
- [ ] **2.3 DIP** Service injection / context for hooks (parameter or `createContextId`)
- [ ] **3.1 DRY** Move `nextRev()` to `historyHelpers.ts`
- [ ] **3.2 DRY** Create `useStorageChangeListener` hook
- [ ] **3.3 DRY** Extract `persistUIPrefs(state)` in `appState.transitions`
- [ ] **3.4 DRY** Move `createResult<T>()` to `storageResult.ts`
- [ ] **4.2 CQRS** Introduce `StorageEventBus`; index and sync as subscribers
- [ ] **5.2** Extract `useEditableValue` from `useFieldEdit`
- [ ] **5.3** Create `useAsyncOperation` for loading/error state
- [ ] **5.4** Extract navigation guard logic (`guards.ts`)
- [ ] **6.1** Service context provider (`NodeServiceContext`, `FieldServiceContext`)
- [ ] **6.2** Decouple sync trigger (event or dedicated API)
- [ ] **6.3** Abstract time provider for tests
- [ ] **7.1** Extract magic numbers to constants (e.g. `constants/timing.ts`)
- [ ] **7.2** Remove unused `nodeId` prop from DataCard
- [ ] **7.3** Add barrel exports for hooks
- [ ] **7.4** Add barrel exports for sync strategies
- [ ] **7.5** Consolidate / replace ad-hoc `console.log` with logger
- [ ] **8.1** Full CQRS implementation (larger)
- [ ] **8.2** Service layer rewrite with event sourcing (larger)
- [ ] **8.3** Extract sync system to standalone module (larger)
- [ ] **Part 10** Delete dead code: `src/data/repo/` (if no imports)

---

## Part 1: What's Working Well (Preserve These)

### 1.1 FSM Navigation Pattern
The `appState.types.ts`, `appState.transitions.ts`, `appState.selectors.ts` split is exemplary:
- **Types**: Define the state shape (discriminated unions)
- **Transitions**: Pure state mutation functions (guards, no side effects)
- **Selectors**: Derived state queries

This separation makes the navigation logic testable and predictable.

### 1.2 Adapter Pattern
`StorageAdapter` and `SyncableStorageAdapter` interfaces provide clean abstraction:
- `IDBAdapter` (primary, offline-first)
- `FirestoreAdapter` (cloud sync)

The `nodeServiceFromAdapter()` and `fieldServiceFromAdapter()` factory functions allow easy swapping.

### 1.3 Sync Strategy Pattern
`SyncStrategy` interface with `FullCollectionSync` and `DeltaSync` implementations:
- Clean composition in `SyncManager`
- Single Responsibility: `SyncPusher`, `SyncLifecycle`, `ServerAuthorityResolver`

### 1.4 Hook Extraction
`useFieldEdit`, `useNodeCreation`, `usePendingForms` demonstrate good separation of UI state from business logic.

---

## Part 2: SOLID Violations

### 2.1 Single Responsibility Principle (SRP)

#### Issue: `IDBAdapter` has dual responsibilities
**Location**: `src/data/storage/IDBAdapter.ts`
**Problem**: The adapter handles both storage operations AND sync queue management.

```typescript
// Currently in IDBAdapter:
- listRootNodes(), createNode(), etc. (Storage)
- getSyncQueue(), markSynced(), enqueueSyncOperation() (Sync Queue)
- applyRemoteUpdate(), applyRemoteHistory() (Remote Application)
```

**Recommendation**: Extract sync queue operations into `SyncQueueManager`:

```typescript
// New: src/data/sync/SyncQueueManager.ts
interface SyncQueueManager {
  getSyncQueue(): Promise<SyncQueueItem[]>;
  enqueue(operation: EnqueueParams): Promise<void>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: unknown): Promise<void>;
}

class IDBSyncQueueManager implements SyncQueueManager { ... }
```

This makes `IDBAdapter` purely a storage adapter, and `SyncQueueManager` reusable across different storage backends.

#### Issue: `useFieldEdit` does too much
**Location**: `src/hooks/useFieldEdit.ts`
**Problem**: Handles edit state, preview mode, revert operations, AND focus management.

**Recommendation**: Extract focus management into `useFocusManager` hook:

```typescript
// New: src/hooks/useFocusManager.ts
function useFocusManager(inputRef: Signal<HTMLInputElement | undefined>) {
  const focusWithCursorAtEnd$ = $(() => { ... });
  return { focusWithCursorAtEnd$ };
}
```

### 2.2 Open/Closed Principle (OCP)

#### Issue: Node index updates scattered across codebase
**Location**: Multiple files call `upsertNodeSummary()` / `removeNodeSummary()`
- `src/data/services/index.ts` (6 calls)
- `src/data/storage/IDBAdapter.ts` (10 calls)

**Problem**: Adding new write paths requires remembering to update the index.

**Recommendation**: Use an event-based approach (see CQRS section below).

### 2.3 Dependency Inversion Principle (DIP)

#### Issue: Direct imports of concrete services in hooks
**Location**: Multiple hooks directly import `getFieldService()`, `getNodeService()`

```typescript
// useFieldEdit.ts
import { getFieldService } from '../data/services';
await getFieldService().updateFieldValue(fieldId, newValue);
```

**Problem**: Tight coupling makes testing harder; can't inject mocks easily.

**Recommendation**: Pass service as parameter or use context:

```typescript
// Option A: Parameter injection
function useFieldEdit(options: UseFieldEditOptions & { fieldService?: IFieldService }) {
  const service = options.fieldService ?? getFieldService();
}

// Option B: Service context (better for Qwik)
const FieldServiceContext = createContextId<IFieldService>('field.service');
```

---

## Part 3: DRY Violations

### 3.1 `nextRev()` duplication
**Locations**:
- `src/data/storage/IDBAdapter.ts:539`
- `src/data/storage/firestoreAdapter.ts:639`

Both have identical logic for computing the next revision number.

**Recommendation**: Move to `historyHelpers.ts`:

```typescript
// src/data/storage/historyHelpers.ts
export async function computeNextRev(
  getHistory: () => Promise<DataFieldHistory[]>
): Promise<number> {
  const history = await getHistory();
  if (history.length === 0) return 0;
  return Math.max(...history.map(h => h.rev)) + 1;
}
```

### 3.2 Storage change event listeners
**Locations**:
- `src/hooks/useRootViewData.ts:39-50`
- `src/hooks/useTreeNodeFields.ts:70-82`
- `src/hooks/useBranchViewData.ts` (should have it too)

All have similar event listener setup/cleanup.

**Recommendation**: Create `useStorageChangeListener` hook:

```typescript
// New: src/hooks/useStorageChangeListener.ts
export function useStorageChangeListener(callback: QRL<() => void>) {
  useVisibleTask$(({ cleanup }) => {
    if (typeof window === 'undefined') return;

    const handler = () => callback();
    window.addEventListener('storage-change', handler);
    cleanup(() => window.removeEventListener('storage-change', handler));
  });
}
```

### 3.3 UI prefs persistence in transitions
**Location**: `src/state/appState.transitions.ts:115-159`

Three toggle functions have identical persistence logic:

```typescript
toggleCardExpanded: (state, nodeId) => {
  // ... toggle logic ...
  saveUIPrefs({  // Repeated 3 times
    expandedCards: state.ui.expandedCards,
    expandedFieldDetails: state.ui.expandedFieldDetails,
    expandedNodeDetails: state.ui.expandedNodeDetails,
  });
}
```

**Recommendation**: Extract persistence helper:

```typescript
function persistUIPrefs(state: AppState): void {
  saveUIPrefs({
    expandedCards: state.ui.expandedCards,
    expandedFieldDetails: state.ui.expandedFieldDetails,
    expandedNodeDetails: state.ui.expandedNodeDetails,
  });
}
```

### 3.4 `createResult<T>()` functions
**Locations**:
- `src/data/storage/IDBAdapter.ts:28-36`
- `src/data/storage/firestoreAdapter.ts:61-68`

**Recommendation**: Move to shared module:

```typescript
// src/data/storage/storageResult.ts
export function createStorageResult<T>(
  data: T,
  adapter: string,
  fromCache?: boolean
): StorageResult<T> {
  return { data, meta: { adapter, fromCache } };
}
```

---

## Part 4: CQRS Opportunities

The `nodeIndex.ts` in-memory cache is a step toward CQRS (Command Query Responsibility Segregation). Here's how to evolve it:

### 4.1 Current State
- **Write path**: Adapters write to storage AND call `upsertNodeSummary()`
- **Read path**: `getAncestorPath()` reads from in-memory index
- **Problem**: Write path "knows" about the read model

### 4.2 Event-Driven Architecture Proposal

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Adapter   │────>│ EventBus    │────>│  NodeIndex  │
│  (Storage)  │     │ (Mediator)  │     │ (ReadModel) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                  │                    │
       │                  ▼                    │
       │          ┌─────────────┐              │
       └─────────>│ SyncTrigger │              │
                  │ (Listener)  │              │
                  └─────────────┘
```

**Implementation**:

```typescript
// New: src/events/storageEventBus.ts
type StorageEvent =
  | { type: 'NODE_CREATED'; node: TreeNode }
  | { type: 'NODE_UPDATED'; node: TreeNode }
  | { type: 'NODE_DELETED'; nodeId: string }
  | { type: 'FIELD_CREATED'; field: DataField }
  | { type: 'FIELD_UPDATED'; field: DataField }
  | { type: 'FIELD_DELETED'; fieldId: string };

type Subscriber = (event: StorageEvent) => void;

class StorageEventBus {
  private subscribers: Subscriber[] = [];

  subscribe(fn: Subscriber): () => void { ... }
  emit(event: StorageEvent): void { ... }
}

export const storageEventBus = new StorageEventBus();
```

**Benefits**:
1. Adapters only emit events, don't know about index
2. Index subscribes and updates itself
3. `triggerSync()` becomes another subscriber
4. UI refresh (`dispatchStorageChangeEvent`) becomes a subscriber
5. Easy to add analytics, logging, or other subscribers

### 4.3 Read Models Beyond Node Index

Consider extracting more read models:

```typescript
// Field counts per node (for UI badges)
const fieldCountIndex = new Map<string, number>();

// Recently updated nodes (for activity feed)
const recentActivityIndex: Array<{ nodeId: string; updatedAt: number }> = [];

// Full-text search index (future)
const searchIndex = new MiniSearch<{ id: string; text: string }>({ ... });
```

---

## Part 5: Composition & Orchestration Improvements

### 5.1 Extract `useStorageChangeListener` (mentioned above)

### 5.2 Extract `useEditableValue` from `useFieldEdit`

The preview/current/edit value management could be a generic hook:

```typescript
// New: src/hooks/useEditableValue.ts
function useEditableValue<T>(initialValue: T) {
  const current = useSignal<T>(initialValue);
  const edit = useSignal<T>(initialValue);
  const preview = useSignal<T | null>(null);

  const displayValue = preview.value ?? current.value;
  const isPreviewActive = preview.value !== null;

  const beginEdit$ = $(() => { edit.value = current.value; });
  const commitEdit$ = $(() => { current.value = edit.value; preview.value = null; });
  const cancelEdit$ = $(() => { edit.value = current.value; });
  const setPreview$ = $((v: T | null) => { preview.value = v; });

  return { current, edit, displayValue, isPreviewActive, beginEdit$, commitEdit$, cancelEdit$, setPreview$ };
}
```

### 5.3 Create `useAsyncOperation` for loading state

Pattern repeated across hooks:

```typescript
const isLoading = useSignal(false);
try {
  isLoading.value = true;
  await doWork();
} finally {
  isLoading.value = false;
}
```

**Recommendation**:

```typescript
// New: src/hooks/useAsyncOperation.ts
function useAsyncOperation() {
  const isLoading = useSignal(false);
  const error = useSignal<Error | null>(null);

  const run$ = $<T>(fn: () => Promise<T>): Promise<T | null> => {
    isLoading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      return null;
    } finally {
      isLoading.value = false;
    }
  });

  return { isLoading, error, run$ };
}
```

### 5.4 Extract navigation guard logic

Multiple transitions have the same guard:

```typescript
if (state.underConstruction) return;
```

**Recommendation**: Create guard utility:

```typescript
// src/state/guards.ts
export const guards = {
  notUnderConstruction: (state: AppState): boolean => !state.underConstruction,
  inBranchView: (state: AppState): boolean => state.view.state === 'BRANCH',
};

// Usage in transitions:
navigateToNode: (state, nodeId) => {
  if (!guards.notUnderConstruction(state)) return;
  // ...
}
```

---

## Part 6: Decoupling Opportunities

### 6.1 Service Context Provider

Instead of `getNodeService()` module-level function:

```typescript
// New: src/data/services/ServiceContext.ts
export const NodeServiceContext = createContextId<INodeService>('node.service');
export const FieldServiceContext = createContextId<IFieldService>('field.service');

export function useNodeService(): INodeService {
  return useContext(NodeServiceContext);
}

export function useFieldService(): IFieldService {
  return useContext(FieldServiceContext);
}

// In root.tsx:
const nodeService = nodeServiceFromAdapter(idbAdapter);
useContextProvider(NodeServiceContext, nodeService);
```

**Benefits**:
- Easier testing (provide mock in test context)
- No module-level mutable state
- Follows Qwik idioms

### 6.2 Decouple Sync Trigger

Currently `triggerSync()` is called directly after every CUD operation. Consider:

1. **Event-based** (see CQRS section)
2. **Decorator pattern** for services:

```typescript
function withSyncTrigger<T extends IFieldService>(service: T): T {
  return {
    ...service,
    updateFieldValue: async (fieldId, newValue) => {
      await service.updateFieldValue(fieldId, newValue);
      triggerSync();
    },
    // ... wrap other methods
  };
}
```

### 6.3 Abstract Time Provider

`now()` is already extracted to `src/utils/time.ts`, but consider a full provider:

```typescript
// src/utils/time.ts
interface TimeProvider {
  now(): number;
}

const realTimeProvider: TimeProvider = { now: () => Date.now() };
let activeProvider = realTimeProvider;

export function setTimeProvider(provider: TimeProvider): void {
  activeProvider = provider;
}

export function now(): number {
  return activeProvider.now();
}
```

This makes time-dependent tests deterministic.

---

## Part 7: Quick Wins (Low Effort, High Value)

### 7.1 Extract magic numbers to constants
**Location**: `src/hooks/useFieldEdit.ts`, `src/hooks/useSyncTrigger.ts`

```typescript
// New: src/constants/timing.ts
export const TIMING = {
  FOCUS_DELAY_MS: 10,
  BLUR_SUPPRESS_WINDOW_MS: 220,
  DOUBLE_TAP_THRESHOLD_MS: 280,
  SYNC_DEBOUNCE_MS: 500,
  DEFAULT_SYNC_INTERVAL_MS: 600000, // 10 minutes
} as const;
```

### 7.2 Remove unused `nodeId` prop from DataCard
**Location**: `src/components/DataCard/DataCard.tsx`

Per ISSUES.md, this prop is never used.

### 7.3 Add barrel exports for hooks
**Create**: `src/hooks/index.ts`

```typescript
export { useFieldEdit } from './useFieldEdit';
export { useNodeCreation } from './useNodeCreation';
export { usePendingForms } from './usePendingForms';
export { useDoubleTap } from './useDoubleTap';
export { useAncestorPath } from './useAncestorPath';
export { useBranchViewData } from './useBranchViewData';
export { useRootViewData } from './useRootViewData';
export { useTreeNodeFields } from '../components/TreeNode/useTreeNodeFields';
// etc.
```

### 7.4 Add barrel exports for sync strategies
**Create**: `src/data/sync/index.ts`

```typescript
export { SyncManager, getSyncManager, initializeSyncManager } from './syncManager';
export { SyncPusher } from './SyncPusher';
export { SyncLifecycle } from './SyncLifecycle';
export { ServerAuthorityResolver } from './ServerAuthorityResolver';
export * from './strategies';
```

### 7.5 Consolidate console.log statements

Currently logging is inconsistent. Consider:

```typescript
// src/utils/logger.ts
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LOG_LEVELS[number];

const currentLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';

export const logger = {
  debug: (tag: string, ...args: unknown[]) => { ... },
  info: (tag: string, ...args: unknown[]) => { ... },
  warn: (tag: string, ...args: unknown[]) => { ... },
  error: (tag: string, ...args: unknown[]) => { ... },
};
```

---

## Part 8: Larger Refactoring Projects

### 8.1 Full CQRS Implementation
**Effort**: Medium-High
**Value**: High

See Part 4. This enables:
- Better separation of read/write paths
- Easier caching strategies
- Foundation for offline-first optimistic updates

### 8.2 Service Layer Rewrite with Event Sourcing
**Effort**: High
**Value**: High (for audit/undo features)

Instead of direct mutations, emit events:

```typescript
await commandBus.execute({
  type: 'UPDATE_FIELD_VALUE',
  fieldId,
  newValue,
  userId: getCurrentUserId(),
});
```

Benefits:
- Full audit trail built-in
- Easy undo/redo implementation
- Better offline conflict resolution

### 8.3 Extract Sync System to Standalone Module
**Effort**: Medium
**Value**: Medium

The sync system (`SyncManager`, `SyncPusher`, strategies, etc.) could be a standalone package:

```
@blarvin/offline-sync
├── SyncManager
├── SyncPusher
├── SyncLifecycle
├── strategies/
└── interfaces/
```

---

## Part 9: Prioritized Recommendations

### Immediate (This Sprint)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Extract magic numbers to `TIMING` constants | Low | Medium |
| 2 | Remove unused `nodeId` prop from DataCard | Low | Low |
| 3 | Extract `persistUIPrefs()` helper | Low | Low |
| 4 | Create barrel exports (`hooks/index.ts`, etc.) | Low | Medium |

### Short-Term (Next 2 Sprints)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 5 | Extract `useStorageChangeListener` hook | Low | Medium |
| 6 | Extract `nextRev()` to `historyHelpers.ts` | Low | Medium |
| 7 | Extract `createStorageResult()` to shared module | Low | Low |
| 8 | Create basic `StorageEventBus` | Medium | High |

### Medium-Term (Next Quarter)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 9 | Migrate node index to event-driven updates | Medium | High |
| 10 | Extract `SyncQueueManager` from `IDBAdapter` | Medium | Medium |
| 11 | Implement service context providers | Medium | Medium |
| 12 | Create `useAsyncOperation` hook | Low | Medium |

### Long-Term (Future Phases)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 13 | Full CQRS with read model projections | High | High |
| 14 | Event sourcing for undo/redo | High | High |
| 15 | Extract sync to standalone package | High | Medium |

---

## Part 10: Files to Delete (Dead Code)

Per CLAUDE.md, the following should be reviewed:

```
src/data/repo/  (if exists - no imports found)
```

---

## Appendix A: Proposed Directory Structure

```
src/
├── components/          # UI components (unchanged)
├── data/
│   ├── models.ts       # Domain types
│   ├── events/         # NEW: StorageEventBus, event types
│   │   ├── eventBus.ts
│   │   └── eventTypes.ts
│   ├── services/
│   │   ├── index.ts    # Service registry (refactored)
│   │   ├── interfaces.ts  # INodeService, IFieldService
│   │   └── context.ts  # NEW: Service context providers
│   ├── storage/
│   │   ├── IDBAdapter.ts  # Pure storage (sync queue extracted)
│   │   ├── firestoreAdapter.ts
│   │   ├── storageAdapter.ts
│   │   ├── storageResult.ts  # NEW: Shared result factory
│   │   └── historyHelpers.ts  # Expanded with nextRev
│   ├── sync/
│   │   ├── SyncManager.ts
│   │   ├── SyncPusher.ts
│   │   ├── SyncQueueManager.ts  # NEW: Extracted from IDBAdapter
│   │   ├── SyncLifecycle.ts
│   │   └── strategies/
│   └── nodeIndex.ts    # Becomes event subscriber
├── hooks/
│   ├── index.ts        # NEW: Barrel exports
│   ├── useFieldEdit.ts
│   ├── useEditableValue.ts    # NEW: Extracted
│   ├── useAsyncOperation.ts   # NEW
│   ├── useStorageChangeListener.ts  # NEW
│   └── ...
├── state/
│   ├── guards.ts       # NEW: Transition guards
│   └── ...
├── utils/
│   ├── time.ts
│   ├── id.ts
│   └── logger.ts       # NEW: Structured logging
└── constants/
    ├── index.ts
    └── timing.ts       # NEW: Magic numbers
```

---

## Appendix B: Testing Implications

The proposed changes improve testability:

1. **Service context**: Inject mocks via context provider
2. **Event bus**: Test subscribers in isolation
3. **Extracted hooks**: Unit test individual concerns
4. **Time provider**: Deterministic time in tests
5. **Sync queue manager**: Test sync logic without IDB

---

## Summary

The codebase is well-architected with strong patterns. The main opportunities are:

1. **Consistency**: Apply patterns uniformly (event bus, service context)
2. **DRY**: Extract repeated patterns into hooks/utilities
3. **CQRS Evolution**: Build on the node index pattern
4. **Decoupling**: Reduce direct dependencies between layers

Start with quick wins to build momentum, then tackle the event bus infrastructure as it unlocks many downstream improvements.
