---
name: Use now() in initStorage and storageEvents
overview: Replace direct `Date.now()` calls in `initStorage.ts` and `storageEvents.ts` with the project's `now()` from `src/utils/time.ts`, matching the pattern already used by IDBAdapter and FirestoreAdapter and enabling future testability/server timestamps.
todos: []
isProject: false
---

# Use now() in initStorage and storageEvents

## Context

The project centralizes timestamp generation in [src/utils/time.ts](src/utils/time.ts):

- `**now()**` returns `Date.now()` today; the comment says: *"Use this instead of Date.now() directly for consistency"* and *"Future: Can swap to server-assigned timestamps, mock for tests, etc."*
- [IDBAdapter](src/data/storage/IDBAdapter.ts) and [FirestoreAdapter](src/data/storage/firestoreAdapter.ts) already use `now()` for all timestamps.
- Two storage modules still call `Date.now()` directly and are called out in [ISSUES.md](ISSUES.md) line 40.

## Locations to change


| File                                                                   | Line | Current                             | Change                         |
| ---------------------------------------------------------------------- | ---- | ----------------------------------- | ------------------------------ |
| [src/data/storage/initStorage.ts](src/data/storage/initStorage.ts)     | 121  | `value: Date.now()`                 | `value: now()`                 |
| [src/data/storage/storageEvents.ts](src/data/storage/storageEvents.ts) | 15   | `detail: { timestamp: Date.now() }` | `detail: { timestamp: now() }` |


## Implementation

1. **initStorage.ts**

- Add: `import { now } from '../../utils/time';`
- Replace the single `Date.now()` in `migrateFromFirestore()` (line 121) with `now()`.

1. **storageEvents.ts**

- Add: `import { now } from '../../utils/time';`
- Replace `Date.now()` in `dispatchStorageChangeEvent()` (line 15) with `now()`.

No test changes are required: behavior is identical (both return epoch ms). Tests that assert on timestamps use `Date.now()` or `now()` in test data; they do not depend on these two call sites.

## Verification

- Run `npm run typecheck` and `npm run test`.
- Optionally run existing initStorage tests: `src/test/initStorage.test.ts` (no changes needed; they do not mock time for these paths).

