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
- **Testing**: Vitest, Cypress (E2E)
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

View state uses discriminated unions. Components query state via selectors; never manage navigation state locally.

### 2. Adapter Pattern (Backend Abstraction)
**Location**: `src/data/storage/`

**Interface**: `StorageAdapter` - Backend-agnostic domain operations
**Implementations**: `IDBAdapter` (primary, offline-first via Dexie), `FirestoreAdapter` (cloud sync)

**Service Registry**: `src/data/services/index.ts`
- Module-level getters: `getNodeService()`, `getFieldService()`
- IMPORTANT: Call these at runtime inside `$()` handlers — never capture in closures or serialize
- `setNodeService(mock)` / `setFieldService(mock)` for test swapping
- Qwik `useContextProvider` CANNOT hold services (methods aren't serializable, `Code(3)` error)
- `noSerialize` workaround not viable — values become `undefined` after SSR

### 3. Offline-First Architecture
1. All operations go to IndexedDB first (via IDBAdapter)
2. Operations enqueued to `syncQueue` table (via standalone `SyncQueueManager`)
3. SyncManager pushes to Firestore on timer/online event
4. Pull fetches Firestore changes, applies server-authority conflict resolution
5. UI works identically online or offline

### 4. Component Hierarchy with Type Safety
Components use discriminated unions + type guards (no prop spreading).

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

### Sorting Policy (per SPEC)
- Children within parent: sorted by `updatedAt` ascending
- DataFields within DataCard: sorted by `updatedAt` ascending

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
- Firebase emulator: `localhost:8080`, enable via `localStorage.setItem('USE_EMULATOR', 'true')`

---

## Critical Known Issues (from REFACTORING_AUDIT.md)

### High Priority
1. **Dead Code**: `src/data/repo/` folder (no imports, safe to delete)
2. **Sorting Bug**: IDBAdapter sorts descending, FirestoreAdapter ascending → different behavior offline/online

### Medium Priority
3. **Magic Numbers**: Extract constants (FOCUS_DELAY_MS, BLUR_SUPPRESS_WINDOW_MS)
4. **Unused Prop**: DataCard.nodeId never used

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
