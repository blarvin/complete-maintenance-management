---
name: Firestore Adapter Refactor
overview: Refactor all Firestore logic from repo/ into a concrete FirestoreAdapter class that implements StorageAdapter, achieving backend independence and architectural purity.
todos:
  - id: create-firestore-adapter
    content: Create FirestoreAdapter class in src/data/storage/firestoreAdapter.ts implementing StorageAdapter interface with all node, field, and history operations
    status: pending
  - id: update-services-index
    content: Update src/data/services/index.ts to instantiate FirestoreAdapter and set it as default via useStorageAdapter()
    status: pending
  - id: update-service-files
    content: Delete nodeService.ts, fieldService.ts, and createNode.ts; rely on adapter-based services from services/index.ts
    status: pending
  - id: update-tests
    content: Update tests to use registry (getNodeService/getFieldService) with FirestoreAdapter; no direct repo or service-file imports
    status: pending
  - id: remove-repo-layer
    content: Delete src/data/repo/treeNodes.ts and src/data/repo/dataFields.ts after verifying no remaining imports
    status: pending
  - id: update-documentation
    content: Update IMPLEMENTATION.md to reflect adapter-based architecture and new file organization
    status: pending
---

# Firestore Adapter Refactor Plan

## Overview

Move all Firestore-specific logic from `src/data/repo/` into a concrete `FirestoreAdapter` class that implements the `StorageAdapter` interface. This achieves backend independence and architectural purity by isolating Firestore operations behind the adapter abstraction.

## Current State

- **Repo layer** (`src/data/repo/treeNodes.ts`, `src/data/repo/dataFields.ts`): Contains direct Firestore operations using `db`, `collection`, `doc`, `getDoc`, `setDoc`, etc.
- **Services** (`src/data/services/nodeService.ts`, `src/data/services/fieldService.ts`, `src/data/services/createNode.ts`): Import and call repo functions directly
- **StorageAdapter interface** (`src/data/storage/storageAdapter.ts`): Already defined but not implemented
- **Tests**: Import from repo layer directly

## Target State

- **FirestoreAdapter** (`src/data/storage/firestoreAdapter.ts`): Concrete implementation of `StorageAdapter` containing all Firestore operations
- **Services**: Adapter-backed defaults via `useStorageAdapter()` in `src/data/services/index.ts`; no service files under `services/` besides the registry
- **Repo layer**: Removed after migration
- **Tests**: Use the same registry as components (`getNodeService`/`getFieldService`) with `FirestoreAdapter`; no mocks

## Implementation Steps

### 1. Create FirestoreAdapter Class

**File**: `src/data/storage/firestoreAdapter.ts`

- Implement `StorageAdapter` interface
- Import Firestore dependencies (`db` from `firebase.ts`, Firestore functions)
- Import domain models (`TreeNode`, `DataField`, `DataFieldHistory`)
- Import utilities (`getCurrentUserId`, `now`, `COLLECTIONS`)
- Import error utilities (`toStorageError`, `makeStorageError`)

**Methods to implement** (mapping from repo functions):

**Node operations:**

- `listRootNodes()` → from `listRootNodes()` in `repo/treeNodes.ts`
- `getNode(id)` → from `getNodeById()` in `repo/treeNodes.ts`
- `listChildren(parentId)` → from `listChildren()` in `repo/treeNodes.ts`
- `createNode(input)` → from `createNode()` in `repo/treeNodes.ts`
- `updateNode(id, updates)` → from `updateNode()` in `repo/treeNodes.ts`
- `deleteNode(id, opts)` → from `deleteLeafNode()` in `repo/treeNodes.ts` (with leaf-check logic)

**Field operations:**

- `listFields(parentNodeId)` → from `listFieldsForNode()` in `repo/dataFields.ts`
- `nextCardOrder(parentNodeId)` → from `nextCardOrder()` in `repo/dataFields.ts`
- `createField(input)` → from `addField()` in `repo/dataFields.ts` (includes history creation)
- `updateFieldValue(id, input)` → from `updateFieldValue()` in `repo/dataFields.ts` (includes history creation)
- `deleteField(id)` → from `deleteField()` in `repo/dataFields.ts` (includes history creation and cardOrder recomputation)

**History operations:**

- `getFieldHistory(dataFieldId)` → from `getFieldHistory()` in `repo/dataFields.ts`

**Internal helpers:**

- `nextRev(dataFieldId)` → private method (from `nextRev()` in `repo/dataFields.ts`)
- `recomputeCardOrder(parentNodeId)` → private method (from `recomputeCardOrder()` in `repo/dataFields.ts`)

**Key implementation details:**

- Wrap all Firestore operations in try/catch, convert errors to `StorageError` using `toStorageError()`
- Map Firestore error codes to `StorageErrorCode` (e.g., permission-denied → "unauthorized", not-found → "not-found", unavailable → "unavailable")
- Return `StorageResult<T>` with `data` and optional `meta` (set `adapter: "firestore"`)
- Handle user context: call `getCurrentUserId()` and `now()` internally for `updatedBy` and `updatedAt` fields
- Maintain existing business logic (leaf-only deletion check, cardOrder recomputation, history creation)

### 2. Update Default Services to Use Adapter

**File**: `src/data/services/index.ts`

- Create `FirestoreAdapter` instance
- Call `useStorageAdapter(firestoreAdapter)` to set it as default
- Remove direct imports from repo layer and service files
- Keep `nodeServiceFromAdapter()` and `fieldServiceFromAdapter()` functions (already exist) as the sole service factories

### 3. Remove Service Files (pure adapter)

**Files**:

- `src/data/services/nodeService.ts`
- `src/data/services/fieldService.ts`
- `src/data/services/createNode.ts`

- Delete these files (all logic is provided by adapter-backed services from the registry)
- `createWithFields` orchestration already exists in `nodeServiceFromAdapter()`; no logic loss

### 4. Update Tests

**Files**:

- `src/test/createNodeService.test.ts`
- `src/test/serviceLayer.test.ts`

- Remove imports from `../data/repo/` and deleted service files
- In test setup, instantiate `FirestoreAdapter` (or use the default) and call `useStorageAdapter(adapter)`, then use `getNodeService`/`getFieldService`
- No adapter mocks; exercise the real abstraction

### 5. Remove Repo Layer

**Files to delete**:

- `src/data/repo/treeNodes.ts`
- `src/data/repo/dataFields.ts`

- Delete after confirming no remaining imports
- Verify all functionality works through adapter

### 6. Update Documentation

**File**: `IMPLEMENTATION.md`

- Update "Service Layer" section to reflect adapter-based architecture
- Update "File Organization" section to show `storage/firestoreAdapter.ts` instead of `repo/`
- Note that Firestore is now behind adapter abstraction

## Error Handling Strategy

- Wrap all Firestore operations in try/catch blocks
- Use `toStorageError()` to convert Firestore errors to `StorageError`
- Map Firestore error codes:
- `permission-denied` → `"unauthorized"`
- `not-found` → `"not-found"`
- `unavailable` → `"unavailable"` (retryable: true)
- `failed-precondition` → `"conflict"` (for concurrent modification)
- Others → `"internal"` (retryable: false by default)
- Preserve original error in `cause` field for debugging

## Metadata Handling

- Return `StorageResult<T>` with `meta.adapter = "firestore"`
- Optionally track `meta.latencyMs` for performance monitoring (Phase 1: skip)
- Optionally track `meta.fromCache` if Firestore provides cache metadata (Phase 1: skip)

## Testing Strategy

- Tests use the same registry abstraction as components (`getNodeService`/`getFieldService`) with `FirestoreAdapter`
- No mocking for adapter; prefer real adapter against emulator
- Existing Cypress tests should continue working (they use emulator via `firebase.ts`)

## Migration Order

1. Create `FirestoreAdapter` class (all methods implemented)
2. Update `services/index.ts` to use adapter as default (registry only)
3. Delete service files (`nodeService.ts`, `fieldService.ts`, `createNode.ts`)
4. Update tests to use registry + adapter; remove repo/service imports
5. Verify all functionality works
6. Delete repo files
7. Update documentation

## Backward Compatibility

- Services maintain same public interface via registry (`INodeService`, `IFieldService`)
- Components don't need changes (they use `getNodeService()`, `getFieldService()`)
- Internal implementation changes: repo → adapter; service files removed in favor of registry-only pattern
