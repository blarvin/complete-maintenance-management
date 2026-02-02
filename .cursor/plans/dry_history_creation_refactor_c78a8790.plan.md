---
name: DRY History Creation Refactor
overview: Extract duplicated DataFieldHistory creation logic from IDBAdapter and FirestoreAdapter into a shared helper, reducing adapter complexity and ensuring a single source of truth for history entry construction.
todos: []
isProject: false
---

# DRY History Creation Refactor

## Problem

Both [IDBAdapter.ts](src/data/storage/IDBAdapter.ts) and [firestoreAdapter.ts](src/data/storage/firestoreAdapter.ts) manually construct identical `DataFieldHistory` objects in six places total (create/update/delete field x 2 adapters). The structure is the same; only the source of persistence differs.

## Solution

Add a shared helper that builds the `DataFieldHistory` object. Both adapters call it instead of constructing inline.

## Implementation

### 1. Create shared helper

**New file:** [src/data/storage/historyHelpers.ts](src/data/storage/historyHelpers.ts)

```ts
import type { DataFieldHistory } from "../models";
import { getCurrentUserId } from "../../context/userContext";
import { now } from "../../utils/time";

export function createHistoryEntry(params: {
  dataFieldId: string;
  parentNodeId: string;
  action: "create" | "update" | "delete";
  prevValue: string | null;
  newValue: string | null;
  rev: number;
}): DataFieldHistory {
  const { dataFieldId, parentNodeId, action, prevValue, newValue, rev } =
    params;
  return {
    id: `${dataFieldId}:${rev}`,
    dataFieldId,
    parentNodeId,
    action,
    property: "fieldValue",
    prevValue,
    newValue,
    updatedBy: getCurrentUserId(),
    updatedAt: now(),
    rev,
  };
}
```

- `property` is always `'fieldValue'` (Phase 1 scope per SPEC)
- `updatedBy` and `updatedAt` are resolved inside the helper (adapters already use these same imports)

### 2. Refactor IDBAdapter

**File:** [src/data/storage/IDBAdapter.ts](src/data/storage/IDBAdapter.ts)

Replace each of the three inline history blocks with a call to the helper.

**Create field** (lines ~191-205): Replace manual object construction with:

```ts
const hist = createHistoryEntry({
  dataFieldId: field.id,
  parentNodeId: field.parentNodeId,
  action: "create",
  prevValue: null,
  newValue: field.fieldValue,
  rev,
});
```

**Update field** (lines ~243-257): Same pattern with `action: 'update'`, `prevValue: field.fieldValue`, `newValue: input.fieldValue`.

**Delete field** (lines ~298-312): Same pattern with `action: 'delete'`, `prevValue: field.fieldValue`, `newValue: null`.

Remove unused `getCurrentUserId` and `now` imports if they are no longer used elsewhere in the file (they are still used for field creation/update timestamps, so keep them).

### 3. Refactor FirestoreAdapter

**File:** [src/data/storage/firestoreAdapter.ts](src/data/storage/firestoreAdapter.ts)

Same replacement in all three methods:

- `createField` (lines ~253-267)
- `updateFieldValue` (lines ~297-311)
- `deleteField` (lines ~345-359)

Adapter still needs `userId` and `ts` for the field itself (create/update/delete), so `getCurrentUserId` and `now` remain in use.

### 4. Verification

- Run `npm run test` — existing idbAdapter and firestoreAdapter tests exercise create/update/delete and history creation; no test changes needed.
- Run `npm run typecheck` to confirm types.

## Optional: Unit test for helper

Add [src/test/historyHelpers.test.ts](src/test/historyHelpers.test.ts) to assert the helper produces valid `DataFieldHistory` with correct structure. Requires mocking `getCurrentUserId` and `now` (or passing them in if we change the API to accept optional overrides for testability). Defer per prototyping-first rule unless desired.

## Files changed

| File                                   | Action                |
| -------------------------------------- | --------------------- |
| `src/data/storage/historyHelpers.ts`   | Create                |
| `src/data/storage/IDBAdapter.ts`       | Refactor 3 call sites |
| `src/data/storage/firestoreAdapter.ts` | Refactor 3 call sites |

## Complexity reduction

- **Before:** ~15 lines x 6 = ~90 lines of duplicated object construction
- **After:** ~~25 lines in helper + 6 one-liner calls (~~6 lines) = ~31 lines total
- Adapters become shorter and easier to read; future history schema changes happen in one place.
