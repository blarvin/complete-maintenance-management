# Complete Maintenance Management - Developer Guide

## Development Philosophy

**Spec-Driven Development**: `SPECIFICATION.md` is the source of truth for product requirements, UX patterns, data models, and component architecture. Always consult the spec before implementing features.

**Documentation Hierarchy**:
1. **SPECIFICATION.md** - Product requirements, data models, UX patterns (the spec)
2. **LATER.md** - Deferred features, Phase 2+ roadmap, resolved items
3. **REFACTORING_AUDIT.md** - Known technical debt, code quality issues
4. **CLAUDE.md** (this file) - Architecture, patterns, workflow for AI assistance

---

## Project Overview

**Type**: Asset Tree Management System
**Purpose**: Hierarchical maintenance tracking for physical assets (vehicles, buildings, machinery)
**Status**: Phase 1 MVP - local-first persistence, text-only fields, rudimentary sync

### Tech Stack
- **Framework**: Qwik 1.16.0 (resumable, SSR-first)
- **Language**: TypeScript (strict mode)
- **Storage**: IndexedDB (Dexie 4.2.1) as primary, Firestore for sync
- **Testing**: Vitest (212+ unit tests), Cypress (E2E)
- **Styling**: CSS modules with 3-layer design token system

### Four-Level Knowledge Structure (per SPEC)
1. **Nodes** (TreeNode) - Things and their constituent parts (Title + Subtitle)
2. **Data Card** - Container with DataFields (facts about the thing)
3. **Field Details** - Metadata, history, management actions per field
4. **Field History** - Append-only audit log of value changes

---

## Architecture Patterns

### 1. Finite State Machine (FSM) Navigation
**Location**: `src/state/appState.*`

View state uses discriminated unions:
```typescript
type ViewState =
  | { state: 'ROOT' }
  | { state: 'BRANCH'; nodeId: string }
```

**Key files**:
- `appState.types.ts` - Type definitions (discriminated unions)
- `appState.transitions.ts` - State transition functions
- `appState.selectors.ts` - Derived state queries
- `appState.context.ts` - Qwik context + hooks

Components query state via selectors; never manage navigation state locally.

### 2. Adapter Pattern (Backend Abstraction)
**Location**: `src/data/storage/`

**Interface**: `StorageAdapter` - Backend-agnostic domain operations
**Implementations**:
- `IDBAdapter` (primary, offline-first via Dexie)
- `FirestoreAdapter` (cloud sync)

**Service Registry**: `src/data/services/index.ts`
- Module-level functions create services from adapters
- `nodeServiceFromAdapter(adapter)`, `fieldServiceFromAdapter(adapter)`
- Qwik-safe: avoids closure captures in `$()` functions

### 3. Offline-First Architecture
**Flow**:
1. All operations go to IndexedDB first (via IDBAdapter)
2. Operations enqueued to `syncQueue` table
3. SyncManager pushes to Firestore on timer/online event
4. Pull fetches Firestore changes, applies LWW conflict resolution
5. UI works identically online or offline

**Current**: Rudimentary sync; Phase 1 is local-only persistence.

### 4. Component Hierarchy with Type Safety
Components use discriminated unions + type guards (no prop spreading):
```typescript
type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

if (isConstructionProps(props)) {
  // TypeScript narrows: props.onCreate$, props.onCancel$ available
}
```

---

## Directory Structure (Key Locations)

```
src/
├── components/          # Qwik components (FSM-based, discriminated unions)
│   ├── TreeNode/        # Main orchestrator (ROOT/PARENT/CHILD/CONSTRUCTION states)
│   ├── DataCard/        # Expandable field container (dual-transition animation)
│   ├── DataField/       # Individual field row (double-tap to edit)
│   ├── FieldList/       # Orchestrates persisted + pending fields
│   └── views/           # RootView, BranchView (page-level routing)
├── state/               # FSM state management (types, transitions, selectors)
├── data/
│   ├── models.ts        # Domain types (TreeNode, DataField, DataFieldHistory)
│   ├── services/        # Service registry (INodeService, IFieldService)
│   ├── storage/         # Adapters (IDB, Firestore), interfaces
│   └── sync/            # SyncManager (bidirectional sync, LWW resolution)
├── hooks/               # Qwik composables (useFieldEdit, useDoubleTap, etc.)
├── styles/
│   ├── tokens.css       # 3-layer design tokens (primitives → semantic → component)
│   └── global.css       # Resets, focus-visible styles
├── constants.ts         # USER_ID, DATAFIELD_LIBRARY, COLLECTIONS
└── test/                # Vitest setup, fake-indexeddb, test utils
```

---

## Data Models (from SPEC)

### TreeNode
```typescript
{
  id: string;              // UUID v4 (client-generated)
  nodeName: string;        // Required, max 100 chars
  nodeSubtitle?: string;   // Optional, max 200 chars
  parentId: string | null; // null for root nodes
  updatedBy: string;       // Phase 1: "localUser" constant
  updatedAt: number;       // Epoch ms, for LWW conflict resolution
}
```

### DataField
```typescript
{
  id: string;              // UUID v4
  fieldName: string;       // Max 50 chars (from library or user-created)
  parentNodeId: string;    // Parent TreeNode reference
  fieldValue: string | null; // All types stored as strings
  cardOrder: number;       // Display ordering on DataCard
  updatedBy: string;
  updatedAt: number;
}
```

### DataFieldHistory (append-only audit log)
```typescript
{
  id: string;              // Composite: ${dataFieldId}:${rev}
  dataFieldId: string;
  parentNodeId: string;    // Denormalized for easy queries
  action: "create" | "update" | "delete";
  property: "fieldValue";  // Phase 1: only field values tracked
  prevValue: string | null;
  newValue: string | null;
  updatedBy: string;
  updatedAt: number;
  rev: number;             // Monotonic per field, starts at 0
}
```

**Sorting Policy** (per SPEC):
- Children within parent: sorted by `updatedAt` ascending
- DataFields within DataCard: sorted by `updatedAt` ascending

---

## Key Conventions

### Component States (FSM)
**TreeNode states**: `isRoot`, `isParent`, `isChild`, `isUnderConstruction`
**DataCard states**: `isExpanded`, `isUnderConstruction`
**DataField states**: `isMetadataExpanded`, `isEditing`

### User Interactions (per SPEC)
- **Double-tap to edit**: DataField values (also supports Enter/Space for keyboard)
- **Single tap**: Navigate down (child → parent), expand/collapse DataCard
- **"Up" button**: Navigate to parent or ROOT view
- **In-situ creation**: CreateNodeButton shows construction form inline

### Code Style
- **TypeScript**: Strict mode, discriminated unions, type guards
- **Qwik idioms**: Use `$()` for event handlers, avoid closures in hooks
- **CSS**: Module CSS with design tokens, minimal inline styles
- **Testing**: Test domain logic in service/adapter layers, not components

---

## Development Workflow

### Common Commands
```bash
npm run dev          # Dev server (SSR mode)
npm run test         # Run all unit tests
npm run test:watch   # Watch mode (Vitest)
npm run cypress      # Open Cypress GUI
npm run typecheck    # TypeScript validation
npm run lint         # ESLint
```

### Testing Strategy
- **Unit tests**: Service layer, adapters, sync logic, FSM transitions
- **E2E tests**: Cypress against Firestore emulator (run cleanup before tests)
- **Fake-IndexedDB**: In-memory IndexedDB for fast unit tests

### Firebase Emulator
Enable via localStorage flag or URL param:
```javascript
localStorage.setItem('USE_EMULATOR', 'true');
```
Emulator config: `localhost:8080` (Firestore)

---

## Critical Known Issues (from REFACTORING_AUDIT.md)

### High Priority
1. **Dead Code**: `src/data/repo/` folder (no imports, safe to delete)
2. **Sorting Bug**: IDBAdapter sorts descending, FirestoreAdapter ascending → different behavior offline/online

### Medium Priority
3. **Magic Numbers**: Extract constants (FOCUS_DELAY_MS, BLUR_SUPPRESS_WINDOW_MS)
4. **Unused Prop**: DataCard.nodeId never used

### Low Priority
5. **SRP Violation**: SyncManager too many responsibilities
6. **DRY**: History creation logic duplicated across adapters

---

## Phase 1 Simplifications (Current)

Per LATER.md, these features are deferred:
- Image/media fields (text-only for now)
- Custom DataField types (hardcoded library only)
- Field reordering UI
- Ancestor breadcrumbs
- Background progressive loading
- Tree-line/branch-line CSS decorations

---

## Quick Reference

### Adding a New DataField Type
1. Add to `DATAFIELD_LIBRARY` in `src/constants.ts`
2. No component changes needed (Phase 1 text-only)

### Creating a New View
1. Define state type in `appState.types.ts`
2. Add transition in `appState.transitions.ts`
3. Create selector in `appState.selectors.ts`
4. Create view component in `src/components/views/`

### Modifying Data Models
1. Update types in `src/data/models.ts`
2. Update Dexie schema in `src/data/storage/db.ts`
3. Update adapters (IDB, Firestore)
4. Add migration if needed

### Working with Storage
```typescript
// Get services (module-level registry)
const nodeService = getNodeService();
const fieldService = getFieldService();

// Swap adapter for testing
useStorageAdapter(new IDBAdapter());
```

---

## Important Files

### Must-Read Before Changes
- `SPECIFICATION.md` - Product requirements (always check first)
- `src/state/appState.types.ts` - FSM state definitions
- `src/data/models.ts` - Domain types

### Frequently Modified
- `src/components/TreeNode/TreeNode.tsx` - Main component orchestrator
- `src/components/DataField/DataField.tsx` - Field editing logic
- `src/data/services/index.ts` - Service registry
- `src/constants.ts` - Hardcoded values (USER_ID, library)

### Testing Infrastructure
- `src/test/globalSetup.ts` - Vitest + Firebase emulator setup
- `cypress/support/commands.ts` - E2E helpers
- `src/test/testUtils.ts` - Shared test utilities

---

## Strengths (What Works Well)

✅ **Clear Type System**: Discriminated unions prevent invalid states
✅ **FSM Navigation**: Explicit, testable application flow
✅ **Adapter Pattern**: Easy to swap storage backends
✅ **Offline-First**: IndexedDB primary, Firestore sync secondary
✅ **Test Coverage**: 212+ tests with good tooling
✅ **Documentation**: Spec-driven approach with comprehensive docs
✅ **Qwik Resumability**: No client-side JS bloat, tree-shakes well

---

## When Adding Features

1. **Check SPECIFICATION.md** for requirements and data model
2. **Check LATER.md** to see if it's deferred or already planned
3. **Follow FSM pattern** for state transitions
4. **Use discriminated unions** for component props
5. **Write tests** at the service/adapter layer first
6. **Update REFACTORING_AUDIT.md** if creating technical debt

---

## Firebase Configuration

**Project**: `treeview-blarapp`
**Collections**: `treeNodes`, `dataFields`, `dataFieldHistory`
**Indexes**: parentId, updatedAt (see SPECIFICATION.md data model section)

---

## Contact & Feedback

- Issues: https://github.com/blarvin/complete-maintenance-management/issues
- Repository: https://github.com/blarvin/complete-maintenance-management
