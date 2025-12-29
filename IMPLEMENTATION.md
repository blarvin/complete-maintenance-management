## Phase 1 Implementation Notes

Specific implementation decisions and patterns. For feature scope, see SPECIFICATION.md. For deferred work, see LATER.md.

### State Management

**FSM via Discriminated Unions**: ViewState uses `{ state: 'ROOT' } | { state: 'BRANCH'; nodeId: string }` rather than separate `view` and `currentNodeId` fields. Selectors derive component states (`getTreeNodeState`, `getDataCardState`) from this single source of truth—components ask "what state am I in?" rather than storing their own state.

**Single-Field Editing Guarantee**: `editingFieldId: string | null` in AppState ensures only one DataField edits at a time. `startFieldEdit$(fieldId)` simply overwrites any existing value (per SPEC: "If another DataField is already editing, it is cancelled").

**UI Prefs Serialization**: Sets (`expandedCards`, `expandedFieldDetails`) stored as JSON arrays in localStorage. Converted on load/save in `uiPrefs.ts`. Toggling always persists immediately—no debounce needed since localStorage writes are synchronous.

### Service Layer

**Module-Level Registry Instead of Context**: Qwik's resumability serializes closures captured in `$()` functions. Context-provided services can't serialize because they contain functions:

```typescript
// ❌ Won't work: nodes captured in closure, can't serialize functions
const { nodes } = useContext(DataContext);
const load$ = $(async () => {
  await nodes.getRootNodes();
});

// ✅ Works: nothing captured, service looked up at runtime
const load$ = $(async () => {
  await getNodeService().getRootNodes();
});
```

Services live at module scope (`src/data/services/index.ts`), swapped via `setNodeService()` for tests. This maintains DIP (components depend on `INodeService` interface) without serialization issues.

**Error Handling Pattern**: `safeAsync(operation, fallback, context)` wraps async calls with try/catch, logs with context string, returns fallback on error. Not currently applied everywhere—Firestore's offline persistence handles most failures. Becomes important when adding Snackbar error notifications.

### Component Props

**Discriminated Union Props (ISP)**: TreeNode accepts `TreeNodeDisplayProps | TreeNodeConstructionProps`, discriminated on `nodeState`. Type guards (`isConstructionProps`, `isDisplayProps`) narrow the union. This prevents passing construction callbacks to display nodes or vice versa—TypeScript catches misuse at compile time.

```typescript
export type TreeNodeProps = TreeNodeDisplayProps | TreeNodeConstructionProps;

// Type guard narrows in component
if (isConstructionProps(props)) {
  // TypeScript knows: props.onCancel$, props.onCreate$ exist
}
```

**Component Split Strategy**: TreeNode orchestrates, delegates to:

- `TreeNodeDisplay.tsx` — renders persisted nodes (ROOT/PARENT/CHILD), manages pending field forms with LS
- `TreeNodeConstruction.tsx` — renders in-situ creation form, uses CreateDataField for all fields
- `CreateDataField.tsx` — pure form component for field name/value entry
- `useTreeNodeFields.ts` — hook for loading DataFields

Orchestrator just picks sub-component based on state.

### Field Creation (CreateDataField)

**Pure Form Component**: CreateDataField is purely UI—handles inputs, dropdown picker, Save/Cancel buttons. Does not persist. Parent decides what to do with `onSave$(id, fieldName, fieldValue)`.

**Parent Manages Pending Forms**:
- `TreeNodeDisplay`: Manages `pendingForms` signal with localStorage persistence. On Save → persists to DB, removes form, refreshes field list.
- `TreeNodeConstruction`: Manages `fieldForms` signal (memory only). Initializes with 3 default forms. On CREATE → filters empties, passes all to service.

**UX Parity**: UC mode uses same CreateDataField component for defaults and user-added fields. "Type Of", "Description", "Tags" are just pre-populated forms—user can edit, cancel, or add more. Empty forms are discarded on CREATE.

**30-Form Limit**: DataCard enforces via `pendingCount` prop. Button disables at limit.

### DataCard Animation

**Dual-Transition Technique**: Card expansion uses two synchronized CSS transitions:

1. Wrapper: `grid-template-rows: 0fr → 1fr` (height animation)
2. Inner `.datacard`: `translateY(-100%) → none` (content slides in)

Both use identical `100ms cubic-bezier(0.4, 0, 0.2, 1)` timing. The grid technique avoids setting explicit heights while remaining content-aware. Transform uses `none` (not `translateY(0)`) to avoid creating a containing block for fixed-position descendants (dropdowns).

```css
.wrapper {
  grid-template-rows: 0fr;
  transition: grid-template-rows 100ms...;
}
.wrapperOpen {
  grid-template-rows: 1fr;
}
.datacard {
  transform: translateY(-100%);
  transition: transform 100ms...;
}
.datacardOpen {
  transform: none;
}
```

### Double-Tap Detection

**Pure Detection Function**: `detectDoubleTap(state, x, y, now, threshold, slop)` is a pure function returning `[isDouble, newState]`. The hook (`useDoubleTap`) wraps it with Qwik signals for state persistence across renders. Threshold (280ms) and slop (6px) are tunable via options.

**Slop Distance**: Allows slight finger movement between taps. Uses Manhattan distance (`dx <= slop && dy <= slop`) rather than Euclidean—simpler and good enough for touch tolerance.

**Suppression Window**: After double-tap-to-save while editing, `suppressCancelUntil` prevents immediate `onBlur` from canceling the save. Set to `Date.now() + 220` on input pointerdown.

### Data Model

**Root Nodes via `parentId: null`**: No sentinel value like `"ROOT"`. Repo functions use `where('parentId', '==', null)` directly. TypeScript type is `parentId: string | null`.

**History ID Scheme**: `${dataFieldId}:${rev}` composite key. `rev` is monotonic per field (0 on create, increments on update). Enables ordered history without timestamp collisions.

**Timestamps**: `Date.now()` wrapped in `now()` from `src/utils/time.ts` for future mockability. Currently client-assigned; LATER.md tracks server-assigned timestamp migration.

### Hook Patterns

**useNodeCreation**: Extracts duplicate creation flow from RootView/BranchView. Returns `{ ucNode, start$, cancel$, complete$ }`. Internally calls `startConstruction$` (FSM transition), then on complete calls `getNodeService().createWithFields()` (data layer).

**useDoubleTap**: Returns `{ checkDoubleTap$ }` which takes `(x, y)` and returns boolean. Caller handles what to do on double-tap. Internal state (`lastDownAt`, `lastDownX`, `lastDownY`) persists across taps via Qwik signals.

### Accessibility

**Keyboard Editing Path**: DataField value has `tabIndex={0}` and `role="button"` with `onKeyDown$` handling Enter/Space to begin edit. Input handles Enter (save) and Escape (cancel). Focus management via `autoFocus` on input when entering edit mode.

**ARIA on Expansion**: Chevron buttons use `aria-expanded={isExpanded}` and descriptive `aria-label` ("Expand field details" / "Collapse field details"). Changes based on state, not just static labels.

### File Organization

```
src/
├── components/
│   ├── CreateDataField/
│   │   └── CreateDataField.tsx   # Pure form: name/value inputs + Save/Cancel
│   └── TreeNode/
│       ├── TreeNode.tsx          # Orchestrator (picks display vs construction)
│       ├── TreeNodeDisplay.tsx   # Persisted node + pending forms (LS)
│       ├── TreeNodeConstruction.tsx  # UC form, uses CreateDataField for all fields
│       ├── TreeNode.module.css   # Styles
│       ├── types.ts              # Discriminated union props + type guards
│       └── useTreeNodeFields.ts  # Field loading hook
├── state/
│   ├── appState.ts   # FSM state, transitions, selectors, context
│   └── uiPrefs.ts    # localStorage persistence (Sets ↔ JSON arrays)
├── data/
│   ├── services/
│   │   ├── index.ts          # Service interfaces + registry
│   │   ├── nodeService.ts    # Firestore node ops
│   │   ├── fieldService.ts   # Firestore field ops
│   │   └── withErrorHandling.ts  # safeAsync wrapper
│   └── repo/                 # Low-level Firestore CRUD
├── hooks/
│   ├── useDoubleTap.ts       # Gesture detection (pure + hook)
│   └── useNodeCreation.ts    # Creation flow orchestration
└── constants.ts              # USER_ID, COLLECTIONS, DEFAULT_DATAFIELD_NAMES
```

### Testing Notes

**Service Mocking**: Tests use `setNodeService(mockService)` before running, `resetServices()` in cleanup. Mock implements `INodeService` interface—no Firestore dependency in unit tests.

**Pure Function Testing**: `detectDoubleTap` is exported separately from hook for direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.
