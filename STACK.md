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

### Mobile-first UI and UX
- **diasble pinch-zoom to reduce double-tap conflicts

### Data Layer (Offline-Only)
- **Persistence**: Firebase Firestore Web SDK with offline persistence (IndexedDB) enabled
- **Phase 1 mode**: Offline-only; no network/sync. Optional Firebase CLI Emulator for local projects.
- **Collections**: `treeNodes`, `dataFields`, `dataFieldHistory` (each record includes `treeID` and `treeType`="AssetTree")
- **Timestamps/IDs**: `Date.now()` for `updatedAt`; `crypto.randomUUID()` for IDs; `editedBy`="localUser"
- **Writes**: Use SDK; debounce mutations (~300ms) to reduce churn; keep integrity helpers (maintain `childNodes`/`dataFields` mirrors) before writes
- **UI state**: Still in `localStorage` (`treeview:ui:cardsExpanded`, `treeview:ui:fieldDetailsExpanded`)

### Types & IDs
- **IDs**: `crypto.randomUUID()`
- **editedBy**: constant "localUser"
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
