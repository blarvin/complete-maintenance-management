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

**Storage Adapter Abstraction**: All Firestore operations are encapsulated in `FirestoreAdapter`, a concrete implementation of the backend-agnostic `StorageAdapter` interface. The interface provides domain-shaped methods (nodes, fields, history) plus lightweight `StorageResult` metadata (adapter id, optional cache flag, latency). Services are created from adapters via `nodeServiceFromAdapter()` and `fieldServiceFromAdapter()` factories. The default services use `FirestoreAdapter`; `useStorageAdapter(adapter)` swaps both node and field services to delegate through any adapter while keeping the component-facing service contracts unchanged. This enables dropping in alternative backends (IndexedDB/memory) without touching components.

**Storage Error Contract**: Added `StorageError` shape with normalized codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`), retryable flag, and helpers (`makeStorageError`, `toStorageError`, `describeForUser`). Intent is to map adapter-level failures to Snackbar-friendly messages later; no UI wiring yet.

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

- `TreeNodeDisplay.tsx` — renders persisted nodes (ROOT/PARENT/CHILD), delegates all field logic to FieldList
- `TreeNodeConstruction.tsx` — renders in-situ creation form, uses CreateDataField for all fields
- `FieldList.tsx` — orchestrates persisted fields + pending forms, owns add/save/cancel logic
- `CreateDataField.tsx` — pure form component for field name/value entry
- `useTreeNodeFields.ts` — hook for loading DataFields from DB

Orchestrator just picks sub-component based on state.

### Field Creation (CreateDataField)

**Pure Form Component**: CreateDataField is purely UI—handles inputs, dropdown picker, Save/Cancel buttons. Does not persist. Parent decides what to do with `onSave$(id, fieldName, fieldValue)`.

**Parent Manages Pending Forms**:

- `FieldList` (via `usePendingForms` hook): Manages pending forms with localStorage persistence. On Save → persists to DB, removes form, refreshes field list.
- `TreeNodeConstruction`: Manages `fieldForms` signal (memory only). Initializes with 3 default forms. On CREATE → filters empties, passes all to service.

**UX Parity**: UNDER_CONSTRUCTION mode uses same CreateDataField component for defaults and user-added fields. "Type Of", "Description", "Tags" are just pre-populated forms—user can edit, cancel, or add more. Empty forms are discarded on CREATE.

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

**Root Nodes via `parentId: null`**: No sentinel value like `"ROOT"`. Adapter queries use `where('parentId', '==', null)` directly. TypeScript type is `parentId: string | null`.

**History ID Scheme**: `${dataFieldId}:${rev}` composite key. `rev` is monotonic per field (0 on create, increments on update). Enables ordered history without timestamp collisions.

**Timestamps**: `Date.now()` wrapped in `now()` from `src/utils/time.ts` for future mockability. Currently client-assigned; LATER.md tracks server-assigned timestamp migration.

### Hook Patterns

**useNodeCreation**: Extracts duplicate creation flow from RootView/BranchView. Returns `{ ucNode, start$, cancel$, complete$ }`. Internally calls `startConstruction$` (FSM transition), then on complete calls `getNodeService().createWithFields()` (data layer).

**useDoubleTap**: Returns `{ checkDoubleTap$ }` which takes `(x, y)` and returns boolean. Caller handles what to do on double-tap. Internal state (`lastDownAt`, `lastDownX`, `lastDownY`) persists across taps via Qwik signals.

**usePendingForms**: Extracts pending form management from TreeNodeDisplay. Handles localStorage persistence of in-progress field creation forms. Returns `{ forms, add$, save$, cancel$, change$ }`.

**useFieldEdit**: Extracts all edit state/interaction logic from DataField. Handles FSM integration, double-tap detection, focus management, outside-click cancellation, preview mode. Returns refs, state, and handlers. Reduced DataField from 274 to 141 lines.

### Accessibility

**Keyboard Editing Path**: DataField value has `tabIndex={0}` and `role="button"` with `onKeyDown$` handling Enter/Space to begin edit. Input handles Enter (save) and Escape (cancel). Focus management via `autoFocus` on input when entering edit mode.

**ARIA on Expansion**: Chevron buttons use `aria-expanded={isExpanded}` and descriptive `aria-label` ("Expand field details" / "Collapse field details"). Changes based on state, not just static labels.

### CSS Architecture

**Three-Layer Token System** (`tokens.css`):

1. Primitives — raw color palette (`--color-gray-600: #666`)
2. Semantic tokens — purpose-mapped (`--text-muted: var(--color-gray-600)`)
3. Component tokens — specific overrides in CSS modules

Semantic tokens used throughout; primitives never referenced directly in components. Enables future theming by overriding semantic layer.

**Utility Classes** (`global.css`):

- `.no-caret` — prevents text cursor on interactive non-input elements
- `.btn-reset` — strips button defaults (background, border, padding)
- `.input-reset` — strips input defaults for inline editing
- `.input-underline` — common underline pattern with focus color change

**Deliberate Non-Abstractions**: Evaluated and skipped these components:

- **ActionButtons component** — Cancel/Save patterns vary enough (different labels, sizing, slot usage, conditional rendering) that abstraction would be more complex than duplication.
- **Input component** — Utility classes (`.input-reset`, `.input-underline`) cover the patterns. A component would just wrap these without meaningful benefit.
- **Service context pattern** — Module-level registry with `setNodeService()`/`setFieldService()` already enables test mocking. Context pattern deferred until multiple service implementations exist (online/offline).

### File Organization

```
src/
├── components/
│   ├── CreateDataField/      # Pure form: name/value inputs + Save/Cancel
│   ├── DataField/            # Editable field row, uses useFieldEdit hook
│   ├── DataFieldDetails/     # Inline metadata, history, delete (display:contents grid items)
│   ├── DataFieldHistory/     # Scrollable historical values list
│   ├── FieldList/            # Orchestrates persisted + pending fields for a node
│   └── TreeNode/
│       ├── TreeNode.tsx          # Orchestrator (picks display vs construction)
│       ├── TreeNodeDisplay.tsx   # Persisted node, delegates fields to FieldList
│       ├── TreeNodeConstruction.tsx  # UC form, uses CreateDataField for all fields
│       ├── types.ts              # Discriminated union props + type guards
│       └── useTreeNodeFields.ts  # Field loading hook
├── styles/
│   ├── tokens.css    # Design tokens (primitives, semantic, layout)
│   └── global.css    # Reset, focus styles, utility classes, view layouts
├── state/
│   ├── appState.ts   # FSM state, transitions, selectors, context
│   └── uiPrefs.ts    # localStorage persistence (Sets ↔ JSON arrays)
├── data/
│   ├── services/
│   │   ├── index.ts          # Service interfaces + registry (adapter-backed)
│   │   └── withErrorHandling.ts  # safeAsync wrapper
│   └── storage/
│       ├── storageAdapter.ts     # StorageAdapter interface
│       ├── storageErrors.ts       # StorageError types and helpers
│       └── firestoreAdapter.ts    # FirestoreAdapter implementation
├── hooks/
│   ├── useDoubleTap.ts       # Gesture detection (pure + hook)
│   ├── useFieldEdit.ts       # Field edit state/interactions
│   ├── useNodeCreation.ts    # Creation flow orchestration
│   └── usePendingForms.ts    # Pending form management with LS persistence
└── constants.ts              # USER_ID, COLLECTIONS, DEFAULT_DATAFIELD_NAMES
```

### Testing Notes

**Service Testing**: Tests use the same registry abstraction as components (`getNodeService()`/`getFieldService()`) with `FirestoreAdapter`. Tests can use `setNodeService()`/`setFieldService()` to swap implementations, or `useStorageAdapter()` to swap adapters. Integration tests use the real `FirestoreAdapter` against the emulator; no adapter mocks—tests exercise the real abstraction.

**Pure Function Testing**: `detectDoubleTap` is exported separately from hook for direct unit testing without Qwik rendering. Pass deterministic timestamps and positions, assert on return values.

**localStorage Mocking**: `uiPrefs.test.ts` uses a mock `localStorage` object. Tests verify Set↔Array conversion and persistence behavior.

### PWA Configuration

**Manifest & Icons**: `public/manifest.json` defines app metadata (name: "Complete Maintenance Management", short_name: "CMM", theme colors, display mode). Icons at `public/icon-192.png` and `public/icon-512.png` for home screen installation. Manifest linked in `root.tsx` via `<link rel="manifest">`.

**Service Worker**: `src/routes/service-worker.ts` uses Qwik City's `setupServiceWorker()` for automatic build artifact precaching and smart cache invalidation. Custom handlers added for:

- HTML requests: Network-first (fresh SSR when online, cache fallback)
- Static assets: Handled by Qwik's built-in cache-first strategy
- Message handler: Supports `SKIP_WAITING` for immediate activation

Service worker must export `onGet: RequestHandler` despite being unused—Qwik City routing requirement.

**Cache Strategy**: Two-tier caching via service worker (HTTP assets) + IndexedDB (application data). Service worker handles offline shell; app logic handles offline data persistence. No overlap—clear separation of concerns.

### Build Pipeline

**Three-Stage Build Process** (`package.json` scripts):

1. **Type Check** (`build.types`): `tsc --incremental --noEmit` validates types without emitting files
2. **Client Build** (`build.client`): `vite build` produces static assets in `dist/`
   - Outputs: `/build/` directory (code-split chunks), `index.html`, `service-worker.js`, `manifest.json`, icons
   - Base config: `vite.config.ts` (Qwik City + Qwik Vite plugins)
3. **Server Build** (`build.server`): `vite build -c adapters/static/vite.config.ts`
   - Generates SSR bundle in `server/` directory
   - Uses `staticAdapter` from `@builder.io/qwik-city/adapters/static/vite`
   - Runs Static Site Generation (SSG) to pre-render routes

**Build Output Structure**:

```
dist/
├── build/              # Code-split JS chunks (q-*.js)
├── assets/             # CSS bundles
├── index.html          # Pre-rendered HTML (SSG output)
├── service-worker.js   # Generated service worker
├── manifest.json       # PWA manifest
├── icon-*.png          # App icons
└── q-manifest.json     # Qwik chunk manifest

server/
├── entry.ssr.mjs       # SSR entry point
├── @qwik-city-plan.mjs # Route config
└── q-*.js              # Server chunks
```

**Static Adapter Configuration** (`adapters/static/vite.config.ts`):

```typescript
staticAdapter({
  origin: 'http://localhost:4173', // Base URL for SSG
})
```

Extends base `vite.config.ts` via `extendConfig()`. Uses `@qwik-city-plan` as SSR input.

**Vite Base Config** (`vite.config.ts`):

- Plugins: `qwikCity()` (routing, SSG), `qwikVite()` (optimizer)
- Preview server headers: `Cache-Control: public, max-age=600` (10 min cache)
- Allowed hosts: `host.docker.internal` for container dev

### Development Workflow

**Scripts** (`package.json`):

```json
{
  "dev": "vite --mode ssr",           // Dev server with HMR
  "build": "npm run build.types && npm run build.client && npm run build.server",
  "preview:pwa": "npx serve dist -l 4173",  // Serve built PWA
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Common Workflow**:

1. Development: `npm run dev` (port 5173, SSR mode with HMR)
2. Production build: `npm run build`
3. Preview production: `npm run preview:pwa` (port 4173)

**Windows Build Issue**: On Windows, stop preview server before rebuilding to avoid `EPERM` file lock errors:

```bash
# Kill server first
taskkill /F /PID <pid>

# Then rebuild
rm -rf dist && npm run build
```

Or use sequential: `npm run build && npm run preview:pwa`

**ESLint Configuration** (`eslint.config.mjs`):

- Flat config format (ESLint 9+)
- TypeScript ESLint integration (`typescript-eslint`)
- Globals: browser, node
- Custom rules:
  - `@typescript-eslint/no-explicit-any`: off (pragmatic for Firebase SDK)
  - `@typescript-eslint/no-unused-vars`: warn (non-blocking)

**Package Management**:

- Runtime: `@builder.io/qwik` (1.16.0), `dexie` (4.2.1), `firebase` (12.1.0)
- Dev: Vite 6.4.1, TypeScript 5.9.2, Vitest 4.0.14, Cypress 15.8.1
- No build-time PWA plugin—service worker manually configured for full control

**TypeScript Config** (`tsconfig.json`):

- Strict mode enabled
- Module: ES2022 (top-level await, dynamic import)
- Target: ES2021
- Paths: `~/*` maps to `src/*`
- Includes Qwik JSX types

### Deployment Considerations

**Static Hosting Requirements**:

1. Serve `dist/` directory as root
2. Configure cache headers per Qwik recommendations:
   - `build/*`: `Cache-Control: public, max-age=31536000, immutable` (1 year, hashed filenames)
   - `*.html`: `Cache-Control: no-cache` (validate on each request)
   - `service-worker.js`: `Cache-Control: no-cache` (critical for updates)
3. HTTPS required for service worker registration (except localhost)

**Service Worker Updates**: On new deployments, browser checks `service-worker.js` for changes. Byte-level diff triggers new SW installation. Qwik's `setupServiceWorker()` invalidates old caches automatically. Users get updates on next page load (or via `SKIP_WAITING` message).

**Bundle Size Notes**: Qwik's resumability enables aggressive code splitting. Initial bundle is minimal (~3KB); chunks load on interaction. Largest chunk (`q-CcMbo_mJ.js`: 538KB uncompressed, 143KB gzipped) contains Firebase SDK—lazy-loaded only when storage initializes. Consider dynamic imports if becomes problematic.
