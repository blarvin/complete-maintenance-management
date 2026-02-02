# Complete Maintenance Management - Phase 1 Issues

## State Management (FSM)

- [x] ViewState discriminated unions (ROOT, BRANCH with nodeId)
- [x] Selectors for component states (getTreeNodeState, getDataCardState)
- [x] Single-field editing guarantee (editingFieldId in AppState)
- [x] UI prefs serialization (expandedCards, expandedFieldDetails to localStorage)
- [x] FSM transitions (ROOT↔BRANCH, navigateToNode, navigateUp, navigateToRoot)
- [x] AppState context provider (useProvideAppState, useAppState hooks)
- [x] Transition functions (useAppTransitions hook)

## Data Layer

- [x] TreeNode entity (id, nodeName, nodeSubtitle, parentId, updatedBy, updatedAt, deletedAt)
- [x] DataField entity (id, fieldName, parentNodeId, fieldValue, cardOrder, updatedBy, updatedAt, deletedAt)
- [x] DataFieldHistory entity (append-only audit with composite id)
- [x] Root nodes via parentId: null (no sentinel value)
- [x] History ID scheme (${dataFieldId}:${rev})
- [x] Timestamps via Date.now() wrapped in now() helper
- [ ] Soft deletion (deletedAt timestamp) TreeNode and DataField using shared SoftDeletable type and helper functions
- [ ] Implicit hiding of children and fields when a TreeNode is soft deleted.
- [ ] Implicit hiding of DataFieldHistory entries when a DataField is soft deleted.

## Storage & Persistence

- [x] StorageAdapter interface (backend-agnostic)
- [x] IDBAdapter (IndexedDB primary, offline-first via Dexie)
- [x] FirestoreAdapter (cloud sync)
- [x] Service registry (module-level, nodeServiceFromAdapter pattern)
- [x] StorageError with normalized codes (not-found, validation, conflict, etc.)
- [x] Storage initialization (initStorage.ts, first-time setup)
- [x] Firestore→IDB migration (one-time on first load if IDB empty)
- [x] Bulk insert via bulkPut (nodes, fields, history)
- [x] syncMetadata table (lastSyncTimestamp tracking)
- [x] Cypress test mode detection (**CYPRESS_SEED_MODE**)
- [x] clearStorage() utility (testing/reset)
- [x] Immediate sync on startup (if online)
- [ ] Fix IDBAdapter sort direction to match FirestoreAdapter (ascending per SPEC)
- [ ] Use now() in initStorage and storageEvents instead of Date.now()

## Storage Events System

- [x] Custom event system (storage-change CustomEvent)
- [x] dispatchStorageChangeEvent() (triggers UI updates)
- [x] Components listen for storage-change and reload
- [x] Event payload with timestamp
- [x] Used by useRootViewData, BranchView, useTreeNodeFields for auto-reload

## Sync and SyncManager

- [x] Full collection sync (FullCollectionSync strategy)
- [x] History sync (syncHistory in FullCollectionSync)
- [x] Post-sync UI refresh (dispatchStorageChangeEvent in storageEvents.ts)
- [x] Bidirectional sync (push-first, pull-second)
- [x] LWW conflict resolution (last-write-wins)
- [x] Protect pending items (don't delete local items pending push)
- [x] Online/offline event handling
- [x] Extract SyncManager responsibilities (SRP violation - too many concerns)
- [x] Use FirestoreAdapter instead of direct Firestore SDK calls (DIP violation)
- [ ] Extract shared history creation logic (DRY - duplicated in adapters)
- [x] Create TreeNode should trigger sync to cloud DB.
- [x] Create DataField should trigger sync to cloud DB.
- [x] Delete DataField should trigger sync to cloud DB.
- [x] Delete TreeNode should trigger sync to cloud DB.
- [x] Update DataFieldValue should trigger sync to cloud DB.
- [x] REVERT DataFieldHistory should trigger sync to cloud DB.

## Views

- [x] ROOT view (listview of root nodes + CreateNodeButton)
- [x] BRANCH view (parent node + children container with gutter)
- [x] Single grid container for layout (2px gap)
- [x] Empty state shows CreateNodeButton (isRoot state)
- [x] Navigation without URL changes (client-side FSM)
- [ ] ROOT view loading state (BranchView shows "Loading..."; RootView does not)

## TreeNode Component

- [x] Discriminated union props (TreeNodeDisplayProps | TreeNodeConstructionProps)
- [x] Type guards (isConstructionProps, isDisplayProps)
- [x] Four states: isRoot, isParent, isChild, isUnderConstruction
- [x] Orchestrator pattern (picks TreeNodeDisplay vs TreeNodeConstruction)
- [x] Delegates field logic to FieldList
- [x] useTreeNodeFields hook (loads DataFields from DB)

## NodeHeader Component

- [x] Factored out from TreeNodeDisplay (visual card container)
- [x] Clickable header area (title, subtitle, buttons, chevron)
- [x] NodeTitle (displays nodeName bold)
- [x] NodeSubtitle (description/location string)
- [x] Keyboard events for accessibility (Enter/Space)
- [x] UpButton integration (for isParent nodes)
- [x] Expand/collapse chevron button
- [x] Construction mode support (input fields instead of title/subtitle)
- [x] ARIA attributes (role, tabIndex, aria-label, aria-expanded)
- [x] Conditional styling (isExpanded, isParent, isClickable)
- [ ] NodeTitle and NodeSubtitle inline editing (UI/UX decision needed)

## TreeNodeDetails Component

- [ ] Expandable section (ellipsis + TreeNodeDetails component)
- [ ] Node metadata display - CreatedAt, last UpdatedAt, last UpdatedBy
- [ ] Breadcrumb hierarchy display
- [ ] Breadcrumb, full upward navigation
- [x] DELETE button deletes the node (soft-delete, navigate away; confirmation/snackbar/cascade deferred to LATER)
- [ ] DELETE button confirmation dialog (shows counts)
- [ ] DELETE button triggers Snackbar with undo
- [ ] COPY as template and COPY full node buttons

## TreeNode CRUD

- [x] TreeNode DELETE button in TreeNodeDetails component.
- [x] Soft deletion: set deletedAt on TreeNode, and rely on implicit hiding of children.
- [x] No orphan nodes created at underConstruction "Cancel"
- [x] Node creation only on "Create",

... checked to here ...

## DataCard Component

- [x] Dual-transition animation (grid 0fr→1fr + translateY -100%→none). 100ms cubic-bezier timing, synchronized.
- [x] Expand/collapse chevron button (right of NodeSubtitle)
- [x] isExpanded state, persisted to localStorage
- [x] isUnderConstruction state (default fields, no TreeNodeDetails)
- [x] Content-aware without ref (no explicit height)
- [ ] Remove unused nodeId prop

## DataField Component (Basic_Key_Value)

- [x] Double-tap to edit (with slop tolerance, 280ms threshold)
- [x] Keyboard editing (Enter/Space to edit, Enter to save, Escape to cancel)
- [x] useFieldEdit hook (extracts state/interaction logic)
- [x] Focus management (autoFocus on input, blur cancel suppression)
- [x] Outside-click cancellation
- [x] Single underline affordance (no double underline while editing)
- [x] Text caret cursor when editing (via input)
- [x] isMetadataExpanded state (persisted to localStorage)
- [ ] Create DataFieldHistory entries immediately (not just on re-open)
- [ ] Standardize nomenclature (DataField vs DataFieldValue)

## DataFieldDetails Component

- [x] Expandable section (chevron + "Field Details")
- [x] Field metadata display
- [x] DELETE button deletes the field
- [ ] DELETE button confirmation dialog
- [ ] DELETE button triggers Snackbar with undo
- [x] display:contents grid layout (inline grid items)
- [ ] Full cascade delete implementation (currently minimal)
- [ ] DataField deletion persist to DB and sync to all clients
- [ ] Shows "Invalid Date" sometimes (BUG)

## Data Field CRUD

- [x] DataField soft deletion with deletedAt timestamp.
- [x] Deletion of Data Field implicitly deletes (hides)the associated DataFieldHistory entries.
- [ ] DataField restoration UI: And code to set deletedAt timestamp to null.

## DataFieldHistory Component

- [x] Scrollable historical values list
- [x] Append-only audit log (action, property, prevValue, newValue)
- [x] Rev counter (monotonic per field)
- [x] REVERT button only active when a historical value is selected
- [ ] REVERT button should not be active/available when current value or original empty value is selected
- [x] CANCEL button cancels the edit and closes history list
- [x] Current entry not selectable for reversion
- [x] Empty entry (original null) not selectable for reversion
- [ ] Shows "NaN/Nan/NaN NaN:NaN" instead of date and time (BUG)

## DataFieldHistory CRUD

- [ ] Create DataFieldHistory entry immediately (not just on re-open)

## CreateDataField Component

- [x] Pure form component (name/value inputs + Save/Cancel)
- [x] Dropdown picker from DATAFIELD_LIBRARY
- [x] Parent manages persistence (FieldList or TreeNodeConstruction)
- [x] 30-form limit enforcement
- [x] Default fields at node creation (Type Of, Description, Tags)
- [ ] Up/down arrow keys for pick, Enter to confirm (keep touch working)
- [ ] Typeahead search/filtering in picklist
- [ ] Dropdown clickaway (close when tab/click to value input)
- [ ] Dropdown flip behavior (upward if insufficient space below)

## FieldList Component

- [x] Orchestrates persisted fields + pending forms
- [x] usePendingForms hook (localStorage persistence)
- [x] Add/save/cancel logic for pending forms
- [x] 30-form limit via pendingCount prop
- [x] Refreshes field list on save
- [x] Unified field items (persisted | pending discriminated union)
- [x] Sorted by cardOrder (merges persisted + pending)
- [x] FieldListHandle for external control (saveAllPending$ method)
- [x] Renders DataField for persisted, CreateDataField for pending
- [x] "+ Add Field" button
- [ ] cardOrder needs to recalculate when a DataField is "cancelled" on Under Construction Node. Currently showing wrong order in DB after creation.

## CreateNodeButton Component

- [x] Contextual variants (root, child)
- [x] Root variant: large button mimics ROOT node at bottom
- [x] Child variant: small inline buttons (n+1)
- [x] Normal document flow (no absolute positioning)
- [x] Creates TreeNode in isUnderConstruction state

## TreeNodeDetails Component

- [x] Expandable section (ellipsis opens TreeNodeDetails; "Delete Asset" button)
- [ ] DELETE button with confirmation (shows counts)
- [ ] Cascade delete (node + descendants + fields + history)
- [ ] Snackbar with 5s undo (in-memory snapshot)
- [ ] Undo survives navigation (not page reload)

## Snackbar Component

- [ ] Global transient notification toast at bottom
- [ ] Message + optional "Undo" button
- [ ] Auto-dismiss after 5s
- [ ] Single-slot (latest replaces current)
- [ ] Used for field saves, deletes, cascade deletes

## Navigation & Up Button

- [x] "Up" button on isParent nodes (navigates to parent or ROOT)
- [x] Down-tree navigation (tap any child → isParent state)
- [x] FSM-based transitions (explicit state changes)
- [ ] Double-tap Up button to navigate to ROOT view
- [ ] Store parentId at instance location for snappier navigation

## Hooks

- [x] useNodeCreation (extracts creation flow from views)
- [x] useDoubleTap (pure function + signal-based hook)
- [x] usePendingForms (pending form management with localStorage)
- [x] useFieldEdit (field edit state/interactions, reduced DataField from 274→141 lines)
- [x] Pure detectDoubleTap function (separately testable)
- [x] Slop distance (Manhattan dx/dy ≤ 6px)
- [x] Suppression window (220ms blur cancel suppression after save)
- [x] useBranchViewData (loads parent node + children data)
- [x] useRootViewData (loads root nodes, listens to storage-change events)
- [x] useInitStorage (client-side storage initialization on document-ready)

## Accessibility

- [x] Keyboard editing path (Tab, Enter, Space, Escape)
- [x] Focus management (autoFocus, tabIndex, focus-visible styles)
- [x] ARIA attributes (aria-expanded, aria-label, aria-labelledby)
- [x] Semantic HTML (article, button, h2, label)
- [x] AI agent compatibility (descriptive accessibility tree)
- [ ] Move Focus X/Y around app after Tab key activation

## CSS & Styling

- [x] Three-layer token system (primitives, semantic, component)
- [x] Semantic tokens throughout (never primitives directly)
- [x] Utility classes (no-caret, btn-reset, input-reset, input-underline)
- [x] CSS modules per component
- [x] Global reset and focus-visible styles
- [x] Design tokens in tokens.css
- [ ] Tree-line and branch-line CSS decorations (deferred Phase 2)

## PWA Configuration

- [x] Manifest.json (name, short_name, theme, icons)
- [x] Service worker (setupServiceWorker, precaching, cache invalidation)
- [x] Icons (192px, 512px)
- [x] HTML network-first, assets cache-first
- [x] SKIP_WAITING message handler
- [x] Manifest linked in root.tsx
- [x] Two-tier caching (service worker HTTP + IndexedDB data)
- [x] iOS Safari PWA support (apple-mobile-web-app meta tags)
- [x] Apple touch icon (apple-touch-icon link)
- [x] Mobile web app capable (meta viewport, mobile-web-app-capable)
- [x] Theme color meta tag (for browser UI)

## Build Pipeline

- [x] Three-stage build (types, client, server)
- [x] Type check (tsc --incremental --noEmit)
- [x] Client build (vite build → dist/)
- [x] Server build (SSG via staticAdapter)
- [x] Code splitting (resumability, lazy chunks)
- [x] Static adapter config (origin, SSR)
- [x] ESLint flat config (TypeScript, globals)
- [x] TypeScript strict mode (ES2022 module, ES2021 target)

## Testing Infrastructure

- [x] Service testing via registry (getNodeService, getFieldService)
- [x] Pure function testing (detectDoubleTap separately exported)
- [x] localStorage mocking (Set↔Array conversion tests)
- [x] 212+ unit tests (Vitest)
- [x] Cypress E2E (against Firestore emulator)
- [x] fake-indexeddb for fast unit tests
- [x] Test utils (shared utilities)

## Dev Tools & Utilities

- [x] Dev tools (window.**sync(), window.**syncStatus()): manual sync triggering via browser console.
- [x] Sync status inspection (enabled, isSyncing)
- [x] initializeDevTools() called from initStorage
- [x] ID generation utility (generateId with crypto.randomUUID fallback)
- [x] Time utility (now() wrapper for Date.now(), future mockability)
- [x] User context abstraction (getCurrentUserId, Phase 1 constant "localUser")

## Constants & Configuration

- [x] USER_ID constant ("localUser" for Phase 1)
- [x] COLLECTIONS constants (treeNodes, dataFields, dataFieldHistory)
- [x] DATAFIELD_LIBRARY (15 hardcoded field names from SPEC)
- [x] DEFAULT_DATAFIELD_NAMES (Type Of, Description, Tags)
- [x] DataFieldName type (from DATAFIELD_LIBRARY)

## Known Issues & Tech Debt

- [ ] Extract inline magic numbers (FOCUS_DELAY_MS=10, BLUR_SUPPRESS_WINDOW_MS=220, DEFAULT_SYNC_INTERVAL_MS=600000)
- [ ] SyncManager SRP violation (too many responsibilities)
- [ ] DRY: history creation logic duplicated (IDB + Firestore adapters)
- [ ] DRY: nextRev() and recomputeCardOrder() duplicated
- [ ] OCP: SyncManager switch statement (should use strategy pattern)
- [ ] Unused safeAsync wrapper (exported but not applied everywhere)
- [ ] Console logging in SyncManager (should use proper logging abstraction)
- [ ] Inconsistent error handling (FirestoreAdapter comprehensive, IDBAdapter minimal)

## General UI/UX Improvements

- [ ] DataFieldValues: remove double underline while editing (current underline is affordance)
- [ ] DataCard animation: ensure physical push vs layout reflow robustness
