---
name: IDBAdapter sort direction fix
overview: Change IDBAdapter to sort nodes (root and children) by updatedAt ascending so it matches FirestoreAdapter and SPECIFICATION.md. DataFields already sort by cardOrder ascending and need no change.
todos: []
isProject: false
---

# Fix IDBAdapter sort direction to match FirestoreAdapter (ascending per SPEC)

## Context

**SPECIFICATION.md** (lines 206–207) states:

- Children within a parent are displayed sorted by `updatedAt` **ascending**.
- DataFields within a DataCard are displayed sorted by `cardOrder` ascending.

**FirestoreAdapter** already uses `orderBy("updatedAt", "asc")` for root nodes and children ([firestoreAdapter.ts](src/data/storage/firestoreAdapter.ts) lines 80, 114). **IDBAdapter** currently sorts root nodes and children by `updatedAt` **descending** ([IDBAdapter.ts](src/data/storage/IDBAdapter.ts) lines 46–47 and 60–61), causing different display order offline vs online.

DataFields in IDBAdapter already sort by `cardOrder` ascending (line 159); no change there.

## Changes

### 1. [src/data/storage/IDBAdapter.ts](src/data/storage/IDBAdapter.ts)

- **listRootNodes()** (lines 45–47): Change sort from descending to ascending.
  - Replace: `nodes.sort((a, b) => b.updatedAt - a.updatedAt);`
  - With: `nodes.sort((a, b) => a.updatedAt - b.updatedAt);`
  - Update comment to: `// Sort by updatedAt ascending (per SPEC)`
- **listChildren(parentId)** (lines 59–61): Change sort from descending to ascending.
  - Replace: `activeChildren.sort((a, b) => b.updatedAt - a.updatedAt);`
  - With: `activeChildren.sort((a, b) => a.updatedAt - b.updatedAt);`
  - Update comment to: `// Sort by updatedAt ascending (per SPEC)`

### 2. Tests

Existing tests in [idbAdapter.test.ts](src/test/idbAdapter.test.ts) call `listRootNodes` and `listChildren` but do not assert result order. No test changes are required for the fix to be correct. Optionally add one test that creates two root nodes (or two children) with known `updatedAt` values and asserts the returned array order is ascending; this is a small regression guard, not mandatory for closing the issue.

### 3. ISSUES.md

- Mark line 39 as done: change `- [ ]` to `- [x]` for "Fix IDBAdapter sort direction to match FirestoreAdapter (ascending per SPEC)".

## Summary

| Location               | Current (IDBAdapter) | After fix     | FirestoreAdapter |
| ---------------------- | -------------------- | ------------- | ---------------- |
| listRootNodes          | updatedAt desc       | updatedAt asc | updatedAt asc    |
| listChildren           | updatedAt desc       | updatedAt asc | updatedAt asc    |
| listFields (cardOrder) | cardOrder asc        | no change     | cardOrder asc    |

No other files need changes. UI and services consume adapter results; they will now see ascending order from both adapters.
