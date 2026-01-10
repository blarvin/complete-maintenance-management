# Refactoring Audit

Comprehensive audit of the codebase for simplification opportunities, unused code, magic numbers, and SOLID violations.

---

## 1. Dead Code (High Priority)

### 1.1 Entire `src/data/repo/` Folder

The repository layer was superseded by the adapter pattern but never deleted:

| File | Status | Notes |
|------|--------|-------|
| `src/data/repo/treeNodes.ts` | DEAD | 40 lines, no imports found anywhere |
| `src/data/repo/dataFields.ts` | DEAD | 137 lines, no imports found anywhere |
| `src/data/repo/dataFieldHistory.ts` | DEAD | Empty file (1 line) |

**Action**: Delete the entire `src/data/repo/` folder.

---

## 2. Bugs / Inconsistencies (High Priority)

### 2.1 Sorting Direction Mismatch

The IDBAdapter and FirestoreAdapter sort nodes in **opposite directions**, causing different behavior online vs offline:

| Method | IDBAdapter | FirestoreAdapter | SPEC |
|--------|------------|------------------|------|
| `listRootNodes()` | Descending (`b - a`) | Ascending (`orderBy("updatedAt", "asc")`) | "ascending" |
| `listChildren()` | Descending (`b - a`) | Ascending (`orderBy("updatedAt", "asc")`) | "ascending" |

**Location**:
- `src/data/storage/idbAdapter.ts:46` and `:58`
- `src/data/storage/firestoreAdapter.ts:76` and `:109`

**SPEC Reference**: "Children within a parent are displayed sorted by `updatedAt` ascending."

**Action**: Fix IDBAdapter to sort ascending:
```typescript
// idbAdapter.ts:46 - Change from:
nodes.sort((a, b) => b.updatedAt - a.updatedAt);
// To:
nodes.sort((a, b) => a.updatedAt - b.updatedAt);
```

---

## 3. Magic Numbers (Medium Priority)

### 3.1 Well-Named Constants (No Action Needed)
These are already properly named and exported:
- `DOUBLE_TAP_THRESHOLD_MS = 280` — `src/hooks/useDoubleTap.ts:4`
- `DOUBLE_TAP_SLOP_PX = 6` — `src/hooks/useDoubleTap.ts:5`
- `MAX_PENDING_FORMS = 30` — `src/components/FieldList/FieldList.tsx:25`

### 3.2 Inline Magic Numbers (Should Extract)

| Value | Location | Purpose | Suggested Constant |
|-------|----------|---------|-------------------|
| `10` | `useFieldEdit.ts:132` | Focus delay timeout (ms) | `FOCUS_DELAY_MS` |
| `220` | `useFieldEdit.ts:208` | Suppress blur cancel window (ms) | `BLUR_SUPPRESS_WINDOW_MS` |
| `600000` | `syncManager.ts:32` | Default poll interval (10 min) | `DEFAULT_SYNC_INTERVAL_MS` |

**Action**: Consider extracting these to `constants.ts` or to local `const` declarations with descriptive names.

---

## 4. SOLID Violations

### 4.1 Single Responsibility Principle (SRP)

#### SyncManager has too many responsibilities
`src/data/sync/syncManager.ts` handles:
1. Timer/interval management
2. Online/offline event handling
3. Push logic (local → remote)
4. Pull logic (remote → local)
5. LWW conflict resolution
6. Singleton instance management

**Suggestion**: Consider splitting into:
- `SyncScheduler` — timer and event handling
- `PushSync` — push operations
- `PullSync` — pull operations with LWW
- Keep `SyncManager` as a facade

**Priority**: Low — current implementation works, but harder to test/extend.

### 4.2 Don't Repeat Yourself (DRY)

#### History creation logic duplicated
Both `IDBAdapter` and `FirestoreAdapter` contain nearly identical history entry creation code in:
- `createField()`
- `updateFieldValue()`
- `deleteField()`

**Location**:
- `src/data/storage/idbAdapter.ts:175-189`, `218-232`, `259-273`
- `src/data/storage/firestoreAdapter.ts:243-256`, `286-300`, `327-341`

**Suggestion**: Extract a `createHistoryEntry()` helper function.

#### `nextRev()` and `recomputeCardOrder()` duplicated
Both adapters implement these identically.

**Suggestion**: Could extract to a shared utility, but may not be worth the abstraction overhead.

### 4.3 Open-Closed Principle (OCP)

#### SyncManager switch statement
`processSyncItem()` uses a switch on operation types:
```typescript
switch (item.operation) {
  case 'create-node': ...
  case 'update-node': ...
  case 'delete-node': ...
  case 'create-field': ...
  // Each new operation requires modifying this method
}
```

**Location**: `src/data/sync/syncManager.ts:166-199`

**Suggestion**: Use a strategy pattern or operation handlers map for extensibility.

**Priority**: Low — current set of operations is stable.

### 4.4 Dependency Inversion Principle (DIP)

#### SyncManager bypasses FirestoreAdapter
SyncManager directly imports and uses Firestore SDK functions (`setDoc`, `deleteDoc`, etc.) instead of using the `FirestoreAdapter`:

```typescript
// syncManager.ts
import { setDoc, deleteDoc, ... } from 'firebase/firestore';
// ...
await setDoc(doc(firestoreDb, COLLECTIONS.NODES, node.id), node);
```

This breaks the abstraction layer that `StorageAdapter` provides.

**Location**: `src/data/sync/syncManager.ts:19-21`, `:166-199`

**Suggestion**: Add push methods to `FirestoreAdapter` or accept that SyncManager is a Firestore-specific implementation.

---

## 5. Unused Code / Props

### 5.1 Unused Props
| Component | Prop | Status |
|-----------|------|--------|
| `DataCard` | `nodeId` | Declared but never used in component body |

**Location**: `src/components/DataCard/DataCard.tsx:16`

### 5.2 Unused Utilities

| Function | Location | Status |
|----------|----------|--------|
| `safeAsync` | `src/data/services/withErrorHandling.ts` | Exported but per IMPLEMENTATION.md "Not currently applied everywhere" |

**Note**: May be used in future; keep but document intent.

---

## 6. Structural Simplification Opportunities

### 6.1 Flatten Hook Returns
Several hooks return objects with many properties. Example from `useFieldEdit`:

```typescript
return {
    isEditing,
    displayValue,
    isPreviewActive,
    hasValue,
    editValue,
    editInputRef,
    rootRef,
    beginEdit$,
    save$,
    cancel$,
    valuePointerDown$,
    valueKeyDown$,
    inputPointerDown$,
    inputBlur$,
    inputKeyDown$,
    inputChange$,
    setPreview$,
    revert$,
    clearPreview$,
};  // 19 properties!
```

**Observation**: While comprehensive, this is a lot of surface area. Could group related handlers into sub-objects, but current flat structure works fine with destructuring.

**Priority**: Low — no action needed.

### 6.2 Singleton Pattern in SyncManager

```typescript
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(...): SyncManager { ... }
export function initializeSyncManager(...): SyncManager { ... }
```

**Location**: `src/data/sync/syncManager.ts:328-355`

**Issue**: Global mutable state makes testing harder and couples initialization to module load.

**Suggestion**: Consider dependency injection pattern instead, or at least a `resetSyncManager()` for tests.

---

## 7. Code Style Observations

### 7.1 Inconsistent Error Handling Patterns
- `FirestoreAdapter` has comprehensive try/catch with `mapFirestoreError()`
- `IDBAdapter` has minimal error handling (relies on Dexie's built-in)

### 7.2 Console Logging
`SyncManager` has extensive `console.log()` statements. These are helpful for debugging but should eventually move to a proper logging abstraction with log levels.

**Location**: Throughout `src/data/sync/syncManager.ts`

---

## 8. Summary of Recommended Actions

### Immediate (High Priority)
1. **Delete** `src/data/repo/` folder (dead code)
2. **Fix** IDBAdapter sort direction to match FirestoreAdapter and SPEC (ascending)

### Short-Term (Medium Priority)
3. Extract inline magic numbers to named constants
4. Remove unused `nodeId` prop from DataCard

### Long-Term (Low Priority)
5. Consider extracting SyncManager responsibilities
6. Extract shared history creation logic to utility
7. Replace SyncManager's direct Firestore SDK usage with adapter methods
8. Add proper logging abstraction

---

## 9. What's Working Well

Despite the issues above, the codebase has strong fundamentals:

- **Clear type system**: Discriminated unions for state, type guards for narrowing
- **Good separation**: Components, hooks, state, services, storage all in logical folders
- **FSM pattern**: Application state uses finite state machine approach
- **Adapter pattern**: Storage abstraction is solid (once sync manager is fixed)
- **Test coverage**: Comprehensive tests for core functionality (212 tests passing)
- **Documentation**: SPECIFICATION.md, IMPLEMENTATION.md, and LATER.md provide context

---

*Audit completed: 2026-01-10*
