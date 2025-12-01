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
- **Top-level app state**:
  - `currentParentNodeId` (for BRANCH view), `null` shows ROOT view
  - `treeNodes`, `dataFields`, `dataFieldHistory` (in-memory tables)
  - Ephemeral UI: `editingFieldId`
  - Persisted UI: per-node `isCardExpanded`, per-field `isMetadataExpanded`
- **Finite State Machines**: Keep simple with typed flags/enums and pure helper reducers. No FSM library.

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

### 8. Component-Colocated CSS Modules

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

---

### 9. Extract User Context Abstraction

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

---

### 10. Add Basic Error Handling Pattern

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

---

### 11. Implement Missing uiPrefs Store

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

---

### 12. Consider Async Parallelization

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
| 7        | Implement uiPrefs store              | Medium | Low    |        |
| 8        | Add error handling pattern           | Medium | Low    |        |
| 9        | CSS Modules migration                | Low    | Medium |        |
| 10       | User context abstraction             | Low    | Low    |        |

---

### Files to Create/Modify

**New Files:**

- ✅ `src/constants.ts` - Centralized constants (USER_ID, COLLECTIONS)
- `src/constants/interaction.ts` - UI interaction constants (not needed - already in useDoubleTap.ts)
- ✅ `src/hooks/useDoubleTap.ts` - Double-tap detection hook (includes DOUBLE_TAP_THRESHOLD_MS, DOUBLE_TAP_SLOP_PX)
- ✅ `src/hooks/useNodeCreation.ts` - Shared creation flow hook
- `src/context/userContext.ts` - User identity abstraction
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
- `uiPrefs.ts` - Implement

---

### Principles Applied

1. **Single Responsibility**: Each function/component does one thing
2. **DRY**: Extract shared patterns (hooks, services)
3. **Depend on Abstractions**: Service layer between components and Firestore
4. **Composition over Inheritance**: Hooks and composed components
5. **Short Functions**: Target < 20 lines per function, < 100 lines per component
6. **Constants over Magic Values**: Named, centralized, documented
7. **Fail Loud**: Explicit error handling, no silent failures
