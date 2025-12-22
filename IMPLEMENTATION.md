## Tech Stack & Implementation Decisions (Phase 1)

### Runtime, Tooling, Conventions

- **Node.js**: 20.x LTS
- **Package manager**: npm (keep simple)
- **TypeScript**: strict mode enabled; no `any` in exported APIs
- **Lint/Format**: ESLint + Prettier (defaults), run in CI later; local-only for Phase 1

### Framework & Routing

- **UI framework**: Qwik + Qwik City
- **Adapter**: Static site build (SSG) for Netlify; no server/runtime code in Phase 1
- **Routes**: Single route `/` that renders either ROOT or BRANCH view via in-app state. No URL changes for navigation (per SPEC).

### Data Layer

- **Persistence**: Firebase Firestore Web SDK with offline persistence (IndexedDB) enabled
- **Timestamps/IDs**: `Date.now()` for `updatedAt`; `crypto.randomUUID()` for IDs; `editedBy`="localUser"
- **Writes**: Use SDK; debounce mutations (~300ms) to reduce churn; keep integrity helpers (maintain `childNodes`/`dataFields` mirrors) before writes
- **UI state**: `localStorage` (`treeview:ui:cardsExpanded`, `treeview:ui:fieldDetailsExpanded`)

### Styling Strategy

- **Primary**: Plain CSS Modules colocated with components (e.g., `TreeNode.css?inline`)

### Mobile-first UI and UX

- **Disable pinch-zoom** to reduce double-tap conflicts

### State Management

- **Approach**: Qwik `useStore` + context providers; no external state library
- **Architecture**: FSM-patterned centralized state in `src/state/appState.ts`
- **Pattern**: States are explicit types, transitions are guarded functions, derived state via selectors

#### FSM State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  STATE DEFINITIONS                                           │
├─────────────────────────────────────────────────────────────┤
│  ViewState:        ROOT | BRANCH(nodeId)                    │
│  TreeNodeState:    ROOT | PARENT | CHILD | UNDER_CONSTRUCTION│
│  DataCardState:    COLLAPSED | EXPANDED | UNDER_CONSTRUCTION │
│  DataFieldState:   DISPLAY | EDITING                        │
│  DataFieldDetailsState: COLLAPSED | EXPANDED                │
├─────────────────────────────────────────────────────────────┤
│  TRANSITIONS (with guards)                                  │
├─────────────────────────────────────────────────────────────┤
│  navigateToNode(nodeId)     ROOT→BRANCH, BRANCH→BRANCH      │
│  navigateUp(parentId)       BRANCH→BRANCH, BRANCH→ROOT      │
│  navigateToRoot()           *→ROOT                          │
│  startConstruction(data)    Guard: !underConstruction       │
│  cancelConstruction()       Clear UC state                  │
│  completeConstruction()     Clear UC state                  │
│  toggleCardExpanded(id)     COLLAPSED↔EXPANDED + persist    │
│  toggleFieldDetailsExpanded(id)                             │
│  startFieldEdit(id)         DISPLAY→EDITING (single field)  │
│  stopFieldEdit()            EDITING→DISPLAY                 │
├─────────────────────────────────────────────────────────────┤
│  SELECTORS (derived state)                                  │
├─────────────────────────────────────────────────────────────┤
│  getTreeNodeState(appState, nodeId, parentId)               │
│  getDataCardState(appState, nodeId)                         │
│  getDataFieldState(appState, fieldId)                       │
│  getDataFieldDetailsState(appState, fieldId)                │
│  isRootView(appState)                                       │
│  getCurrentNodeId(appState)                                 │
└─────────────────────────────────────────────────────────────┘
```

#### Design Decisions

1. **Why FSM-patterned, not full FSM library?**
   - XState adds ~15KB and learning curve
   - Our state transitions are simple enough for guarded functions
   - Can migrate to XState later if complexity grows (approval workflows, parallel states)

2. **Why centralized state?**
   - SPEC requires persisted UI prefs (card expansion)
   - SPEC requires single-field editing guarantee
   - Navigation guards (can't navigate while constructing)
   - Prepares for Snackbar/Undo (global access needed)

3. **Why selectors for component states?**
   - TreeNode state is _derived_ from view + position, not stored
   - Keeps single source of truth (ViewState)
   - Components ask "what state am I in?" rather than being told

#### State Flow

```
User clicks node → navigateToNode$(nodeId)
                         │
                         ▼
              ┌─────────────────────┐
              │ Guard: !underConstruction │
              └─────────────────────┘
                         │ pass
                         ▼
              ┌─────────────────────┐
              │ Push current to history │
              │ Set view = BRANCH(nodeId) │
              │ Clear editingFieldId │
              └─────────────────────┘
                         │
                         ▼
              Component re-renders with new state
```

#### Persistence Integration

- `ui.expandedCards` and `ui.expandedFieldDetails` are loaded from `uiPrefs.ts` on init
- Every `toggleCardExpanded` / `toggleFieldDetailsExpanded` call persists to localStorage
- Survives page reloads

### Notifications & Undo

- **Snackbar**: Single-slot toast with optional "Undo"; auto-dismiss after 5s
- **Undo semantics**: In-memory snapshot for 5s to restore deletes; only latest operation is undoable; not persisted; cascade deletes write no history entries

### Testing & QA (Phase 1)

- Manual testing only; smoke flows: create node, navigate up/down, add/edit/delete field, persistence across reloads
- Add `npm run typecheck` and lint script

### Accessibility (A11y)

The app is designed with **full accessibility support**, both for human users with assistive technologies and for **AI agent interaction** (screen reader-like DOM access).

**Key accessibility features implemented:**

1. **Semantic HTML Elements**
   - `<article>` for tree nodes with `aria-labelledby` referencing the title
   - `<h2>` for node titles (proper heading hierarchy)
   - `<button>` for all interactive elements (not clickable `<div>`s)
   - `<label>` for data field labels with proper `id` association

2. **ARIA Attributes**
   - `aria-expanded` on expand/collapse buttons
   - `aria-label` for buttons with icon-only or unclear text content
   - `aria-labelledby` linking inputs to their labels
   - `role="region"` with `aria-label` for content sections
   - `role="button"` with `tabIndex` for custom interactive elements

3. **Keyboard Navigation**
   - All interactive elements are focusable via Tab
   - Enter/Space activates buttons and starts editing
   - Escape cancels editing mode
   - `:focus-visible` styles for clear keyboard focus indicators

4. **AI Agent Compatibility**
   - All interactive elements appear in the accessibility tree with descriptive names
   - Actions like "Open Node Name", "Expand details", "Add Sub-Asset" are clearly labeled
   - Form inputs have proper `aria-label` or `aria-labelledby`
   - Enables AI tools (like Cursor's browser integration) to navigate and interact with the app programmatically

**Components with accessibility support:**

- `CreateNodeButton` - semantic `<button>` with `aria-label`
- `TreeNode` - `<article>` with keyboard handlers, `aria-expanded` chevron button
- `DataCard` - `role="region"` with accessible "Add Field" button
- `DataField` - keyboard editing (Enter to edit), proper label association
- `UpButton` - semantic `<button>` with navigation context in `aria-label`
  /
  ├─ .firebaserc
  ├─ firebase.json
  ├─ firestore.rules
  ├─ firestore.indexes.json
  ├─ package.json
  ├─ tsconfig.json
  ├─ .gitignore
  ├─ LATER.md
  ├─ SPECIFICATION.md
  ├─ IMPLEMENTATION.md
  ├─ mockups/
  │ └─ ... (design references, images)
  ├─ public/
  │ └─ ... (static assets: favicon, icons, manifest; no app logic)
  └─ src/
  ├─ routes/ # Qwik City routing (SSG)
  │ └─ index.tsx # single route `/` (ROOT/BRANCH rendered via in-app state)
  ├─ components/ # UI components (Qwik), collocated CSS modules
  │ ├─ TreeNode/
  │ │ ├─ TreeNode.tsx
  │ │ └─ TreeNode.css?inline
  │ ├─ DataCard/
  │ ├─ DataField/
  │ ├─ NodeTitle/
  │ ├─ NodeSubtitle/
  │ ├─ CreateNodeButton/
  │ ├─ UpButton/
  │ ├─ NodeTools/
  │ └─ SnackBar/
  ├─ state/ # Qwik stores + context providers (app-level state)
  │ ├─ appStore.ts
  │ └─ uiPrefs.ts
  ├─ data/ # Data layer (Firestore SDK + models + repo)
  │ ├─ firebase.ts # Firestore init (cloud)
  │ ├─ models.ts # existing (TreeNode, DataField, DataFieldHistory types)
  │ └─ repo/ # existing (CRUD + integrity helpers)
  │ ├─ treeNodes.ts # existing
  │ └─ dataFields.ts # existing
  ├─ styles/ # Global styles and tokens
  │ ├─ tokens.css # SPEC variables (design tokens)
  │ └─ global.css # base/reset + app globals
  └─ utils/ # Narrow, reusable helpers (keep small/specific)
  ├─ time.ts # debounce, time formatting
  └─ id.ts # UUID helpers if needed (or use crypto.randomUUID())

---

## Refactoring Audit (Phase 1)

A comprehensive analysis of opportunities to improve code readability, modularity, and maintainability before building out more features. Prioritizes clean code principles: short functions, composition, abstractions, and swappable backing services.

### Summary of Current State

The codebase has a solid foundation with good separation between views (`RootView`, `BranchView`), a data layer with repo pattern (`treeNodes.ts`, `dataFields.ts`), type definitions (`models.ts`), and an emerging services layer (`createNode.ts`). However, several components are doing too much, there's duplicated logic between views, and the data layer is tightly coupled to components.

---

### 1. ✅ Extract Under-Construction Logic from TreeNode

**Problem:** `TreeNode.tsx` (164 lines) handles four distinct modes: display, under-construction input, data fetching, and expand/collapse. This violates single responsibility.

**Solution:** Split into composed components:

```
TreeNode/
├─ TreeNode.tsx              # Orchestrates modes, delegates to sub-components
├─ TreeNodeDisplay.tsx       # Read-only display mode (NodeTitle, NodeSubtitle, DataCard)
├─ TreeNodeConstruction.tsx  # Under-construction input fields + Save/Cancel
└─ useTreeNodeFields.ts      # Hook for loading persistedFields
```

**Benefits:**

- Each component < 50 lines
- TreeNode becomes a thin orchestrator that composes other components
- Construction logic can be tested/modified independently

**Implemented:** Split into 4 files (48 + 96 + 109 + 34 lines). TreeNode.tsx is now a thin orchestrator.

---

### 2. ✅ Extract Shared UnderConstruction State Pattern

**Problem:** `RootView` and `BranchView` both define identical:

- `UnderConstructionNode` type
- `ucNode` signal
- `startCreate$`, `cancelCreate$`, `completeCreate$` handlers

**Solution:** Create a shared hook:

```typescript
// src/hooks/useNodeCreation.ts
export function useNodeCreation(opts: {
  parentId: string | null;
  onCreated$: PropFunction<() => void>;
}) {
  const ucNode = useSignal<UnderConstructionNode | null>(null);
  const startCreate$ = $(() => { ... });
  const cancelCreate$ = $(() => { ... });
  const completeCreate$ = $(async (payload) => { ... });
  return { ucNode, startCreate$, cancelCreate$, completeCreate$ };
}
```

**Benefits:**

- DRY: Single source of truth for creation flow
- Views become simpler composition of shared behaviors
- Easier to add features (e.g., validation) in one place

**Implemented:** Created `src/hooks/useNodeCreation.ts` (73 lines). Both views now use this hook. Also merged `createNode` functions (item 6) as part of this.

---

### 3. ✅ Extract Double-Click Detection as Reusable Hook

**Problem:** `DataField.tsx` has ~40 lines of complex double-click detection logic with multiple signals (`lastDownAt`, `lastDownX`, `lastDownY`, `suppressCancelUntil`) and magic numbers.

**Solution:** Extract to a reusable hook:

```typescript
// src/hooks/useDoubleTap.ts
export function useDoubleTap(opts: {
  onDoubleTap$: PropFunction<() => void>;
  threshold?: number; // default 280ms
  slopPx?: number;    // default 6px
}) { ... }
```

**Benefits:**

- DataField.tsx shrinks by ~40 lines
- Reusable for any double-tap interaction
- Configuration (timing, slop) in one place

**Implemented:** Created `src/hooks/useDoubleTap.ts` (50 lines) with exported constants and configurable thresholds. DataField.tsx now uses the hook, reduced from 150 to 131 lines. Comprehensive unit tests in `src/test/doubleTap.test.ts`.

---

### 4. ✅ Introduce Data Access Service Layer

**Problem:** Components directly import repo functions and call them with business logic mixed in:

- `TreeNode.tsx` imports `listFieldsForNode`
- `DataField.tsx` imports `updateFieldValue`
- Views import `getNodeById`, `listChildren`, `listRootNodes`

**Solution:** Add a service layer abstracting data operations:

```
src/data/
├─ services/
│   ├─ nodeService.ts    # High-level node operations
│   ├─ fieldService.ts   # High-level field operations
│   └─ createNode.ts     # (existing, rename to nodeCreationService.ts)
├─ repo/                  # (existing - low-level Firestore ops)
└─ firebase.ts           # (existing)
```

Example service:

```typescript
// src/data/services/nodeService.ts
export const nodeService = {
  getRootNodes: () => listRootNodes(),
  getNodeWithChildren: async (id: string) => {
    const [node, children] = await Promise.all([
      getNodeById(id),
      listChildren(id),
    ]);
    return { node, children };
  },
  // ...
};
```

**Benefits:**

- Components depend on abstraction, not Firestore concretions
- Easier to swap backing service (e.g., localStorage for testing, different DB later)
- Business logic in services, not scattered in components

**Implemented:** Created `nodeService.ts` and `fieldService.ts` in `src/data/services/`. Updated `useTreeNodeFields.ts`, `DataField.tsx`, `RootView.tsx`, and `BranchView.tsx` to use services instead of direct repo imports. BranchView now uses `nodeService.getNodeWithChildren()` for parallel loading. Tests in `src/test/serviceLayer.test.ts`.

---

### 5. ✅ Consolidate Hardcoded Constants

**Problem:** Magic values scattered throughout:

- `"localUser"` appears in `treeNodes.ts`, `dataFields.ts`
- `"treeNodes"`, `"dataFields"`, `"dataFieldHistory"` collection names in repos
- `DOUBLE_CLICK_MS = 280`, `DOUBLE_CLICK_SLOP = 6` in DataField.tsx
- Inline style `style={{ display: 'flex', gap: '8px', marginTop: '6px' }}` in TreeNode.tsx

**Solution:** Create a constants file:

```typescript
// src/constants.ts
export const USER_ID = "localUser" as const;
export const COLLECTIONS = {
  NODES: "treeNodes",
  FIELDS: "dataFields",
  HISTORY: "dataFieldHistory",
} as const;

// src/constants/interaction.ts
export const DOUBLE_TAP = {
  THRESHOLD_MS: 280,
  SLOP_PX: 6,
} as const;
```

**Benefits:**

- Single source of truth for magic values
- Easier to find and update when requirements change
- Self-documenting code

**Implemented:** Created `src/constants.ts` with `USER_ID` and `COLLECTIONS`. Updated `treeNodes.ts`, `dataFields.ts`, and `testUtils.ts` to import from centralized constants. Double-tap constants were already extracted in `useDoubleTap.ts` (as `DOUBLE_TAP_THRESHOLD_MS` and `DOUBLE_TAP_SLOP_PX`).

---

### 6. ✅ Merge Duplicate createNode Functions

**Problem:** `createRootNodeWithDefaultFields` and `createChildNodeWithDefaultFields` are nearly identical (only differs by `parentId: null` vs `parentId: input.parentId`).

**Solution:** One function with optional parentId:

```typescript
export async function createNodeWithDefaultFields(input: {
  id: string;
  parentId?: string | null; // null/undefined = root node
  nodeName: string;
  nodeSubtitle: string;
  defaults: { fieldName: string; fieldValue: string | null }[];
}) {
  await createNode({ ... });
  await Promise.all(input.defaults.map((f) => addField({ ... })));
}
```

**Benefits:**

- DRY: One function instead of two
- Parallel field creation (minor perf improvement)
- Cleaner API

**Implemented:** Created unified function in `src/data/services/createNode.ts`. Legacy functions now delegate to it. Completed with item 2.

---

### 7. ✅ Add Timestamp Utility

**Problem:** `Date.now()` called directly in multiple places without abstraction.

**Solution:** Utility for consistent timestamp handling:

```typescript
// src/utils/time.ts
export const now = () => Date.now();
export const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();
// Future: can swap to server time, mock for tests, etc.
```

**Benefits:**

- Single place to modify timestamp logic
- Easier to mock in tests
- Ready for server-assigned timestamps later

**Implemented:** Created `src/utils/time.ts` with `now()` and `formatTimestamp()`. Updated `treeNodes.ts` and `dataFields.ts` to use `now()` for all record timestamps. UI timing (`useDoubleTap.ts`) and ID generation (`id.ts`) left unchanged as they serve different purposes.

---

### 8. ✅ Component-Colocated CSS Modules

**Problem:** All styles in one 327-line `global.css`. IMPLEMENTATION.md mentions CSS Modules but they're not being used. Hard to find styles for specific components.

**Solution:** Colocate styles with components:

```
TreeNode/
├─ TreeNode.tsx
└─ TreeNode.module.css
```

Keep `global.css` for:

- Reset/base styles
- CSS custom properties (design tokens)
- View-level layout (`.view-root`, `.view-branch`)

Move component-specific styles (`.node`, `.datacard`, `.datafield`, etc.) to colocated modules.

**Benefits:**

- Styles live with their components
- Easier to delete dead CSS
- Better encapsulation

**Implemented:** Created CSS module files colocated with components:

- `TreeNode.module.css` (96 lines) - node, title, subtitle, chevron, expand animation styles
- `DataCard.module.css` (25 lines) - card container and add button styles
- `DataField.module.css` (47 lines) - field grid layout, label/value styles
- `CreateNodeButton.module.css` (31 lines) - root and child variant button styles
- `UpButton.module.css` (16 lines) - navigation button styles

Updated all components to import and use CSS modules. Slimmed `global.css` from 334 to 92 lines (reset, focus, and view layout styles only).

---

### 9. ✅ Extract User Context Abstraction

**Problem:** `"localUser"` hardcoded everywhere. When multi-user support is added, every file needs changing.

**Solution:** Create user context:

```typescript
// src/context/userContext.ts
export const getCurrentUserId = () => "localUser";
// Future: pull from auth state
```

Use in repos/services:

```typescript
import { getCurrentUserId } from "../context/userContext";
const node: TreeNode = {
  ...partial,
  updatedBy: getCurrentUserId(),
  updatedAt: now,
};
```

**Benefits:**

- Single place to swap user identity
- Prepares for multi-user Phase 2
- Self-documenting intent

**Implemented:** Created `src/context/userContext.ts` (20 lines) with `getCurrentUserId()` function. Updated `treeNodes.ts` and `dataFields.ts` to import and use `getCurrentUserId()` instead of directly importing `USER_ID`. Updated `smoke.test.ts` to use the context for assertions.

---

### 10. ✅ Add Basic Error Handling Pattern

**Problem:** Most async operations have no try/catch. `RootView` has one `console.error` but no user feedback. Silent failures possible.

**Solution:** Add error boundary pattern at service layer:

```typescript
// src/data/services/withErrorHandling.ts
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    console.error(`[${context ?? "Error"}]`, err);
    // Future: show snackbar, report to monitoring
    return fallback;
  }
}
```

**Benefits:**

- Consistent error handling
- No silent failures
- Single place to add user notifications or monitoring

**Implemented:** Created `src/data/services/withErrorHandling.ts` (85 lines) with three utilities:

- `safeAsync(operation, fallback, context)` - Wraps async operations, returns fallback on error
- `safeAsyncVoid(operation, context)` - For fire-and-forget operations that may fail silently
- `withSafeAsync(fn, fallback, context)` - Creates wrapped version of any async function

All utilities log errors with contextual labels. Tests in `src/test/errorHandling.test.ts` (19 tests).

---

### 11. ✅ Implement Missing uiPrefs Store

**Problem:** `uiPrefs.ts` is empty. Per-node `isCardExpanded` and per-field `isMetadataExpanded` should persist to localStorage per SPEC.

**Solution:** Implement the store:

```typescript
// src/state/uiPrefs.ts
const STORAGE_KEY = 'treeview:ui:prefs';

export type UIPrefs = {
  expandedCards: Set<string>;      // node IDs
  expandedFieldDetails: Set<string>; // field IDs
};

export function loadUIPrefs(): UIPrefs { ... }
export function saveUIPrefs(prefs: UIPrefs): void { ... }
export function toggleCardExpanded(nodeId: string): void { ... }
```

**Benefits:**

- Card expansion persists across reloads
- Centralized UI preference management
- Ready for additional UI prefs

**Implemented:** Created `src/state/uiPrefs.ts` (91 lines) with `loadUIPrefs()`, `saveUIPrefs()`, `isCardExpanded()`, `isFieldDetailsExpanded()`, `toggleCardExpanded()`, `toggleFieldDetailsExpanded()`, and `clearUIPrefs()`. Stores Sets as JSON arrays in localStorage under key `treeview:ui:prefs`. Tests in `src/test/uiPrefs.test.ts` (26 tests).

---

### 12. ✅ Consider Async Parallelization

**Problem:** Sequential awaits where parallel would work:

```typescript
// Current (sequential)
const parent = await getNodeById(parentId);
const kids = await listChildren(parentId);

// Better (parallel) - already done in BranchView, but check others
const [parent, kids] = await Promise.all([...]);
```

**Review Points:**

- ✅ `BranchView.loadData$` - already parallel
- ⚠️ `createNode.ts` - fields created sequentially in for-loop
- ⚠️ `dataFields.ts` - history written after field update (unavoidable dependency)

**implemented** Already done during above refactor efforts.

---

### Priority Order for Refactoring

| Priority | Item                                 | Impact | Effort | Status |
| -------- | ------------------------------------ | ------ | ------ | ------ |
| 1        | Consolidate hardcoded constants      | High   | Low    | ✅     |
| 2        | Merge duplicate createNode functions | Medium | Low    | ✅     |
| 3        | Extract double-click hook            | Medium | Low    | ✅     |
| 4        | Extract UnderConstruction hook       | High   | Medium | ✅     |
| 5        | Split TreeNode component             | High   | Medium | ✅     |
| 6        | Introduce service layer              | High   | Medium | ✅     |
| 7        | Implement uiPrefs store              | Medium | Low    | ✅     |
| 8        | Add error handling pattern           | Medium | Low    | ✅     |
| 9        | CSS Modules migration                | Low    | Medium | ✅     |
| 10       | User context abstraction             | Low    | Low    | ✅     |

---

### Files to Create/Modify

**New Files:**

- ✅ `src/constants.ts` - Centralized constants (USER_ID, COLLECTIONS)
- `src/constants/interaction.ts` - UI interaction constants (not needed - already in useDoubleTap.ts)
- ✅ `src/hooks/useDoubleTap.ts` - Double-tap detection hook (includes DOUBLE_TAP_THRESHOLD_MS, DOUBLE_TAP_SLOP_PX)
- ✅ `src/hooks/useNodeCreation.ts` - Shared creation flow hook
- ✅ `src/context/userContext.ts` - User identity abstraction
- ✅ `src/data/services/nodeService.ts` - Node operations service
- ✅ `src/data/services/fieldService.ts` - Field operations service
- ✅ `src/utils/time.ts` - Timestamp utilities

**Files to Split:**

- ✅ `TreeNode.tsx` → `TreeNodeDisplay.tsx`, `TreeNodeConstruction.tsx`, `useTreeNodeFields.ts`

**Files to Modify:**

- ✅ `createNode.ts` - Merge functions, parallelize
- ✅ `treeNodes.ts`, `dataFields.ts` - Use constants, use `now()` from time.ts
- ✅ `RootView.tsx`, `BranchView.tsx` - Use hooks, use service layer
- ✅ `DataField.tsx` - Use double-tap hook, use service layer
- ✅ `uiPrefs.ts` - Implement

---

### Principles Applied

1. **Single Responsibility**: Each function/component does one thing
2. **DRY**: Extract shared patterns (hooks, services)
3. **Depend on Abstractions**: Service layer between components and Firestore
4. **Composition over Inheritance**: Hooks and composed components
5. **Short Functions**: Target < 20 lines per function, < 100 lines per component
6. **Constants over Magic Values**: Named, centralized, documented
7. **Fail Loud**: Explicit error handling, no silent failures

---

## Refactoring Phase 2: SOLID & DIP Compliance

Additional refactoring focused on Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP).

### Checklist

| Done | ID  | Goal                         | Implementation Notes                                                                                                                      |
| ---- | --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ✅   | 1a  | Extract useNodeCreation hook | Created `src/hooks/useNodeCreation.ts`. RootView and BranchView now use shared hook. Satisfies OCP/SRP.                                   |
| ✅   | 1b  | Split TreeNodeProps (ISP)    | Created `types.ts` with discriminated union (`TreeNodeDisplayProps` \| `TreeNodeConstructionProps`) and type guards.                      |
| ✅   | 2a  | Create DataContext / DIP     | **Changed approach**: Module-level service registry instead of context (see below). Created `src/data/services/index.ts` with interfaces. |
| ⬜   | 2b  | Extract FieldRow component   | Not started. Would reduce duplication between DataField and TreeNodeConstruction field rows.                                              |
| ⬜   | 3   | Consolidate callback props   | Not started. DataField, DataFieldDetails, DataFieldHistory share similar callback patterns.                                               |
| ⬜   | 4   | Make components "dumb"       | Longer-term. Move data fetching up, pass data via props. Improves testability.                                                            |

### Why Module-Level Registry Instead of Context?

Qwik's resumability model serializes closures (QRLs) to HTML so they can "resume" on the client without re-running all JS. When a `$()` closure captures a variable, Qwik tries to serialize it.

**Problem:**

```typescript
const { nodes } = useContext(DataContext); // service object with functions
const load$ = $(async () => {
  await nodes.getRootNodes(); // 💥 nodes captured, can't serialize functions
});
```

**Solution:**

```typescript
const load$ = $(async () => {
  await getNodeService().getRootNodes(); // ✅ nothing captured, looked up at runtime
});
```

The service registry lives at module scope (outside components), so it's available when the closure executes but not captured/serialized.

### Files Changed

- `src/data/services/index.ts` — New service registry with interfaces and getters
- `src/components/TreeNode/types.ts` — Discriminated union props for ISP
- All components/hooks using services — Changed from direct imports to `getNodeService()` / `getFieldService()`

---

## Phase 1 Implementation Checklist

### ✅ Core Framework & Build Setup

#### Runtime & Tooling

- **Node.js 20.x LTS**: Chosen for stability and long-term support
- **npm package manager**: Simple, reliable, no additional complexity
- **TypeScript strict mode**: All exported APIs use strict typing, no `any` types
- **ESLint + Prettier**: Default configurations, local-only (CI integration deferred)
- **Qwik + Qwik City**: Chosen for resumability, static site generation (SSG) for Netlify deployment
- **Static site adapter**: No server runtime code in Phase 1
- **Single route `/`**: No URL changes for navigation (per SPEC), in-app state drives view switching

#### Development Workflow

- **Local development**: `npm run dev` (SSR mode) + `npm run preview` for production-like behavior
- **Build process**: `npm run build` produces static assets for Netlify
- **Type checking**: `npm run typecheck` available for CI/pre-commit hooks
- **Testing**: Vitest with comprehensive test coverage for FSM state, services, and hooks

### ✅ State Management Architecture

#### FSM-Patterned Centralized State

- **Finite State Machine design**: Explicit states, guarded transitions, impossible invalid states
- **Centralized store**: `src/state/appState.ts` with Qwik `useStore` + context providers
- **No external state library**: Qwik's built-in state management sufficient for Phase 1 complexity
- **Guarded transitions**: Navigation blocked during construction, single-field editing guarantee

#### State Types & Transitions

- **ViewState**: `ROOT | BRANCH(nodeId)` - controls which view is rendered
- **TreeNodeState**: `ROOT | PARENT | CHILD | UNDER_CONSTRUCTION` - node positioning/rendering modes
- **DataCardState**: `COLLAPSED | EXPANDED | UNDER_CONSTRUCTION` - card expansion states
- **DataFieldState**: `DISPLAY | EDITING` - single-field editing guarantee
- **DataFieldDetailsState**: `COLLAPSED | EXPANDED` - field metadata expansion

#### Navigation Flow

- **Down-tree navigation**: `navigateToNode()` with history tracking
- **Up-tree navigation**: `navigateUp()` with parent resolution and history popping
- **Root navigation**: `navigateToRoot()` direct transition
- **Construction guards**: All navigation blocked during node/field creation

#### UI Preferences Persistence

- **localStorage keys**: `treeview:ui:prefs` for card/field expansion states
- **Automatic persistence**: Every toggle operation saves immediately
- **Load on init**: UI state restored from localStorage on app startup
- **Browser session survival**: Preferences persist across page reloads

### ✅ Data Layer & Persistence

#### Firebase Firestore Integration

- **Web SDK**: Direct integration with IndexedDB offline persistence enabled
- **Client-generated IDs**: `crypto.randomUUID()` for all entity IDs
- **Client-assigned timestamps**: `Date.now()` for `updatedAt` fields (server assignment deferred)
- **User identity**: Constant `"localUser"` (authentication deferred to Phase 2)
- **Debounced mutations**: ~300ms debounce to reduce write churn
- **Integrity helpers**: Maintain `childNodes`/`dataFields` mirrors before writes

#### Data Models & Relationships

- **TreeNode entity**: Hierarchical asset representation with `parentId: string | null`
- **DataField entity**: Configurable attributes with `parentNodeId` references
- **DataFieldHistory entity**: Append-only audit log for value changes (Phase 1 minimal)
- **Entity relationships**: TreeNode has N DataFields, DataField belongs to 1 TreeNode
- **Sorting**: Children by `updatedAt` ascending, DataFields by `updatedAt` ascending

#### Service Layer Architecture

- **Dependency Inversion**: Components depend on interfaces, not concrete Firestore implementations
- **Service interfaces**: `INodeService`, `IFieldService` for testability and backend swapping
- **Module-level registry**: `getNodeService()`, `getFieldService()` avoid Qwik serialization issues
- **Safe async operations**: `safeAsync()` wrapper with error logging and fallback handling
- **Parallel data loading**: `getNodeWithChildren()` fetches node + children simultaneously

#### Data Operations

- **CRUD operations**: Full create/read/update/delete for nodes and fields
- **Batch field creation**: New nodes created with default fields in parallel
- **Field value updates**: With history tracking and optimistic UI updates
- **Field deletion**: With history entries and parent refresh
- **Node cascading**: Delete operations remove node + all descendants + fields (Phase 1: leaf-only UI)

### ✅ Component Architecture

#### View Components

- **RootView**: Grid layout of top-level nodes + "Create New Asset" button
- **BranchView**: Parent node at top + indented children grid + multiple child creation buttons
- **Single route rendering**: `/` renders either view based on FSM state

#### TreeNode Component System

- **TreeNode orchestrator**: Delegates to display/construction subcomponents based on state
- **Discriminated unions**: ISP compliance with type-safe props (`TreeNodeDisplayProps | TreeNodeConstructionProps`)
- **State-driven rendering**: Component adapts to `ROOT | PARENT | CHILD | UNDER_CONSTRUCTION` states
- **Accessibility first**: Full keyboard navigation, ARIA attributes, semantic HTML

#### DataCard & DataField System

- **Expandable DataCard**: Grid-based layout with smooth CSS transitions (0fr → 1fr)
- **DataField editing**: Double-tap (280ms threshold, 6px slop) or Enter key activation
- **Single-field editing**: Only one field can be edited at a time (per SPEC)
- **Field details expansion**: Metadata, history, and delete actions in expandable section
- **Field creation**: Double-tap "+ Add Field" → combo box with prefab library selection

#### Creation & Construction Flows

- **Node creation**: Double-tap buttons → in-situ form with Name (required) + Subtitle + default fields
- **Field creation**: Prefab library selection from hardcoded list (15 field types)
- **Construction cancellation**: Click outside or Escape key cancels active construction
- **Save completion**: Enter key or double-tap input saves and completes construction

#### Button & Control Components

- **CreateNodeButton**: Contextual variants (`root` large button, `child` inline buttons)
- **UpButton**: Navigation with parent context in aria-label
- **Shared double-tap hook**: Reusable `useDoubleTap` with configurable thresholds
- **Shared node creation hook**: `useNodeCreation` extracts common construction flow

### ✅ Styling & UI/UX

#### CSS Modules Architecture

- **Component-colocated styles**: Each component has matching `.module.css` file
- **Plain CSS**: No CSS-in-JS, no Tailwind (kept simple per prototyping principles)
- **Design tokens**: Centralized `tokens.css` with CSS custom properties
- **Global styles**: Reset, base styles, and view-level layout in `global.css`

#### Mobile-First Design

- **Vertical scrolling**: Optimized for mobile, single-column layouts
- **Touch interactions**: Double-tap editing, pointer events with slop detection
- **Keyboard support**: Full navigation with Tab, Enter, Space, Escape
- **Focus management**: `:focus-visible` styles for keyboard users

#### Animation & Transitions

- **Card expansion**: CSS grid `grid-template-rows: 0fr → 1fr` with simultaneous transforms
- **Chevron rotation**: Smooth 180° rotation on expand/collapse
- **No layout thrashing**: Content-aware expansion without reflow issues

### ✅ User Experience Features

#### Navigation & Interaction

- **In-app navigation**: No URL changes, state-driven view switching
- **History tracking**: Browser back/forward support through navigation history
- **Construction blocking**: No navigation during node/field creation
- **Single-field editing**: Guaranteed mutual exclusion of editing states

#### DataField Library

- **Hardcoded prefabs**: 15 field types from SPEC (Description, Type Of, Tags, etc.)
- **Combo box interface**: Chevron opens dropdown, typeahead filtering (deferred)
- **Default fields**: "Type Of", "Description", "Tags" added to new nodes
- **Field naming**: User selects from library (no custom field creation in Phase 1)

#### Accessibility & Keyboard Support

- **Semantic HTML**: `<article>`, `<h2>`, `<button>`, proper heading hierarchy
- **ARIA attributes**: `aria-expanded`, `aria-label`, `aria-labelledby`, `role="region"`
- **Keyboard navigation**: Tab order, Enter/Space activation, Escape cancellation
- **Screen reader support**: All interactive elements in accessibility tree
- **AI agent compatibility**: Descriptive labels for programmatic interaction

### ✅ Testing & Quality Assurance

#### Test Coverage

- **FSM state testing**: Comprehensive transition and selector testing (`appState.test.ts`)
- **Service layer testing**: Mocked Firestore operations with interface compliance
- **Hook testing**: Double-tap detection, node creation flows
- **UI preference testing**: localStorage persistence and loading
- **Error handling testing**: Fallback behavior and logging verification

#### Manual Testing Flows

- **Smoke tests**: Node creation, navigation up/down, field editing, persistence across reloads
- **Edge case testing**: Construction cancellation, multiple field interactions
- **Accessibility testing**: Keyboard-only navigation, screen reader compatibility

#### Code Quality

- **TypeScript strict**: No `any` types, full type safety
- **ESLint compliance**: Code style consistency
- **Refactoring audit**: 12 major improvements completed (constants, hooks, services, etc.)
- **Single responsibility**: Components < 100 lines, functions < 20 lines

### ✅ Error Handling & Resilience

#### Service Layer Safety

- **safeAsync wrapper**: Catches errors, logs with context, returns fallbacks
- **Graceful degradation**: Empty arrays for missing data, logged errors for debugging
- **Context-aware logging**: Service and operation names in error messages
- **No silent failures**: All async operations have explicit error handling

#### User Experience Continuity

- **Optimistic updates**: UI updates immediately, syncs in background
- **Offline persistence**: Firestore IndexedDB handles network failures gracefully
- **State consistency**: FSM prevents invalid state combinations
- **Construction safety**: Cancel on outside click, blocked navigation during creation

### ✅ Refactoring Achievements

#### Code Organization

- **Constants centralization**: Magic values moved to `src/constants.ts`
- **Hook extraction**: `useDoubleTap`, `useNodeCreation` for reusable logic
- **Service layer**: DIP compliance with interface-based data access
- **Component splitting**: TreeNode divided into focused subcomponents
- **CSS Modules migration**: Component-colocated styles, removed global CSS bloat

#### Architecture Improvements

- **Interface Segregation**: Discriminated unions prevent invalid prop combinations
- **Dependency Inversion**: Components depend on abstractions, not implementations
- **Single Responsibility**: Each function/component has one clear purpose
- **Composition over inheritance**: Hooks and composed components
- **Error boundaries**: Service layer catches and handles data layer failures

### 🚧 Deferred to Later Phases

#### Advanced Features (Phase 2+)

- **Authentication**: Real user identity instead of `"localUser"`
- **Server timestamps**: Server-assigned `updatedAt` with conflict resolution
- **Multi-user features**: User attribution, collaboration, permissions
- **Rich field types**: Images, dates, enums beyond text fields
- **Advanced navigation**: Breadcrumbs, search, filtering
- **Export/import**: Collection backup and restore
- **Audit enhancements**: Full history with field renames, multi-user provenance

#### UI/UX Enhancements

- **Tree line decorations**: Visual guides between parent-child relationships
- **Drag & drop**: Reordering fields within DataCards
- **Typeahead filtering**: Real-time field name filtering in combo boxes
- **Context menus**: Right-click actions for advanced operations
- **Bulk operations**: Multi-select, batch actions
- **Advanced editing**: Rich text, validation, auto-complete

#### Performance & Scalability

- **Progressive loading**: Breadth-first data fetching with virtualization
- **Background sync**: Automatic cloud reconciliation with conflict resolution
- **Caching strategies**: Service worker caching for offline resilience
- **Database optimization**: Indexes, partitioning, query optimization
- **Bundle optimization**: Code splitting, lazy loading, tree shaking

#### Development Experience

- **Visual testing**: Screenshot comparisons, visual regression testing
- **E2E testing**: Playwright/Cypress for full user journey testing
- **Performance monitoring**: Bundle analysis, runtime performance tracking
- **Error monitoring**: Sentry/DataDog integration for production error tracking
- **CI/CD pipeline**: Automated testing, deployment, and release management

---

This comprehensive checklist captures all implemented features, architectural decisions, and deferred work for Phase 1. The implementation follows prototyping principles: simple, working solutions that can evolve into richer features in later phases.
