# Expected Test Failures Before IDB Refactor

This document describes which tests will **FAIL** before implementing the IDB cache layer, and why. These are **intentional failures** - part of the TDD (Test-Driven Development) approach.

## ⚠️ Important: These are REAL TDD Failures

**Stub implementations have been created** so tests fail on **behavior**, not imports:
- ✅ `src/data/storage/db.ts` - Dexie schema (working)
- ✅ `src/data/storage/idbAdapter.ts` - Stub with "Not implemented" methods
- ✅ `src/data/sync/syncManager.ts` - Stub with "Not implemented" methods

**Tests can run and will fail with:**
```
Error: Not implemented: createNode
Error: Not implemented: syncOnce
... (meaningful behavioral failures)
```

**This is proper TDD:** Tests tell you *what* to implement, not just *that* files are missing.

## TL;DR - What Should Happen

**Before implementing IDB adapter:**
- ❌ All tests in `idbAdapter.test.ts` will FAIL (module doesn't exist)
- ❌ All tests in `syncManager.test.ts` will FAIL (module doesn't exist)
- ❌ All tests in `offline.cy.ts` will FAIL (app requires Firestore)
- ✅ Existing tests in `serviceLayer.test.ts` should PASS (uses Firestore)
- ✅ Existing Cypress tests should PASS (uses Firestore + emulator)

**After implementing IDB adapter:**
- ✅ All tests should PASS
- App works fully offline
- Sync manager handles bidirectional sync

---

## Unit Tests (Vitest)

### 1. `src/test/idbAdapter.test.ts` - **ALL WILL FAIL**

**Failure Reason:** Methods throw "Not implemented" errors.

```bash
Error: Not implemented: createNode
Error: Not implemented: getNode
Error: Not implemented: listRootNodes
... (etc for all 40 tests)
```

**Total Test Count:** ~40 tests

**Test Groups:**
- Node Operations (8 tests) - create, read, update, delete, list
- Field Operations (8 tests) - CRUD, cardOrder calculation
- History Operations (5 tests) - create/update/delete history tracking
- Sync Queue Operations (7 tests) - enqueue, mark synced/failed
- Sync Metadata Operations (3 tests) - lastSyncTimestamp get/set
- Remote Update Application (2 tests) - apply remote changes to IDB

**Expected Errors (REAL TDD):**
```
FAIL  src/test/idbAdapter.test.ts
  ● IDBAdapter - Core Storage Operations › Node Operations › creates node and persists to IndexedDB
    Error: Not implemented: createNode

  ● IDBAdapter - Core Storage Operations › Node Operations › lists root nodes from IndexedDB
    Error: Not implemented: listRootNodes

  ... (40 behavioral failures)
```

**When These Should Pass:**
After implementing each method in `src/data/storage/idbAdapter.ts`

**This is REAL TDD:** Tests fail on behavior, not imports.

---

### 2. `src/test/syncManager.test.ts` - **ALL WILL FAIL**

**Failure Reason:** Methods throw "Not implemented" errors, plus depends on IDBAdapter implementation.

```bash
Error: Not implemented: syncOnce
Error: Not implemented: start
Error: Not implemented: stop
... (etc for all 20 tests)
```

**Total Test Count:** ~20 tests

**Test Groups:**
- Push (Local → Remote) (5 tests) - queue processing, error handling
- Pull (Remote → Local) (2 tests) - fetch remote updates
- LWW Conflict Resolution (3 tests) - last-write-wins logic
- Online/Offline Handling (3 tests) - skip when offline, sync on reconnect
- Sync Manager Lifecycle (3 tests) - start/stop, enable/disable
- Field Sync (2 tests) - field create/update sync

**Expected Errors (REAL TDD):**
```
FAIL  src/test/syncManager.test.ts
  ● SyncManager - Bidirectional Sync › Push › pushes pending create-node operation
    Error: Not implemented: createNode (from IDBAdapter)

  ● SyncManager - Bidirectional Sync › Sync Manager Lifecycle › starts and stops without errors
    Error: Not implemented: start

  ... (20 behavioral failures)
```

**When These Should Pass:**
After implementing:
1. All IDBAdapter methods (dependency)
2. All SyncManager methods

**This is REAL TDD:** Tests fail on behavior, not imports.

---

### 3. Existing Tests - **SHOULD STILL PASS** ✅

**These tests use Firestore and should continue working:**

**`src/test/serviceLayer.test.ts`** - ✅ PASS
- Tests service layer against Firestore emulator
- Uses `getNodeService()` and `getFieldService()`
- ~50 tests covering CRUD operations

**`src/test/createNodeService.test.ts`** - ✅ PASS
- Tests node creation flows
- ~15 tests

**`src/test/appState.test.ts`** - ✅ PASS
- Pure state management tests (no persistence)

**`src/test/doubleTap.test.ts`** - ✅ PASS
- Pure function tests

**`src/test/uiPrefs.test.ts`** - ✅ PASS
- localStorage tests (not affected)

---

## E2E Tests (Cypress)

### 1. `cypress/e2e/offline.cy.ts` - **ALL WILL FAIL**

**Failure Reason:** App currently requires Firestore connection. When mocking offline, app breaks.

**Total Test Count:** 8 tests

**Expected Failures:**

```javascript
✗ creates node while offline
  Error: Cannot read data - Firestore connection required

✗ edits field value while offline
  Error: Cannot read data - Firestore connection required

✗ navigates while offline
  Error: Cannot read data - Firestore connection required

✗ syncs data when coming back online
  Error: Node not found (wasn't persisted to IDB)

✗ handles sync conflicts with Last-Write-Wins
  Error: No sync manager to handle conflicts

✗ shows all data after multiple offline sessions
  Error: Data not persisting to IDB

✗ works when Firestore is unavailable
  Error: App crashes without Firestore
```

**Why They Fail:**
- App tries to read from Firestore on page load
- No IndexedDB adapter to fall back to
- No sync queue to store offline operations
- Components call `getNodeService()` which uses `FirestoreAdapter` directly

**When These Should Pass:**
After:
1. Implementing `IDBAdapter`
2. Implementing `SyncManager`
3. Updating `services/index.ts` to use `IDBAdapter` as default
4. Starting `SyncManager` in `root.tsx`

---

### 2. Existing Cypress Tests - **SHOULD STILL PASS** ✅

**But with one caveat: stronger persistence verification**

**`cypress/e2e/smoke.cy.ts`** - ✅ PASS (NOW IMPROVED)
- Original 3 tests still pass
- **New tests added:**
  - ✅ `persists created node across page reload`
  - ✅ `persists field edits across page reload`
- These new tests verify Firestore persistence works now
- Will continue to pass after IDB refactor (just using IDB instead)

**`cypress/e2e/navigation.cy.ts`** - ✅ PASS (NOW IMPROVED)
- Original 6 tests still pass
- **New tests added:**
  - ✅ `creates child node and verifies it persists after reload`
  - ✅ `navigates to newly created node after reload`
- Stronger persistence verification

**`cypress/e2e/node-creation.cy.ts`** - ✅ PASS
- Tests creating nodes (already verifies persistence)

**`cypress/e2e/datacard.cy.ts`** - ✅ PASS
- Tests UI expansion and field editing
- Field edit test already verifies persistence

**`cypress/e2e/layout.cy.ts`** - ✅ PASS (if exists)
- Pure UI tests

---

## How to Run Tests Before Refactor

### Run Unit Tests

```bash
npm run test
```

**Expected Output:**
```
FAIL  src/test/idbAdapter.test.ts
  ● IDBAdapter › Node Operations › creates node and persists to IndexedDB
    Error: Not implemented: createNode

  ● IDBAdapter › Node Operations › lists root nodes from IndexedDB
    Error: Not implemented: listRootNodes

  ● IDBAdapter › Node Operations › gets node by ID
    Error: Not implemented: createNode

  ... (40 tests failing with "Not implemented" errors)

FAIL  src/test/syncManager.test.ts
  ● SyncManager › Push › pushes pending create-node operation
    Error: Not implemented: createNode (from IDBAdapter)

  ● SyncManager › Sync Manager Lifecycle › starts and stops
    Error: Not implemented: start

  ... (20 tests failing with "Not implemented" errors)

PASS  src/test/serviceLayer.test.ts (50 tests)
PASS  src/test/createNodeService.test.ts (15 tests)
PASS  src/test/appState.test.ts
PASS  src/test/doubleTap.test.ts
PASS  src/test/uiPrefs.test.ts

Test Suites: 2 failed, 5 passed, 7 total
Tests:       65 passed, 60 failed (behavioral failures - NOT import errors)
```

### Run E2E Tests

```bash
npm run test:e2e
# or
npx cypress open
```

**Expected Output:**
```
FAIL  cypress/e2e/offline.cy.ts (8 tests)
  ✗ creates node while offline
  ✗ edits field value while offline
  ✗ navigates while offline
  ✗ syncs data when coming back online
  ✗ handles sync conflicts with Last-Write-Wins
  ✗ shows all data after multiple offline sessions
  ✗ works when Firestore is unavailable

PASS  cypress/e2e/smoke.cy.ts (5 tests)
PASS  cypress/e2e/navigation.cy.ts (8 tests)
PASS  cypress/e2e/node-creation.cy.ts
PASS  cypress/e2e/datacard.cy.ts

Specs:   1 failed, 4 passed, 5 total
```

---

## What "Red" Looks Like

### Before Implementation

```
📊 Test Summary:
   Unit Tests:    ~65 passed, ~60 failed (modules missing)
   E2E Tests:     ~30 passed, ~8 failed (offline tests)
   Total:         ~95 passed, ~68 failed

❌ Status: RED - Expected failures in new TDD tests
✅ Status: GREEN - All existing Firestore tests pass
```

### After Implementation

```
📊 Test Summary:
   Unit Tests:    ~125 passed, 0 failed
   E2E Tests:     ~38 passed, 0 failed
   Total:         ~163 passed, 0 failed

✅ Status: GREEN - All tests pass!
🎉 Refactor complete!
```

---

## Summary of Expected Failures

| Test File | Total Tests | Before Refactor | After Refactor |
|-----------|-------------|-----------------|----------------|
| `idbAdapter.test.ts` | ~40 | ❌ ALL FAIL | ✅ ALL PASS |
| `syncManager.test.ts` | ~20 | ❌ ALL FAIL | ✅ ALL PASS |
| `offline.cy.ts` | 8 | ❌ ALL FAIL | ✅ ALL PASS |
| `smoke.cy.ts` | 5 | ✅ PASS | ✅ PASS |
| `navigation.cy.ts` | 8 | ✅ PASS | ✅ PASS |
| `node-creation.cy.ts` | ~5 | ✅ PASS | ✅ PASS |
| `datacard.cy.ts` | ~10 | ✅ PASS | ✅ PASS |
| `serviceLayer.test.ts` | ~50 | ✅ PASS | ✅ PASS |
| `createNodeService.test.ts` | ~15 | ✅ PASS | ✅ PASS |
| Other unit tests | ~10 | ✅ PASS | ✅ PASS |
| **TOTALS** | **~171** | **~68 FAIL, ~103 PASS** | **✅ ALL PASS** |

---

## Next Steps

1. **Run tests now to see baseline** ✅
   ```bash
   npm run test
   npx cypress open
   ```

2. **Expect these failures:**
   - `idbAdapter.test.ts` - module not found
   - `syncManager.test.ts` - module not found
   - `offline.cy.ts` - app requires Firestore

3. **Start implementing:**
   - Follow `idb-cache-sync-manager.plan.md`
   - Implement until tests pass (Red → Green)
   - Refactor while keeping tests green

4. **Success criteria:**
   - All 171 tests pass
   - App works fully offline
   - Sync manager handles bidirectional sync
   - No regressions in existing functionality

---

## Troubleshooting

### If existing tests fail unexpectedly:

**Problem:** `serviceLayer.test.ts` fails
**Cause:** Firestore emulator not running
**Solution:** `npm run emulator` in separate terminal

**Problem:** Cypress tests fail to load
**Cause:** Seed data not loading
**Solution:** Check `cypress/support/seed-data.ts` connects to emulator

### If new tests don't fail:

**Problem:** `idbAdapter.test.ts` doesn't fail
**Cause:** Module might already exist from previous attempt
**Solution:** Delete `src/data/storage/idbAdapter.ts` if it exists

---

## Why TDD Approach?

**Traditional approach (Implementation → Tests):**
1. Write IDBAdapter
2. Test it manually
3. Find bugs
4. Fix bugs
5. Realize you forgot edge cases
6. Write tests
7. Find more bugs

**TDD approach (Tests → Implementation):**
1. Write tests defining behavior ← **You are here**
2. Run tests (they fail - "RED")
3. Write minimal code to pass tests
4. Run tests (they pass - "GREEN")
5. Refactor with confidence
6. Tests catch regressions immediately

**Benefits:**
- ✅ Clear specification before coding
- ✅ Can't forget edge cases (already in tests)
- ✅ Confidence during refactor
- ✅ Living documentation
- ✅ Faster overall (fewer debugging cycles)

---

**Ready to implement? Start with Phase 1 of `idb-cache-sync-manager.plan.md`**
