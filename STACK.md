## Tech Stack & Implementation Decisions (Phase 1)

### Runtime, Tooling, Conventions
- **Node.js**: 20.x LTS
- **Package manager**: npm (keep simple)
- **TypeScript**: strict mode enabled; no `any` in exported APIs
- **Lint/Format**: ESLint + Prettier (defaults), run in CI later; local-only for Phase 1

### Framework & Routing
- **UI framework**: Qwik + Qwik City
- **Adapter**: Static site build (SSG) for Netlify; no server/runtime code in Phase 1
- **Routes**: Single route `/` that renders either ROOT or ASSET view via in-app state. No URL changes for navigation (per SPEC).

### Styling Strategy
- **Primary**: Plain CSS Modules colocated with components (e.g., `TreeNode.css?inline`)
- **Design tokens**: Implement SPEC CSS variables in a global `tokens.css` and import once in the app entry
- **Utilities**: TailwindCSS is optional; if enabled, limit to `@apply` inside component CSS to keep markup clean. If it adds complexity, defer heavy Tailwind usage to later.

### Data Layer (Local-Only)
- **Persistence**: `localStorage` only (Phase 1); single-tab source of truth
- **Stores/keys**:
  - `cmms:treeNodes`
  - `cmms:dataFields`
  - `cmms:dataFieldHistory`
  - UI state (expand/collapse): `cmms:ui:cardsExpanded`, `cmms:ui:fieldDetailsExpanded`
- **Serialization**: `{ schemaVersion, lastSavedAt, data }` via JSON.stringify
- **Debounce saves**: ~300ms after mutations
- **Load behavior**: Parse on startup; if missing/corrupt, start empty
- **Integrity helpers**: Maintain mirrors on every mutation
  - `addNode`, `removeNode` keep parent `childNodes` accurate
  - `addField`, `removeField` keep parent `dataFields` accurate
  - `recomputeMirrorsFromTables()` available for sanity checks (dev-only)

### Types & IDs
- **IDs**: `crypto.randomUUID()`; fallback tiny UUID if necessary
- **editedBy**: constant `"localUser"` (single-user Phase 1)
- **updatedAt**: `Date.now()` on each mutation
- **Entity types**: Align with SPEC for `TreeNode`, `DataField`, `DataFieldHistory`

### State Management
- **Approach**: Qwik `useStore` + context providers; no external state library
- **Top-level app state**:
  - `currentParentNodeId` (for ASSET view), `"ROOT"` shows ROOT view
  - `treeNodes`, `dataFields`, `dataFieldHistory` (in-memory tables)
  - Ephemeral UI: `editingFieldId`, per-node `isCardExpanded`, per-field `isMetadataExpanded`
- **Finite State Machines**: Keep simple with typed flags/enums and pure helper reducers. No FSM library.





### TailwindCSS (Optional)
- If enabled: add Tailwind + PostCSS; limit use to `@apply` within component CSS to keep HTML uncluttered
- If it slows iteration, disable and rely solely on CSS Modules + tokens

### Testing & QA (Phase 1)
- Manual testing only; smoke flows: create node, navigate up/down, add/edit/delete field, persistence across reloads
- Add `npm run typecheck` and lint script
