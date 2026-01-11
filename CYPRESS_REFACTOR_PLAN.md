# Cypress E2E Test Suite Refactoring Plan

## Executive Summary

Refactor the Cypress test suite to be **useful regression tests** for critical functionality rather than comprehensive but brittle coverage. Focus on scenarios Vitest cannot test (persistence, real browser APIs, user interaction flows).

**Goals:**
- Eliminate IDB seeding race conditions with single-load pattern
- Reduce test count from ~35 to ~18 (critical scenarios only)
- Remove brittle pixel-perfect layout tests
- Eliminate all `cy.wait()` timing workarounds
- Simplify to medium-priority offline coverage
- Test only critical error states

---

## Problem Analysis

### Current Issues
1. **IDB Seeding Race Condition**: `cy.visit() → seedIndexedDB() → reload()` pattern causes timing issues
2. **Brittle Layout Tests**: Pixel measurements break with minor CSS changes
3. **Timing Workarounds**: 5x `cy.wait()` calls mask reactivity issues
4. **Redundant Coverage**: Many tests duplicate Vitest unit test coverage
5. **Complex Golden Tree**: 7 nodes + 19 fields seeded for every test

### What Vitest Already Covers (Don't Duplicate)
- FSM state transitions
- Service layer CRUD operations
- IDB adapter operations
- Sync manager logic
- Double-tap algorithm
- Error handling utilities

### What Cypress Should Cover (E2E Gaps)
- Data persistence across page reloads
- Full navigation flows with real state
- User interaction sequences (double-tap, edit, save)
- Offline → online transitions
- Layout regressions (overflow, clipping)
- Critical error states (data loss prevention)

---

## Solution Design

### 1. Fix IDB Seeding with App Coordination

**Strategy:** Single page load with pre-initialization seeding

**Implementation:**

**A. New Cypress command** (`cypress/support/commands.ts`):
```typescript
Cypress.Commands.add('seedAndVisit', (url = '/') => {
  cy.visit(url, {
    onBeforeLoad: (win) => {
      // Flag tells app to skip Firestore migration
      win.__CYPRESS_SEED_MODE__ = true;
    }
  });

  // Seed IDB before app's useInitStorage() completes
  cy.window().then(async (win) => {
    await seedGoldenTree(win.indexedDB);
  });
});

Cypress.Commands.add('seedMinimal', (url = '/') => {
  cy.visit(url, {
    onBeforeLoad: (win) => {
      win.__CYPRESS_SEED_MODE__ = true;
    }
  });

  cy.window().then(async (win) => {
    await seedMinimalTree(win.indexedDB); // 1 node, 2 fields
  });
});
```

**B. Modify app initialization** (`src/data/storage/initStorage.ts`):
```typescript
// Line ~43-51, inside initializeStorage()
if (nodeCount === 0) {
  // Check for Cypress test mode
  if (typeof window !== 'undefined' && (window as any).__CYPRESS_SEED_MODE__) {
    console.log('[Storage] Cypress test mode - skipping Firestore migration');
    // IDB seeded by Cypress, skip migration
  } else if (navigator.onLine) {
    await migrateFromFirestore();
  }
}
```

**C. Extract seeding helpers** (`cypress/support/seedHelpers.ts` - new file):
```typescript
export async function seedGoldenTree(idb: IDBFactory): Promise<void> {
  // Move Golden Tree data here (7 nodes, 19 fields)
  // Open IDB, seed data
}

export async function seedMinimalTree(idb: IDBFactory): Promise<void> {
  // Single root node + 2 fields for creation tests
}
```

**Benefits:**
- Eliminates `visit → seed → reload` (single load)
- No race conditions
- Cleaner test setup: `cy.seedAndVisit()` in beforeEach
- App-aware seeding (skip migration when flagged)

---

### 2. Streamlined Test Structure

#### smoke.cy.ts - SIMPLIFY TO 2 TESTS
**Keep:**
- `persists created node across page reload` ✅ Critical
- `persists field edits across page reload` ✅ Critical

**Remove:**
- Basic rendering tests (redundant with navigation tests)

#### navigation.cy.ts - KEEP ALL (Critical for tree structure)
**Keep (8 tests):**
- ROOT view verification
- ROOT → BRANCH navigation
- Deep navigation (3+ levels)
- Up navigation
- Round-trip navigation
- Child creation persistence
- Navigate into newly created node

**Add:**
- Rapid navigation doesn't lose data (regression test)

#### datacard.cy.ts - REDUCE TO 3 TESTS
**Keep:**
- Expansion state persists across navigation ✅
- Double-click enables edit + Enter saves ✅
- Escape cancels edit ✅

**Remove:**
- Basic expansion toggle (covered by persistence test)
- Field display tests (rendering concern, not critical)
- Redundant BRANCH view tests

#### node-creation.cy.ts - REDUCE TO 3 TESTS
**Keep:**
- Creates root node with persistence check ✅
- Cancels creation without orphans ✅ (critical error state)
- Creates child node with hierarchy check ✅

**Remove:**
- UI rendering test (not critical)
- Navigation test (covered in navigation.cy.ts)

**Change:**
- Use `cy.seedMinimal()` instead of Golden Tree

#### layout.cy.ts - COMPLETE REWRITE
**Replace pixel tests with critical checks:**
```typescript
describe('Layout - Critical Checks', () => {
  beforeEach(() => {
    cy.seedMinimal(); // Simple structure
  });

  it('DataCard content does not overflow viewport', () => {
    cy.expandDataCard('root-node-id');
    cy.get('[data-testid=datacard-content]')
      .should('be.visible')
      .and('not.have.css', 'overflow-x', 'scroll');
  });

  it('Long node names do not break layout', () => {
    const longName = 'A'.repeat(200);
    // Create node with very long name
    // Verify it doesn't overflow or clip
  });

  it('Touch targets meet accessibility minimum (44px)', () => {
    cy.get('button[aria-label="Expand details"]').should(($btn) => {
      const height = $btn.height();
      expect(height).to.be.at.least(44);
    });
  });
});
```

**Remove:**
- All `getBoundingClientRect()` width comparisons
- Indent measurements
- Alignment pixel checks

#### offline.cy.ts - REDUCE TO 4 TESTS
**Keep:**
- Creates node while offline ✅
- Edits field while offline ✅
- Syncs data when coming back online ✅

**Remove:**
- Navigate while offline (redundant)
- Conflict resolution (Vitest covers LWW)
- Multiple offline sessions (edge case)
- Firestore unavailable (redundant)

---

### 3. Eliminate Timing Workarounds

**Replace all `cy.wait()` with assertions:**

```typescript
// ❌ OLD: cy.wait(300)
// ✅ NEW: Wait for Qwik signal update
cy.get('input[placeholder="Name"]').should('have.value', 'Expected Value');

// ❌ OLD: cy.wait(200) for animation
// ✅ NEW: Wait for CSS transition
cy.get('[data-testid=datacard]')
  .should('have.css', 'height')
  .and('not.equal', '0px');

// ❌ OLD: cy.wait(2000) for sync
// ✅ NEW: Poll until sync complete
cy.window().its('db.syncQueue.count()').should('equal', 0);
```

**Locations to fix:**
- `node-creation.cy.ts:47` - Remove wait before Create click
- `smoke.cy.ts:42` - Remove wait before Create click
- `offline.cy.ts:44` - Remove wait before Create click
- `offline.cy.ts:134` - Replace with sync queue assertion
- `layout.cy.ts:108` - Replace with CSS transition assertion

---

### 4. Test Data Strategy

**Golden Tree** (for navigation/editing tests):
- 7 nodes (HVAC hierarchy)
- 19 fields (realistic data)
- **Used in:** navigation.cy.ts, datacard.cy.ts, smoke.cy.ts, offline.cy.ts

**Minimal Tree** (for creation/layout tests):
- 1 root node
- 2 fields
- **Used in:** node-creation.cy.ts, layout.cy.ts

**Fixture file:** `cypress/fixtures/minimal-tree.ts` (new)
```typescript
export const MINIMAL_TREE = {
  nodes: [{
    id: 'test-root',
    nodeName: 'Test Root',
    nodeSubtitle: 'Test subtitle',
    parentId: null,
    updatedBy: 'testUser',
    updatedAt: Date.now()
  }],
  fields: [
    { id: 'field-1', fieldName: 'Type Of', fieldValue: 'Test', ... },
    { id: 'field-2', fieldName: 'Description', fieldValue: 'Test desc', ... }
  ]
};
```

---

## Implementation Steps

### Phase 1: Fix Seeding Infrastructure

1. **Create** `cypress/support/seedHelpers.ts`
   - Extract `seedGoldenTree()` function
   - Create `seedMinimalTree()` function

2. **Modify** `cypress/support/commands.ts`
   - Remove orphaned code (lines 72-190)
   - Replace `seedIndexedDB()` with `seedAndVisit()` and `seedMinimal()`
   - Import from seedHelpers.ts

3. **Modify** `src/data/storage/initStorage.ts`
   - Add `window.__CYPRESS_SEED_MODE__` check
   - Skip Firestore migration when flag set

4. **Create** `cypress/fixtures/minimal-tree.ts`
   - Define minimal test data

5. **Delete** `cypress/support/seed-idb.ts` (redundant)
6. **Delete** `cypress/support/seed-idb-task.ts` (non-functional)

### Phase 2: Refactor Test Files

7. **Simplify** `smoke.cy.ts`
   - Remove lines 10-24 (basic rendering tests)
   - Update beforeEach: `cy.seedAndVisit()`
   - Keep only 2 persistence tests

8. **Enhance** `navigation.cy.ts`
   - Update beforeEach: `cy.seedAndVisit()`
   - Add rapid navigation data loss test

9. **Reduce** `datacard.cy.ts`
   - Remove lines 60-78 (field display tests)
   - Remove lines 19-40 (basic expansion, keep persistence variant)
   - Update beforeEach: `cy.seedAndVisit()`

10. **Reduce** `node-creation.cy.ts`
    - Remove lines 13-23 (rendering test)
    - Remove lines 115-126 (navigation test)
    - Update beforeEach: `cy.seedMinimal()`
    - Add persistence checks to remaining tests

11. **Rewrite** `layout.cy.ts`
    - Replace all 12 pixel tests with 3 critical checks
    - Use `cy.seedMinimal()`

12. **Reduce** `offline.cy.ts`
    - Remove lines 88-109, 140-155, 157-192, 197-217
    - Keep 4 tests
    - Update beforeEach: `cy.seedAndVisit()`

### Phase 3: Remove Timing Workarounds

13. **Fix** `node-creation.cy.ts:47`
    - Replace `cy.wait(300)` with value assertion

14. **Fix** `smoke.cy.ts:42`
    - Replace `cy.wait(300)` with value assertion

15. **Fix** `offline.cy.ts:44,134`
    - Replace waits with appropriate assertions

16. **Fix** `layout.cy.ts:108`
    - Replace `cy.wait(200)` with CSS transition check

---

## Critical Files

### Files to Modify
1. `cypress/support/commands.ts` - Core seeding refactor
2. `cypress/support/e2e.ts` - Update beforeEach
3. `src/data/storage/initStorage.ts` - Add test mode detection
4. `cypress/e2e/smoke.cy.ts` - Simplify to 2 tests
5. `cypress/e2e/navigation.cy.ts` - Add data loss test
6. `cypress/e2e/datacard.cy.ts` - Reduce to 3 tests
7. `cypress/e2e/node-creation.cy.ts` - Reduce to 3 tests, use minimal seed
8. `cypress/e2e/layout.cy.ts` - Complete rewrite
9. `cypress/e2e/offline.cy.ts` - Reduce to 4 tests

### Files to Create
1. `cypress/support/seedHelpers.ts` - Extracted seeding logic
2. `cypress/fixtures/minimal-tree.ts` - Minimal test data

### Files to Delete
1. `cypress/support/seed-idb.ts` - Redundant
2. `cypress/support/seed-idb-task.ts` - Non-functional

---

## Expected Outcomes

### Before Refactor
- 6 test files, ~35 test cases
- Golden Tree (7 nodes, 19 fields) every test
- 5x `cy.wait()` timing hacks
- Brittle pixel-perfect layout tests
- Complex `visit → seed → reload` pattern
- Test runtime: ~60-90 seconds

### After Refactor
- 6 test files, ~18 test cases (48% reduction)
- Hybrid seeding (Golden for nav, Minimal for creation)
- 0x timing hacks (assertions only)
- Robust layout checks (overflow, clipping, a11y)
- Clean `cy.seedAndVisit()` pattern
- Test runtime: ~30-45 seconds (50% faster)

### Test Distribution
- **smoke.cy.ts**: 2 tests (persistence regression)
- **navigation.cy.ts**: 9 tests (critical tree structure)
- **datacard.cy.ts**: 3 tests (edit flow)
- **node-creation.cy.ts**: 3 tests (creation + cancel)
- **layout.cy.ts**: 3 tests (overflow, long names, a11y)
- **offline.cy.ts**: 4 tests (basic offline smoke)

**Total: 24 tests** (was ~35, removed redundant tests)

---

## Verification Plan

1. **Run Cypress tests**:
   ```bash
   npm run dev          # Terminal 1
   npm run cypress:run  # Terminal 2
   ```

2. **Verify outcomes**:
   - All 24 tests pass
   - No `cy.wait()` calls remain
   - Test suite completes in <45 seconds
   - No console errors about IDB seeding

3. **Manual smoke test**:
   - Create node → reload → verify exists
   - Edit field → reload → verify persists
   - Navigate tree → verify hierarchy

4. **Verify Vitest still passes**:
   ```bash
   npm run test
   ```

---

## Rollback Plan

If issues arise:
1. Git stash changes
2. Original test suite in commit history
3. Can revert individual files if needed

---

## Success Criteria

✅ Test suite runs without Firestore emulator
✅ All tests use `cy.seedAndVisit()` or `cy.seedMinimal()`
✅ Zero `cy.wait()` timing workarounds
✅ Layout tests focus on critical regressions only
✅ Test count reduced by ~50%
✅ Test runtime reduced by ~50%
✅ Tests catch critical regressions (persistence, navigation, data loss)
✅ Vitest suite still passes (no regression in unit tests)
