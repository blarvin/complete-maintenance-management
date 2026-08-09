# Complete Maintenance Management - Developer Guide

## Development Philosophy

**Spec-Driven Development**: `SPECIFICATION.md` is the source of truth for product requirements, UX patterns, data models, and component architecture. Always consult the spec before implementing features.
**This is prototyping**: Do the simplest thing that works.
**Context7 MCP**: When working with third-party libraries (solid-js, Dexie, etc.), use the context7 MCP tools to fetch up-to-date documentation rather than relying on potentially outdated knowledge.
**jCodeMunch MCP**: Use jcodemunch-mcp for all code lookups. Never read full files when MCP is available. Call `list_repos` first — if the project is not indexed, call `index_folder` with the current working directory. Use `search_symbols` / `get_symbol` to find and retrieve code by symbol name. Use `get_repo_outline` or `get_file_outline` to explore structure. Fall back to direct file reads only when editing or when MCP is unavailable.
**Plan location**: Always save plan files (`.plan.md`, phase plans, etc.) to `.claude/plans/` in this project's local directory — never to a global or home-directory location.

**Documentation Hierarchy**:

1. **SPECIFICATION.md** - Product requirements, the data model, the registry/manifest framework, and UX patterns (the spec). The architecture is the registry/manifest model: one `Element`, one immutable `kind`, behaviour in a per-kind manifest — see *Data Model*.
2. **ELEMENT-MODEL.md** - The kind catalogue: one self-contained spec per kind (composition, value shape, config sub-fields, placement, UX, status). SPEC owns the framework; this owns the kinds.
3. **LATER.md** - **Whole** ideas/features we've discussed but *not begun*, and work decided for later real phases (Phase 2+); plus resolved items. Not for leftovers of work already in progress — those go in ISSUES.
4. **IMPLEMENTATION.md** - Explanations for specific non-obvious choices made.
5. **ISSUES.md** - The active work queue: everything that needs doing now — bugs, unfinished business, deferred *parts* of work already begun, and observed refactor/cleanup needs (WIP left for later). The default home for leftovers of in-flight work, especially on the current branch and the Element-model unification.

**ISSUES vs LATER routing**: unfinished business, deferred parts of a feature already begun, and observed refactor needs (work-in-progress left for later) normally go in **ISSUES**, not LATER. **LATER** is for whole ideas/features not yet started and far-future-phase work. Consequence: a leftover directly caused by current-branch or Element-model work belongs in ISSUES — and much of what's currently parked in LATER under in-flight clusters (e.g. the §6b/§6c lens follow-ups) could migrate back.

---

## Project Overview

**Type**: Asset Management System based on a hierarchical tree view UI
**Purpose**: Maintenance tracking for physical assets (vehicles, buildings, machinery, etc.)
**Status**: Phase 1 MVP - local-first persistence, text-only fields

### Tech Stack

- **Framework**: solid-js 1.9 (fine-grained reactivity, client-only SPA — no SSR, no router; the FSM is the navigation model)
- **Language**: TypeScript (strict mode)
- **Storage**: IndexedDB (Dexie 4.2.1) as primary, Firestore for sync
- **Testing**: Vitest, Cypress (E2E)
- **Styling**: CSS modules with 3-layer design token system

### Four-Level Knowledge Structure (per SPEC)

1. **Nodes** (rendered TreeNode, stored as `Element` with `kind: "node"`) — Things and their constituent parts (Title + Subtitle)
2. **Data Card** — Container that lists an element's non-`"node"` children (DataFields)
3. **Field Details** — Metadata, history, management actions per field
4. **Element History** — Append-only audit log keyed `${elementId}:${rev}`, logs value / name / subtitle / parentId / siblingOrder changes

---

## Architecture Patterns

### 2. Adapter Pattern (Backend Abstraction)

**Location**: `src/data/storage/`
**Write model**: `IDBAdapter` is the sole `StorageAdapter`/`SyncableStorageAdapter` — element-shaped operations (`listRootElements`, `createElement`, `updateElement`, `getElementHistory`, …) plus Definition CRUD (`listDefinitions`/`getDefinition`/`createDefinition`), offline-first via Dexie
**Sync mirror**: `FirestoreAdapter` implements `RemoteSyncAdapter` only (`applySyncItem` + pull methods) — Firestore is a dumb mirror, not a second CRUD backend; the swappable-backend story is served by `RemoteSyncAdapter`
**Command/query registry**: `src/data/commands/` and `src/data/queries/`

- Module-level getters: `getCommandBus()`, `getElementQueries()`, `getDefinitionQueries()`
- Call these at runtime inside handlers, not at component setup — an adapter swap must be visible to the next call
- `setElementQueries(mock)` / `setCommandBus(mock)` for test swapping — these seams are why the registry stays module-level rather than moving into Solid context

### 4. Component Hierarchy with Type Safety

Components use discriminated unions + type guards (no prop spreading).

---

## Key Conventions

### Component States (FSM)

**TreeNode states**: `isRoot`, `isParent`, `isChild`, `isUnderConstruction`
**DataCard states**: `isExpanded`, `isUnderConstruction`
**DataField states**: `isMetadataExpanded`, `isEditing`

### Application User Interaction Design Principles

- **Double-tap to edit**: DataField values (also supports Enter/Space for keyboard)
- **Single tap**: Navigate down (child → parent), expand/collapse DataCard
- **"Up" button**: Navigate to parent or ROOT view
- **In-situ creation**: CreateNodeButton shows construction form inline

### 3. Offline-First Architecture

1. All operations go to IndexedDB first (via IDBAdapter)
2. Operations enqueued to `syncQueue` table (via standalone `SyncQueueManager`)
3. SyncManager pushes to Firestore on timer/online event
4. Pull fetches Firestore changes, applies server-authority conflict resolution
5. UI works identically online or offline

### Code Style

- **TypeScript**: Strict mode, discriminated unions, type guards
- **Solid idioms**: never destructure props (it breaks tracking); hooks take `Accessor<T>` in and return accessors out; `<Show keyed>` when a subtree must genuinely remount; `<Dynamic>` for registry-picked components. `eslint-plugin-solid` runs at **error** over all of `src/` — including `solid/reactivity`
- **CSS**: Module CSS with design tokens, minimal inline styles
- **Testing**: Test domain logic in service/adapter layers, not components

### Sorting Policy (per SPEC)

- All children (child nodes and DataCard fields alike): sorted by `siblingOrder` ascending. `siblingOrder` is assigned incrementally at mint; inserting between siblings renumbers the affected run (not fractional midpoints).

---

## Development Workflow

### Common Commands

```bash
npm run dev          # Vite dev server (client-only SPA; registers no service worker)
npm run build        # Typecheck + production build to dist/ (compiles the SW, injects the precache manifest)
npm run preview:pwa  # Serve the built dist/ on port 4173 — the only way to exercise the PWA
npm run test         # Run all unit tests
npm run test:watch   # Watch mode (Vitest)
npm run cypress      # Open Cypress GUI
npm run typecheck    # TypeScript validation
npm run lint         # ESLint
npm run emulator     # Run Firebase emulator
```

### Testing Strategy

- **Unit tests**: Service layer, adapters, sync logic, FSM transitions
- **E2E tests**: Cypress against Firestore emulator. Needs the emulator (`npm run emulator`, :8080) *and* the dev server (`npm run dev`, :5173) up — every spec starts with `cy.freshVisit()`, which wipes the emulator and deletes the app's IndexedDB before boot. No separate cleanup step.
- **Fake-IndexedDB**: In-memory IndexedDB for fast unit tests
- Firebase emulator: `localhost:8080`, enable via `localStorage.setItem('USE_FIRESTORE_EMULATOR', 'true')` or `?emulator=true` URL param

### Testing Infrastructure

- `src/test/globalSetup.ts` - Vitest + Firebase emulator setup
- `cypress/support/e2e.ts` - E2E helpers (`freshVisit`, `createNode`, `expandCard`, `clearEmulator`)
- `src/test/testUtils.ts` - Shared test utilities

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
const bus = getCommandBus();
const q = getElementQueries();

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
- `src/data/commands/handlers.ts` - Element command handlers
- `src/data/queries/index.ts` - `getElementQueries()` / `getDefinitionQueries()`
- `src/data/models.ts` - `Element`, `ElementHistory`, `Definition` (assembled view), the config/value unions
- `src/constants.ts` - Hardcoded values (USER_ID, library)

 ### TOOL USE GUIDELINES
 IMPORTANT: Chain dependent commands with &&, never wrap them in PowerShell if ($?) { }
