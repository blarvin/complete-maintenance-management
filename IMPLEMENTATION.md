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

### Styling Strategy
- **Primary**: Plain CSS Modules colocated with components (e.g., `TreeNode.css?inline`)
- **Design tokens**: Implement SPEC CSS variables in a global `tokens.css` and import once in the app entry
- **Utilities**: TailwindCSS is optional; if enabled, limit to `@apply` inside component CSS to keep markup clean. If it adds complexity, defer heavy Tailwind usage to later.

### Mobile-first UI and UX
- **Disable pinch-zoom** to reduce double-tap conflicts

### Data Layer (Offline-Only)
- **Persistence**: Firebase Firestore Web SDK with offline persistence (IndexedDB) enabled
- **Timestamps/IDs**: `Date.now()` for `updatedAt`; `crypto.randomUUID()` for IDs; `editedBy`="localUser"
- **Writes**: Use SDK; debounce mutations (~300ms) to reduce churn; keep integrity helpers (maintain `childNodes`/`dataFields` mirrors) before writes
- **UI state**: `localStorage` (`treeview:ui:cardsExpanded`, `treeview:ui:fieldDetailsExpanded`)

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

### TailwindCSS
- limit use to `@apply` within component CSS to keep HTML uncluttered

### Testing & QA (Phase 1)
- Manual testing only; smoke flows: create node, navigate up/down, add/edit/delete field, persistence across reloads
- Add `npm run typecheck` and lint script
