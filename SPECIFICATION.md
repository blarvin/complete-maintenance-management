# Asset Tree Management Specification

## Overview

Asset maintenance and management app for physical assets (vehicles, buildings, industrial machinery, etc.) using a recursive tree structure where nodes represent things and their parts.

Unlike common tree view UIs where each node only has a name, this app has four levels of knowledge structure:

- Level I: Nodes represent things and their constituent parts. The structure, what parent and child hierarchical relationships ARE the first level of information.
- Level II: Data pertaining directly to one Node; facts, attributes, properties, characteristics, etc. of the Node itself. Each Node has one Data Card containing any number of Data Fields (facts about that thing). The Node's own Title and Subtitle are on this level conceptually, but reside above the Data Card in a Node Header.
- Level III: Each Data Field has a Field Details section containing context (e.g., metadata) and management actions (e.g., delete).
- Level IV: Each Data Field has a user‑facing history of previous Field values.
- Level V: The fifth level of knowledge presentation/interaction is the "meta" level: Help, App Training, App Feedback. These are fully contextualized at every point, every UI affordance, within the tree view. UI intention is a seperate layer of "i" icons, which may be hidden. [Phase 2+]

This structure enables users to construct, explore, and understand detailed hierarchical models of real world assets.

## Core Principles

- **Recursive Tree Structure**: Every node is much the same as any other and can have any number of child nodes.
- **Self Similarity**: Single TreeNode component handles all levels
- **Self-Construction**: Users are fully enabled to create and edit assets, structure, and attributes.
- **All-Editable**: Everything is edited, changed, added by Users (except metadata).
- **Modeless In-Situ Editing**: Edit without leaving the tree view or entering edit modes
- **Mobile-First**: Vertical scrolling, single/double-tap interactions
- **Offline-First**: Full UI and any data created locally or already loaded is available indefinitely. All operations persist to local storage first, then sync to cloud when online. No difference in UX online or offline. Seamless automatic background sync, update, and reconcile via bidirectional sync with Last-Write-Wins conflict resolution.

## Component Architecture

### Views

- **ROOT View**: [DONE] Listview of top-level TreeNodes (each in isRoot state) + "Create New Asset" button at the bottom.
- **BRANCH View**: [DONE] One parent TreeNode (isParent state) at top, followed by indented children below. Children are visually indented by `--child-indent`.

### Core component hierarchy

- **TreeNode**: [DONE] Main component with NodeTitle, NodeSubtitle, DataCard, CardExpandButton. Should appear as a horizontal row with two nested rows (NodeTitle and NodeSubtitle components), optimized for vertical scrolling lists.
- **NodeTitle**: [DONE] Displays the current node's `nodeName` (bold).
- **NodeSubtitle**: [DONE] Simple description or location string
- **DataCard**: [DONE] Every TreeNode has exactly one DataCard. Contains DataFields (user values) + "Add New Field" button + node metadata section. Expands/collapses with an animated slide-down, triggered by a chevron button on the TreeNode body to the right of NodeSubtitle. Animation must be content-aware (no fixed heights). See IMPLEMENTATION.md → DataCard Animation for technique.
- **DataField**: [DONE] Row item with Label:Value pairs, which users add to a node. Most values can be edited afterwards with a simple double-tap interaction. When isEditing=true, the Value is replaced with an input field (Label remains static). No separate input sub-component needed.
- **DataFieldDetails**: [DONE] Expandable section (simple chevron) with Field Value history, edit history, creation details, etc., and a delete feature for the Data Field.
- **CreateDataFieldButton**: [DONE] Button at the bottom of the DataCard to create a new Data Field for the node on its DataCard.
- **UpButton**: [DONE] On the left end of isParent nodes (node at top of BRANCH view). Navigates up the tree using parentId to find the parent node. If parentId is null, navigates to ROOT view.
- **CreateNodeButton**: [DONE] Create new TreeNodes. One component with contextual variants for ROOT and BRANCH views.
- **TreeNodeDetails**: [DONE] Expandable section (simple chevron and label "Tree Node Details") containing details, actions, and settings pertaining to the whole TreeNode. DELETE button only for now; Rename and Move [Phase 2+].
- **Snackbar**: Global transient notification toast. See Snackbar & Undo section below for full spec.

## TreeNode States [DONE]

- **isRoot**: Top-level nodes on ROOT view. Full width, no children shown, no "Up" button, abbreviated DataCard (first 6 DataFields by updatedAt, or all if fewer than 6). All TreeNodes are in this state at ROOT view.
- **isParent**: Current node being viewed at top of BRANCH view. Full width, children shown below, "Up" button, full DataCard. One TreeNode is in this state at top of BRANCH view.
- **isChild**: Child nodes under current parent. Narrower (indented) on the left, no children shown, full DataCard. Any number of first-child TreeNodes appear in this state below the current isParent instance in the BRANCH view.
- **isUnderConstruction**: New node requiring setup with in-situ fillable Name and Subtitle fields. Replaces CreateNodeButton button in-place as either isRoot or isChild. The isUnderConstruction node's DataCard state is also set to isUnderConstruction.

## DataCard States [DONE]

- **isExpanded**: DataCard is open/closed. Persisted to local storage.
- **isUnderConstruction**: Default Data Field values are active for entry in-situ (though not required). TreeNodeDetails not shown. CreateDataFieldButton in last row and functions as normal. "Save" and "Cancel" buttons at the bottom.

## DataField States [DONE]

- **isMetadataExpanded**: Field Details area is expanded/collapsed. Persisted to local storage.
- **isEditing**: Data Field is active for editing (active input field). Not persisted - component-local state only.

## CreateNodeButton Contextual Variants [DONE]

- **root** (ROOT view): Large button styled to mimic a ROOT node at the bottom of ROOT view. Aria-label/title: "Create New Asset".
- **child** (BRANCH view): Small inline buttons aligned with the children indent gutter. For n child nodes, render n+1 buttons (between, above, below child nodes). Aria-label/title: "Create New Sub‑Asset Here". Clicking creates a `TreeNode` in isChild state and inserts it at the button's position.
- **State on Create** New node appears in `isUnderConstruction` state with in‑situ Name and Subtitle fields.

### State Transitions (use finite state machine pattern) [DONE]

- isRoot → isParent (navigate to BRANCH VIEW)
- isChild → isParent (navigate deeper)
- isParent → isRoot (navigate to home using "Up" button)
- isUnderConstruction → isRoot or isChild (new node created in-situ where button clicked)

## User Experience pathways

### Navigation Logic ... handled client-side without URL changes [DONE]

- **Down-tree**: Move down the tree by tapping any child node. Takes user to isParent state for that node.
- **Up-tree**: The "Up" button navigates to current node's parent's isParent state, or to ROOT view if no parent.

### Node Creation [DONE]

- **Create Node**: CreateNodeButton Creates a new TreeNode in isUnderConstruction state, as a child of the current parent (including ROOT). On the BRANCH view, multiple child variant instances appear between the isChild instances of TreeNode.
- **Node Construction UI/UX**: In isUnderConstruction state, user must enter "Name" (nodeName) and "Subtitle" (nodeSubtitle) in their respective places on the TreeNode. Name is required; empty names are not allowed.
- **Add DataFields at Node creation**: In isUnderConstruction state, the `DataCard.isUnderConstruction` contains the default DataFields, with DataFieldValue ready for user entry, but may be left blank.
- **Actions**: "Create"/"Cancel" buttons to finalize or abort the creation of the new TreeNode.

### Node Deletion

- **Delete Tree Node**: [DONE] Button available in TreeNodeDetails section of DataCard.
- [DONE] Deleting any `TreeNode` performs a **soft delete**: sets `deletedAt` timestamp on the node. Children are implicitly hidden (not cascade soft-deleted) — queries filter out children of soft-deleted parents.
- [DONE] During deletion, no new `DataFieldHistory` entries are written; manual per‑field deletes do write a `delete` history entry (see DataField Management).
- [DONE] Root (tree) deletion uses the same soft delete mechanism.
- Confirmation dialog summarizing counts (nodes, fields) before proceeding. Snackbar with Undo follows (see Snackbar & Undo).

## DataField Management

- **Double-Tap to edit**: [DONE] Double-tap on a DataField row (Label or Value) to edit the Value. The Value becomes an active input field. Save by double-tapping again. Cancel by tapping outside. If another DataField is already editing, it is cancelled. Save confirmation shown via Snackbar (see Snackbar & Undo).
- **Create Data Fields (Composer)**: A "+ Add Fields" button at bottom of the DataCard expands the **Field Composer**: an inline section (within the DataCard) showing every available FieldDefinition as a row in a single list. Each row has a checkbox; checking a row replaces the label-only row in-place with a live editable preview of that FieldDefinition (rendered with its real FieldComponent). Save commits every checked row as a real DataField on the node; Cancel discards them. The Composer also hosts the "+ New Field Definition…" authoring affordance. See "Field Composer" and "DataField Components, Field Definitions, and Library" below.
- **Delete Data Field**: [DONE] Expand the DataFieldDetails to see a "Delete" button at the bottom of the section. Snackbar with Undo follows (see Snackbar & Undo).
  - **Soft Delete**: [DONE] DataField deletion sets `deletedAt` timestamp. The field is filtered from normal UI queries but can be restored. DataFieldHistory entries remain linked but are implicitly hidden when the field is soft-deleted.
  - A `DataFieldHistory` entry with `action: "delete"`, `property: "value"`, and `newValue: null` is written only after the undo window elapses.

## Snackbar & Undo

A single global Snackbar component provides transient feedback and brief undo for destructive or significant actions.

### Snackbar component

- Fixed-position toast at the bottom of the viewport.
- Shows a message and an optional action button (typically "Undo" or "Retry").
- Auto-dismisses after its duration elapses (default 5s; 8s for errors).
- **Single-slot**: only one Snackbar is visible at a time. A new toast replaces the current one immediately; only the most recent action can be undone.
- **Timer pause**: the auto-dismiss countdown pauses while the toast is hovered or keyboard-focused, and resumes on blur.
- **Manual dismissal**: `Esc` dismisses the current toast. The action button (if present) dismisses on activation after running its handler.

### Variants

| Variant             | Use                                                          | Default duration | ARIA                                    |
| ------------------- | ------------------------------------------------------------ | ---------------- | --------------------------------------- |
| `success` (default) | Save/delete confirmations with optional Undo                 | 5s               | `role="status"`, `aria-live="polite"`   |
| `error`             | Immediate storage-op failures (IDB write, quota, validation) | 8s               | `role="alert"`, `aria-live="assertive"` |
| `info`              | Neutral notices (reserved; not used in Phase 1)              | 5s               | `role="status"`, `aria-live="polite"`   |

### When the Snackbar appears

| Trigger                      | Variant | Message                                | Action                                 |
| ---------------------------- | ------- | -------------------------------------- | -------------------------------------- |
| DataField value saved        | success | "Field updated"                        | Undo — reverts to previous value       |
| DataField deleted            | success | "Field deleted"                        | Undo — clears `deletedAt`              |
| TreeNode deleted             | success | "Node deleted" (with descendant count) | Undo — clears `deletedAt`              |
| Immediate storage-op failure | error   | From `StorageError.describeForUser()`  | Retry (if the op is retryable) or none |

Background sync failures are **not** surfaced — `SyncQueueManager` retries silently. Sync-status and pull-applied notifications are deferred (see LATER.md).

### Component API

A module-level service registry, matching the `getNodeService()` / `getFieldService()` idiom:

```ts
interface SnackbarService {
  show(toast: ToastInput): void;
  dismiss(): void; // dismisses current toast without running handlers
}

interface ToastInput {
  message: string;
  variant?: "success" | "error" | "info"; // default "success"
  durationMs?: number; // default by variant
  action?: {
    label: string; // e.g. "Undo", "Retry"
    handler: QRL<() => void | Promise<void>>;
  };
  onExpire?: QRL<() => void | Promise<void>>; // runs if the toast auto-dismisses WITHOUT the action being invoked; used for deferred-write tails (see Undo semantics)
}
```

- Access via `getSnackbarService()`; call inside `$()` handlers, never captured in closures (same rule as other services).
- State is held in a Qwik signal store inside the service. The app renders exactly one `<SnackbarHost>` near the app root that reads from that store.
- Replacement: `show()` while a toast is visible immediately runs the prior toast's `onExpire` (if any), cancels its timer, and renders the new one.

### Undo semantics

- **Immediate apply**: Deletes (soft-delete via `deletedAt`) and saves are written to storage immediately — the UI does not wait for the undo window to elapse.
- **Closure-based undo, not record snapshot**: The Snackbar holds only the reversal closure the caller passed in (`action.handler`) plus the minimum data the caller captured for that closure (e.g. the previous `value` for a value edit, or just the entity id for a delete). There is no snapshot service and no whole-record copy.
- **Scope**: Undo is available across in-app navigation but not across page reloads. Only the latest action can be undone (new toasts replace older ones).
- **History entry deferral**: For DataField deletes, the `DataFieldHistory` entry with `action: "delete"` is written via `onExpire` — only after the undo window elapses without undo — so that undone deletes leave no audit trace.

### Placement & animation

- **Desktop**: bottom-center, max-width ~480px, 16px inset from bottom.
- **Mobile**: bottom, full width minus 8px side insets, above `env(safe-area-inset-bottom)`.
- **Animation**: 150ms slide-up + fade on enter; 150ms fade on exit. Respect `prefers-reduced-motion: reduce` by skipping the slide and using instant show/hide.

### Accessibility

- Toast text is rendered inside the live region; screen readers announce on appearance. Focus is not moved — it stays on whatever the user was interacting with.
- The action button is keyboard-reachable (`Tab`) while the toast is visible and activates on `Enter`/`Space`.
- `Esc` dismisses the current toast from anywhere in the app.

### What Snackbar does NOT cover

- **Undo is not restore.** The 5-second undo window is the only in-app recovery path. After the window lapses, the soft delete is final from the user's perspective.
- **Restore UI** is a separate concern: currently, soft-deleted entities can only be restored by clearing `deletedAt` directly in the cloud database. [Phase 2+]: a dedicated in-app view for browsing and restoring deleted items.

## Loading & Error States

### Loading states

- **BranchView**: [DONE] Shows "Loading..." while the parent node and children are fetched from storage.
- **RootView**: Should show an equivalent loading indicator while root nodes load. Currently renders empty until data arrives (see ISSUES.md).
- **DataFieldHistory**: [DONE] History entries load on expand; the component renders once data is available.

### Error states

Storage operations can fail (IndexedDB quota, corrupt data, Firestore unavailable). Error handling is currently minimal:

- [DONE] `StorageError` contract normalises adapter failures with typed codes (`not-found`, `validation`, `conflict`, `unavailable`, `internal`) and a `retryable` flag.
- User-facing error feedback will use the Snackbar to surface brief error messages when storage operations fail. The `StorageError.describeForUser()` helper provides Snackbar-friendly messages.
- No retry UI or explicit error/retry states in components — Firestore's offline persistence and IndexedDB reliability absorb most failures in practice.

### Sync feedback

The sync system operates silently in the background. There is no user-facing indication of sync status, online/offline state, or data staleness. [Phase 2+]: consider a subtle status indicator (e.g. offline badge, last-synced timestamp).

## Keyboard & Accessibility [DONE]

All interactive elements are keyboard-accessible. This is a core quality bar, not a feature.

- **Semantic HTML**: `<article>`, `<button>`, `<h2>`, `<label>` used throughout; no click handlers on bare `<div>` elements.
- **ARIA attributes**: `aria-expanded` on collapsible sections (DataCard, DataFieldDetails, TreeNodeDetails), `aria-label` on icon-only buttons (UpButton, expand chevrons, CreateNodeButton variants).
- **Keyboard interactions**:
  - DataField value: Enter/Space to begin editing, Enter to save, Escape to cancel
  - Node header: Enter/Space to navigate (body) or expand (chevron)
  - CreateDataField dropdown: ArrowDown to open, Enter to select, Escape to close
  - TreeNodeConstruction: Enter to create, Escape to cancel
- **Focus management**: `:focus-visible` ring on all focusable elements; `:focus:not(:focus-visible)` suppresses the ring for mouse users.

### DataField Reordering

Users can reorder DataFields within a DataCard. Reordering updates `cardOrder` for all affected fields and persists immediately. Detailed UX/interaction design TBD.

## Field Composer

The Field Composer is a unified inline UI for adding one or more DataFields to a TreeNode. It replaces both the legacy single-pick dropdown (display mode) and the bare default-fields list (construction mode) — they share the same composer surface. The Composer is also the **single Phase-1 entry point for FieldDefinition authoring** (see FieldDefinition Authoring UI below).

#### When the composer is visible

- **Display mode** (existing node, viewing its DataCard): no composer by default. Clicking **+ Add Fields** opens it. Save or Cancel dismisses it; the button returns. One composer at a time.
- **Construction mode** (new node, before Save): the composer is visible by default. The seeded default FieldDefinitions ("Type Of", "Description", "Tags") appear as **locked checked rows** — checkbox visibly checked but disabled, so the user can't uncheck them. The user can still check additional FieldDefinitions as normal.

#### Layout

The composer is a single inline-expanded section within the DataCard, distinguished from persisted fields by a **dashed border** around the whole zone. It contains:

1. **In-situ FieldDefinition list** — every active FieldDefinition appears as a row, sorted alphabetically by label. Each row has a checkbox. A **"+ New Field Definition…"** affordance appears as the final row, expanding inline into the authoring form (see FieldDefinition Authoring UI).
   - **Unchecked row**: checkbox + FieldDefinition label only.
   - **Checked row**: checkbox + a live, editable preview of that FieldDefinition, rendered with its actual FieldComponent (TextKvField, EnumKvField, MeasurementKvField, SingleImageField). Toggling the checkbox replaces the row in-place — checking expands the row into the full FieldComponent preview; unchecking collapses it back to label-only.
   - **Locked checked row** (construction mode defaults only): rendered as a checked row, but the checkbox is disabled.
   - The preview is fully editable: the user can set the value, etc. Nothing is persisted to storage until **Save**.
   - Rows transition smoothly (~200ms) on toggle. On check, the _checkbox_ is anchored in the viewport so a tall preview (single-image especially) doesn't shove the user's place off-screen.
   - (Grouping rows by `category` into collapsible sections is [Phase 2+], deferred until FieldDefinition count makes a flat list unwieldy.)

1. **Sticky Save / Cancel footer** — pinned to the bottom of the viewport while the composer is in view, so a long list doesn't bury the actions. Save disabled (display mode) when no rows are checked.

#### Interactions

- **Existing persisted fields remain visible and editable** above the composer. Edits to existing fields commit immediately as today; edits inside the composer are pending until Save.
- **Save** persists every checked row as a `DataField` (executing `ADD_FIELD_FROM_DEFINITION` per row — renamed from `ADD_FIELD_FROM_TEMPLATE`), in **alphabetical order** (matching the visual order in the composer), with each new field assigned a `cardOrder` greater than every already-persisted field on the card. New fields appear at the bottom of the FieldList in the same order they previewed in. After Save, the composer collapses.
- **Cancel** discards every pending row. If any rows had been checked, a Snackbar with Undo follows (`"N fields discarded"` — Undo re-opens the composer with the same rows checked and the same entered values).
- **Click-away does not dismiss the composer.** Pending work is preserved across in-app navigation; the composer is dismissed only by Save or Cancel. (Pending state across reload is best-effort via existing localStorage scaffolding.)
- **Construction mode**: Save here is implicit in node creation. The node's "Save" button finalises the node _and_ the composer's batch in one transaction. Cancel discards the in-progress node entirely, as today.
- **No reorder of pending rows** in this round. Commit order is alphabetical. Reorder of fields (pending and persisted) is designed together as a future task.

#### Why one composer for both modes

Construction-mode "pending forms" and display-mode "newly-added field draft" are the same shape: a set of pending DataField drafts attached to a node, batch-committed on finalize. Unifying them collapses two parallel UI paths into one and removes the awkward "single-row picker" intermediate state.

#### Composer rows pending vs. FieldDefinition authoring

The two pending-state shapes inside the Composer are distinct:

- **Pending DataField draft** (`pendingForm` in `usePendingForms`) — a checked row holds an in-progress _value_ for an existing FieldDefinition. Committed by Save → writes a `DataField`.
- **Pending FieldDefinition draft** — the "+ New Field Definition…" form holds an in-progress _FieldDefinition_ (componentType, label, config). Committed by Save → writes a `FieldDefinition`, then _immediately_ spawns a pre-checked pending DataField draft for it at the same row position.

These are deliberately separate hooks/states because a DataField cannot exist without a FieldDefinition to anchor it.

## DataField Components, Field Definitions, and Library

### Conceptual hierarchy

Four concepts, four layers — each is the precondition for the next:

1. **FieldComponent** — dev-authored code: a renderer + value type + config schema, identified by `componentType` (e.g. `"text-kv"`, `"enum-kv"`). The closed set is owned by the dev team; users cannot create FieldComponents.
2. **FieldPrototype** — informal term for a FieldComponent with its config knobs surfaced but not yet filled in: the "blank authoring form" the UI presents. Not persisted; no record exists until the user gives it a label and saves it as a FieldDefinition. (This term may rarely appear in code — it names the in-UI transient state, not a stored entity.)
3. **FieldDefinition** — a persisted, named, fully-configured kind of field: `{ componentType, label, config, authorId, … }`. FieldDefinitions populate the Library and are what users pick from in the Field Composer. Both dev-seeded entries and every user-authored entry are FieldDefinitions — there is no other species.
4. **DataField** — an instance of a FieldDefinition, attached to a TreeNode, holding one typed `value`. Snapshots `fieldName` from the FieldDefinition's `label` at creation, so the rare cases of FieldDefinition change don't rewrite user data.

```
FieldComponent (code)
   └── FieldPrototype (in-UI transient: Component + open config form)
         └── FieldDefinition (persisted Library entry: Component + label + config)
               └── DataField (instance on a TreeNode: above + value + parent)
```

The word **Template** is reserved for a future feature: a _set_ of FieldDefinitions bundled as a unit (e.g. "HPU with Accumulator"). Templates are out of scope for the FieldDefinition Library work; nothing in Phase 1 of this surface uses the word "Template" — anywhere it appears today (`templates` table, `DataFieldTemplate`, `TEMPLATE_IDS`, `templateId`) is a legacy artefact to be renamed (see Migration & Naming below).

### Phase 1 FieldComponents

Four FieldComponents, defined per the per-Component specs further down this section:

- `text-kv` — free-form text
- `enum-kv` — selection from a fixed option list
- `measurement-kv` — number with units and optional ranges
- `single-image` — one image attached to a field

Additional FieldComponents (`number-kv`, `date-kv`, `composite-kv`, `image-carousel`, `image-grid`, `image-aggregator`, …) are deferred. [Phase 2+]

### The Library

The Library is the set of all active FieldDefinitions, surfaced to users as the row list inside the **Field Composer**.

#### One global, shared Library

There is exactly **one** Library, shared across all users via Firestore sync. **Authoring is contributing**: every user-authored FieldDefinition becomes visible in every other user's Composer the next time their client syncs. There is no private/public toggle, no per-workspace scope, no opt-in import step, no moderation, no "personal vs. community" tabs in Phase 1. The picker is the discovery surface.

Consequences worth being explicit about:

- A user's authored FieldDefinitions are visible to all other users immediately.
- Two users can independently author entries with the same `label` — both will appear in the Library. Label uniqueness is not enforced. The Composer's live-preview row (rendered with the actual FieldComponent) is the disambiguation affordance. Deduplication / merging is a future concern.
- Once authored and synced, a FieldDefinition cannot be removed by any end user (see Edit / Delete below).

Privacy implication for the user: labels may carry proprietary information (e.g. a specific manufacturer's serial-format field name). Users should know that what they author is shared. Surfacing this expectation in the authoring UI is a UX concern tracked in ISSUES.md, not a SPEC-level toggle.

#### Where the Library lives

- **Local mirror**: Dexie table `fieldDefinitions` on every client.
- **Source of truth**: Firestore collection `fieldDefinitions`, synced bidirectionally via the existing sync infrastructure (Push-then-Pull, LWW on `updatedAt`, queued through `SyncQueueManager`). This is the first user-mutable table beyond `treeNodes` / `dataFields` / `dataFieldHistory`; the adapter contract extends to cover it.
- **Seed entries** (the starter set): written client-side by `seedFieldDefinitions.ts` (renamed from `seedTemplates.ts`) on first run, idempotent via `SEED_VERSION`. Seed writes bypass the sync queue — seeds are identical per client, and syncing them would produce N redundant writes per N clients. Their stable IDs (`fd_description`, `fd_type_of`, …) let the UI reference defaults by constant, not by label.
- **User-authored entries**: enqueue through the sync queue like any other user write; appear on other clients on next pull.

#### Listing in the Composer

The Composer renders **every active FieldDefinition** sorted alphabetically by `label` — one row per entry, no scope filters, no categories, no search box. Phase-1 simplicity: a flat list is fine while the Library is small. Typeahead filtering, `category` grouping, and dropdown-flip behaviour all remain deferred. [Phase 2+]

**Placement of a newly authored entry**: When a user authors a FieldDefinition from inside the Composer, the new row appears **at the position where it was minted** (i.e. wherever the "+ New Field Definition…" affordance was when the user clicked it), pre-checked and ready to receive a value. On the _next_ opening of the Composer the entry takes its normal alphabetical place — this avoids both losing the user's place during the authoring → fill-value flow, and bespoke "recently created" sort logic.

### FieldDefinition Authoring UI

The "+ New Field Definition…" affordance lives **inside the Field Composer**. It is the single Phase-1 entry point for authoring; there is no separate "Library Management" view in Phase 1. (A dedicated Library view will eventually exist as a TreeNode stack under the app's main menu. [Phase 2+])

Clicking the affordance expands an inline authoring form in-place:

1. **Pick FieldComponent** — segmented control with the four Phase-1 choices (`text-kv`, `enum-kv`, `measurement-kv`, `single-image`).
2. **Enter label** — text input, max 50 chars, required (must be non-empty trimmed string).
3. **Component-specific config** — form fields shaped by the chosen FieldComponent (see per-Component specs for the available knobs). Required config (e.g. `enum-kv.options` non-empty, `measurement-kv.units` non-empty) is enforced before Save. Measurement invariants (`absoluteMin ≤ warnLow ≤ nominalMin ≤ nominalMax ≤ warnHigh ≤ absoluteMax`) are validated here — this is the validation gate the SPEC has long promised.
4. **Save** — commits the FieldDefinition (sync-queued for upload with `authorId: <currentUserId>`, currently `"localUser"`), collapses the authoring form, and **immediately materialises a checked Composer row** at the same position, so the user can fill in the value and proceed to the batch Save in one continuous motion.
5. **Cancel** — discards the in-progress authoring form. No FieldDefinition is written. The Composer returns to its prior state.

The authoring form has **its own pending-state shape**: it is _not_ a `pendingForm` from `usePendingForms`, because no DataField exists yet — the FieldDefinition has to commit first before a DataField draft can attach to it. The hook surface for this state is a separate concern; naming TBD during implementation (working name: `useFieldDefinitionDraft`).

### Edit / Delete Semantics for FieldDefinitions

**Phase 1 ships with no user-facing edit or delete of FieldDefinitions.** This is a deliberate simplification, not an oversight — multi-user identity and permissions don't exist yet, so any edit/delete UX is premature.

- **Edit is conceptually "fork"**: any future UI affordance that looks like "edit this FieldDefinition" (whether the change is to label, config, or both) **mints a new FieldDefinition** rather than mutating the existing one. The original is untouched; downstream DataField instances remain bound to it. This sidesteps cascading config changes (e.g. unit changes on a measurement) and avoids the question of which user is authorised to edit a given entry.
- **Delete is admin-only**: end users cannot delete FieldDefinitions — not their own, not others'. Bad or duplicate entries are removed by the dev team directly in Firestore. The `deletedAt` column exists on the entity for forward compatibility (and for the rare admin tombstone), but no client write path sets it in Phase 1. Soft-deleted FieldDefinitions are filtered out of the Composer listing.

Per-user delete UX, ownership-based permissions ("you can delete your own"), config-edit-creates-fork affordances, and label-uniqueness / dedup logic are all deferred to LATER.md and revisited once real multi-user identity lands.

### Default DataFields at Node Creation

Three FieldDefinitions are pre-checked in the Composer when a node is in `isUnderConstruction`:

- **Type Of** (`text-kv`)
- **Description** (`text-kv`, `multiline: true`)
- **Tags** (`text-kv`)

These appear as **locked checked rows** — checkbox visibly checked but disabled — so the user can't uncheck them. They commit as DataFields on node Save regardless of whether a value was entered (empty fields are allowed). Other FieldDefinitions in the Composer are unchecked by default and behave normally.

UI code references these three by stable ID via the `FIELD_DEFINITION_IDS` constant (renamed from `TEMPLATE_IDS`), never by label.

### Migration & Naming (work to do)

The current implementation uses the legacy term "Template" throughout. Renaming is a precondition for the authoring work below; it isolates the diff and stops new code multiplying the old name.

Mechanical renames (one PR, low risk because instance `fieldName` is already snapshotted):

| From                                | To                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DataFieldTemplate` (type)          | `FieldDefinition`                                                                                        |
| `templates` (Dexie table)           | `fieldDefinitions`                                                                                       |
| `fieldDefinitions` (Firestore col.) | (same — first time it exists)                                                                            |
| `templateId` (on `DataField`)       | `fieldDefinitionId`                                                                                      |
| `TEMPLATE_IDS` (const)              | `FIELD_DEFINITION_IDS`                                                                                   |
| `seedTemplates.ts` (file)           | `seedFieldDefinitions.ts`                                                                                |
| `getTemplateQueries` / etc.         | `getFieldDefinitionQueries` / etc.                                                                       |
| `pendingFormFromTemplate`           | `pendingFormFromFieldDefinition`                                                                         |
| `Template` in UI copy               | "Field Definition" or "Library Field" (user-facing wording TBD; keep the _type_ name consistent in code) |

Composer component file names (`FieldComposer.tsx` etc.) stay as they are — "Composer" is correct.

### Implementation order (Phase-1 scope of this work)

1. **Rename** per the table above. Lands in one commit, before anything else.
2. **Add `authorId`** to `FieldDefinition`. Seed writes use `"appDeveloper"`; user-authored writes use `getCurrentUserId()` (currently `"localUser"`). No UI surfaces `authorId` in Phase 1.
3. **Wire `fieldDefinitions` through the sync layer**: `IDBAdapter` push/pull, `FirestoreAdapter` push/pull, `SyncQueueManager` enqueue on user-authored writes, LWW conflict resolution. Seed path remains local-only.
4. **Authoring UI** in Field Composer: "+ New Field Definition…" affordance, inline form per FieldComponent, validation gates, commit → checked-row materialisation.
5. **Defer to end of this work plan**: revisit edit/delete decisions if multi-user identity has landed; otherwise leave as specified above.

### What stays in LATER.md (Phase-2+)

- **Templates** (composite sets of FieldDefinitions, e.g. "HPU with Accumulator") — distinct, larger feature.
- **Composer discovery UX**: typeahead filter, category grouping, popularity ranking, "recently added" sort, dropdown-flip behaviour.
- **Moderation / promotion to canonical** for crowdsourced entries.
- **`componentVersion`** for per-FieldComponent contract versioning — only matters once config schemas evolve.
- **User-facing edit/delete** of FieldDefinitions with real ownership rules.
- **Label uniqueness / dedup / merge** flows.
- **Dedicated Library view** (the "TreeNode stack under the app's main menu").

### Per-FieldComponent specs

#### FieldComponent: `text-kv`

**Purpose**: Free-form text. Current Phase-1 default.

**FieldDefinition config**:

| Field       | Type    | Default | Notes                     |
| ----------- | ------- | ------- | ------------------------- |
| maxLength   | number? | 500     | Hard limit on input       |
| multiline   | boolean | false   | `true` renders a textarea |
| placeholder | string? | —       | Shown when value is empty |

**Instance value**: `string | null`

**Edit UX**: Single-line input (or textarea if `multiline`). Double-tap activates edit. Enter saves, Escape cancels. If `multiline`, Enter inserts newline and Cmd/Ctrl+Enter saves.

**Display UX**: Plain text. Multi-line renders with preserved line breaks.

**Validation**: length ≤ `maxLength`.

#### FieldComponent: `enum-kv`

**Purpose**: Selection from a fixed option list (Status, Condition, Category, …).

**FieldDefinition config**:

| Field      | Type     | Default | Notes                                     |
| ---------- | -------- | ------- | ----------------------------------------- |
| options    | string[] | —       | **Required.** Selectable values.          |
| allowOther | boolean  | false   | If `true`, user may enter an ad-hoc value |
| default    | string?  | —       | Pre-selected on new instance              |

**Instance value**: `string | null` — must match an `options` entry unless `allowOther`.

**Edit UX**: Dropdown. If `allowOther`, final item is "Other…" which reveals a text input.

**Display UX**: Plain text. Option styling (badges, colors) [Phase 2+].

**Validation**: value ∈ `options` (or `allowOther === true`).

#### FieldComponent: `measurement-kv`

**Purpose**: A numeric quantity with semantic units and optional operating ranges (Pressure, Temperature, Current, Flow Rate).

**FieldDefinition config**:

| Field       | Type    | Required | Notes                                              |
| ----------- | ------- | -------- | -------------------------------------------------- |
| units       | string  | Yes      | Canonical unit label (e.g. `"PSI"`, `"°C"`, `"A"`) |
| decimals    | number? | No       | Display precision (default 2)                      |
| nominalMin  | number? | No       | Lower bound of normal operating range              |
| nominalMax  | number? | No       | Upper bound of normal operating range              |
| warnLow     | number? | No       | Below this is a warning state                      |
| warnHigh    | number? | No       | Above this is a warning state                      |
| absoluteMin | number? | No       | Input rejected below this                          |
| absoluteMax | number? | No       | Input rejected above this                          |

**Config invariants** (enforced at FieldDefinition authoring time):
`absoluteMin ≤ warnLow ≤ nominalMin ≤ nominalMax ≤ warnHigh ≤ absoluteMax`. Any subset may be omitted; provided values must satisfy the chain.

**Instance value**: `number | null`. Units are **not** stored per-instance — they come from the FieldDefinition and are fixed for the field's life. Unit conversion [Phase 2+].

**Edit UX**: Numeric input with fixed units label. Helper text summarizes nominal range if configured.

**Display UX**: `{value} {units}` with visual state: **ok** (within nominal), **warn** (outside nominal but within warn range), **alarm** (outside warn range). Subtle background color on value in Phase 1.

**Validation**: within `[absoluteMin, absoluteMax]` if set. Warn/nominal are informational, not blocking.

#### FieldComponent: `single-image`

**Purpose**: One image attached to a field (Asset Main Image, Nameplate Photo, Field Observation).

**FieldDefinition config**:

| Field          | Type    | Default | Notes                                     |
| -------------- | ------- | ------- | ----------------------------------------- |
| maxSizeMB      | number  | 5       | Reject uploads above this size            |
| requireCaption | boolean | false   | Caption shown and required                |
| aspectHint     | string? | —       | e.g. `"4:3"` — display hint, not enforced |

**Instance value**:

```ts
{
  blobId: string;       // key into blob storage
  mimeType: string;     // "image/jpeg" | "image/png" | "image/webp"
  width: number;        // px
  height: number;       // px
  byteSize: number;
  caption?: string;
} | null
```

**Storage**: Blob payload in a separate Dexie table (`imageBlobs`), keyed by `blobId`. DataField stores only the metadata object above. Firestore blob sync [Phase 2+] — Phase 1 images are local-device only.

**Edit UX**: Double-tap → file picker. Preview with "Replace" / "Remove" and (if configured) caption input. Save commits the new blob and writes history.

**Display UX**: Image at container width, respecting `aspectHint` if set. Tap opens full-size modal (no zoom in Phase 1).

**Validation**: MIME in allowed set; `byteSize ≤ maxSizeMB * 1024 * 1024`.

**History**: stores the metadata object (including `blobId`), not the blob bytes. Replacing an image writes history; prior blob retained. Orphaned-blob GC [Phase 2+].

### Seeded FieldDefinitions (starter Library)

Phase 1 ships with a set of dev-seeded FieldDefinitions (`authorId: "appDeveloper"`) so the Library is non-empty on first run. The starter set is small and biased toward fields any asset is likely to have — the user-authoring path is expected to grow the Library from here.

| Label          | componentType  | Notes                                               |
| -------------- | -------------- | --------------------------------------------------- |
| Description    | text-kv        | `multiline: true`                                   |
| Type Of        | text-kv        | User-defined categories                             |
| Tags           | text-kv        | Comma-separated values (structured tags [Phase 2+]) |
| Location       | text-kv        | Physical location                                   |
| Serial Number  | text-kv        | Manufacturer serial                                 |
| Part Number    | text-kv        | Manufacturer part number                            |
| Manufacturer   | text-kv        | Equipment manufacturer                              |
| Model          | text-kv        | Equipment model                                     |
| Status         | enum-kv        | `options: ["In Service", "Maintenance", "Retired"]` |
| Installed Date | text-kv        | ISO date; `date-kv` FieldComponent [Phase 2+]       |
| Weight         | measurement-kv | `units: "kg"`                                       |
| Power Rating   | measurement-kv | `units: "W"`                                        |
| Note           | text-kv        | `multiline: true`                                   |
| Main Image     | single-image   | `requireCaption: false`                             |

The three pre-checked construction defaults (`Type Of`, `Description`, `Tags`) are a subset of this list and are described under "Default DataFields at Node Creation" above.

### Empty State (ROOT View)

- Default welcome message "Create a new asset to get started"
- CreateNodeButton shown (isRoot state)

## Data Model [DONE]

#### TreeNode Entity

**Purpose:** Represents physical assets or logical containers in a hierarchical structure

| Field        | Type          | Required | Description                     | Constraints                                    |
| ------------ | ------------- | -------- | ------------------------------- | ---------------------------------------------- |
| id           | string (UUID) | Yes      | Unique identifier               | Generated client-side and used as canonical ID |
| nodeName     | string        | Yes      | Display name of the asset       | Max 100 chars, required                        |
| nodeSubtitle | string        | No       | Additional description/location | Max 200 chars                                  |
| parentId     | string \      | null     | Yes                             | Reference to parent node                       |
| updatedBy    | string        | Yes      | User ID of last editor          | Valid user ID                                  |
| updatedAt    | timestamp     | Yes      | Last modification time (epoch)  | Client-assigned; server-assigned [Phase 2+]    |
| deletedAt    | timestamp \   | null     | Yes                             | Soft delete timestamp                          |

#### FieldDefinition Entity

**Purpose:** A Library entry: a `componentType` + `config` + `label` that users pick from in the Field Composer. The persisted form of "what kind of field this is."

| Field         | Type              | Required | Description                             | Constraints                                                                          |
| ------------- | ----------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| id            | string (UUID)     | Yes      | Unique identifier                       | Generated client-side; canonical ID. Seeds use stable string IDs (`fd_*`).           |
| componentType | string            | Yes      | Which FieldComponent this entry targets | One of the Phase 1 componentTypes                                                    |
| label         | string            | Yes      | User-facing field name                  | Max 50 chars; **uniqueness not enforced** in Phase 1                                 |
| config        | JSON              | Yes      | FieldComponent-specific config          | Shape discriminated by `componentType` (see per-FieldComponent specs)                |
| authorId      | string            | Yes      | Who created it                          | `"appDeveloper"` for seeds; `getCurrentUserId()` (currently `"localUser"`) otherwise |
| updatedBy     | string            | Yes      | User ID of last editor                  | Valid user ID                                                                        |
| updatedAt     | timestamp         | Yes      | Last modification time (epoch)          | Client-assigned; server-assigned [Phase 2+]                                          |
| deletedAt     | timestamp \| null | Yes      | Soft delete (admin-only in Phase 1)     | No user write path sets this                                                         |

#### DataField Entity

**Purpose:** An instance of a FieldDefinition, attached to a TreeNode, storing one typed value.

| Field             | Type              | Required | Description                                         | Constraints                                                   |
| ----------------- | ----------------- | -------- | --------------------------------------------------- | ------------------------------------------------------------- |
| id                | string (UUID)     | Yes      | Unique identifier                                   | Generated client-side; canonical ID                           |
| fieldDefinitionId | string (UUID)     | Yes      | Reference to `FieldDefinition.id`                   | Must exist in `fieldDefinitions` table                        |
| componentType     | string            | Yes      | Denormalized from FieldDefinition for dispatch      | Must match the referenced FieldDefinition's `componentType`   |
| fieldName         | string            | Yes      | Display label                                       | Snapshot of FieldDefinition `label` at creation; max 50 chars |
| parentNodeId      | string            | Yes      | Parent TreeNode reference                           | Must exist in TreeNode table                                  |
| value             | JSON \| null      | Yes      | Typed value, shape discriminated by `componentType` | See per-FieldComponent value shapes above                     |
| cardOrder         | number            | Yes      | Display ordering within DataCard                    | Auto-assigned on creation                                     |
| updatedBy         | string            | Yes      | User ID of last editor                              | Valid user ID                                                 |
| updatedAt         | timestamp         | Yes      | Last modification time (epoch)                      | Client-assigned; server-assigned [Phase 2+]                   |
| deletedAt         | timestamp \| null | Yes      | Soft delete timestamp                               | —                                                             |

#### DataFieldHistory Entity (typed per componentType; minimal — value changes only; broader property tracking [Phase 2+])

**Purpose:** Immutable append-only audit log of `DataField.value` changes. Typed as a discriminated union over `componentType` so `prevValue` / `newValue` carry the Component's value shape.

**Shared fields**:

| Field         | Type          | Required | Description                          | Constraints                                    |
| ------------- | ------------- | -------- | ------------------------------------ | ---------------------------------------------- |
| id            | string        | Yes      | Primary key                          | Composite key `${dataFieldId}:${rev}`          |
| dataFieldId   | string (UUID) | Yes      | Reference to `DataField.id`          | Must exist in `DataField` table                |
| parentNodeId  | string (UUID) | Yes      | Reference to owning `TreeNode`       | Denormalized for easy queries                  |
| componentType | string        | Yes      | Discriminator                        | Matches `DataField.componentType`              |
| action        | enum          | Yes      | `"create" \                          | "update" \                                     |
| property      | string        | Yes      | Changed property                     | Fixed: `"value"`; other properties [Phase 2+]  |
| updatedBy     | string        | Yes      | Editor identifier                    | Constant "localUser"; real user IDs [Phase 2+] |
| updatedAt     | timestamp     | Yes      | When the change occurred (epoch)     | Client-assigned; server-assigned [Phase 2+]    |
| rev           | number        | Yes      | Monotonic revision per `dataFieldId` | Starts at 0 for create                         |

**Typed value fields** (`prevValue` and `newValue` shapes, by `componentType`):

| componentType    | prevValue / newValue shape                                  |
| ---------------- | ----------------------------------------------------------- |
| `text-kv`        | `string \                                                   |
| `enum-kv`        | `string \                                                   |
| `measurement-kv` | `number \                                                   |
| `single-image`   | `{ blobId, mimeType, width, height, byteSize, caption? } \  |

Reversion and audit are central to the app, so the history record must preserve the Component-typed value exactly as stored on the DataField at that revision.

**Indexes**:

- treeNodes: by parentId, by updatedAt
- fieldDefinitions: by componentType, by updatedAt, by authorId
- dataFields: by parentNodeId, by updatedAt, by fieldDefinitionId
- dataFieldHistory: by dataFieldId, by updatedAt
- imageBlobs: by blobId (primary)

**Entity Relationships**:

- TreeNode has 0..1 parent TreeNode (self-referential)
- TreeNode has 0..n child TreeNodes
- TreeNode has 0..n DataFields
- DataField belongs to exactly 1 TreeNode
- DataField references exactly 1 FieldDefinition
- FieldDefinition has 0..n DataFields (one-to-many)
- `single-image` DataField references exactly 1 `imageBlobs` row per non-null value

**Sorting policy**:

- Children within a parent are displayed sorted by `updatedAt` ascending.
- DataFields within a DataCard are displayed sorted by `cardOrder` ascending. New fields are auto-assigned the next available `cardOrder` on creation. Users can reorder fields manually (see DataField Reordering below).

**TreeNode Rules**:

- Root nodes must have parentId = null
- Node names don't need to be unique

**DataField Rules**:

- All values are stored as strings (parsing/validation in UI)
- Metadata field `updatedAt` auto-updates on changes (client-assigned; server-assigned [Phase 2+])

**Data Persistence**:

- **Storage Abstraction**: [DONE] Storage operations are abstracted through a backend-agnostic interface, enabling the system to work with different storage backends (local browser storage for offline-first, cloud storage for sync) without requiring component changes. This abstraction allows swapping storage implementations as needed.
- **Stores**: `treeNodes`, `dataFields`, `dataFieldHistory`, `fieldDefinitions` (renamed from `templates`; sync wiring per FieldDefinition Library spec)
- **Primary Storage**: [DONE] Local browser storage for offline-first capability. All operations persist locally first.
- **Cloud Sync**: [DONE] Bidirectional sync with cloud storage when online. The system orchestrates push (local→remote) and pull (remote→local) operations. Conflict resolution uses Last-Write-Wins (LWW) based on `updatedAt` timestamps.
- **Sync Triggers**: [DONE] Automatic sync on startup (if online), periodic timer (every 10 minutes), and on network 'online' event. Manual sync available via dev tools.
- **Single-user environment**: [DONE] Uses constant `updatedBy` "localUser". Only `value` changes are logged, not `fieldName`/`componentType`/`fieldDefinitionId` changes. [Phase 2+]: real user identity, broader property change logging.

## Storage Architecture [DONE]

### Storage Abstraction

Storage operations are abstracted through a backend-agnostic interface, enabling the system to work with different storage backends without requiring component changes. The application layer depends on domain service interfaces rather than concrete storage implementations, allowing storage backends to be swapped (e.g., local browser storage for offline-first, cloud storage for sync, in-memory for testing) without modifying application code.

### Sync Strategy

- **Bidirectional Sync**: Local changes push to remote; remote changes pull to local
- **Push-First**: Local changes are pushed before pulling remote changes
- **Conflict Resolution**: Last-Write-Wins (LWW) based on `updatedAt` timestamps. Server timestamps are authoritative when available. [Phase 2+]: server-assigned timestamps.
- **Sync Strategies**:
  - Full Collection Sync: Pulls all entities (used on startup)
  - Delta Sync: Pulls only changes since last sync (faster, used periodically)
- **Sync Queue**: Local changes are enqueued and processed sequentially. Failed items are marked for retry.

### Soft Deletion [DONE]

Both `TreeNode` and `DataField` support soft deletion via `deletedAt` timestamps:

- Active entities have `deletedAt: null`
- Deleted entities have `deletedAt: <timestamp>`
- Queries filter out soft-deleted entities by default
- Children of soft-deleted nodes are implicitly hidden (not cascade soft-deleted)
- Restoration: see Snackbar & Undo for the 5s undo window; beyond that, restore is currently cloud-db-only. [Phase 2+]: in-app restore UI (a dedicated TreeNode view for browsing and restoring deleted items).

#### TreeNode Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "nodeName": "Main HVAC Unit",
  "nodeSubtitle": "Building A Primary Cooling System",
  "parentId": null,
  "updatedBy": "user456",
  "updatedAt": 1709942400000,
  "deletedAt": null
}
```

#### DataField Examples

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440004",
    "fieldDefinitionId": "fd_serial_number",
    "componentType": "text-kv",
    "fieldName": "Serial Number",
    "parentNodeId": "550e8400-e29b-41d4-a716-446655440001",
    "value": "HVAC-2024-001",
    "cardOrder": 0,
    "updatedBy": "user123",
    "updatedAt": 1709856000000,
    "deletedAt": null
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440005",
    "fieldDefinitionId": "fd_status",
    "componentType": "enum-kv",
    "fieldName": "Status",
    "parentNodeId": "550e8400-e29b-41d4-a716-446655440001",
    "value": "In Service",
    "cardOrder": 1,
    "updatedBy": "user456",
    "updatedAt": 1709942400000,
    "deletedAt": null
  }
]
```

#### DataFieldHistory Example (for a single field)

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440004:0",
    "dataFieldId": "660e8400-e29b-41d4-a716-446655440004",
    "parentNodeId": "550e8400-e29b-41d4-a716-446655440001",
    "componentType": "text-kv",
    "action": "create",
    "property": "value",
    "prevValue": null,
    "newValue": "HVAC-2024-001",
    "updatedBy": "localUser",
    "updatedAt": 1709856000000,
    "rev": 0
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440004:1",
    "dataFieldId": "660e8400-e29b-41d4-a716-446655440004",
    "parentNodeId": "550e8400-e29b-41d4-a716-446655440001",
    "componentType": "text-kv",
    "action": "update",
    "property": "value",
    "prevValue": "HVAC-2024-001",
    "newValue": "HVAC-2025-002",
    "updatedBy": "localUser",
    "updatedAt": 1709942400000,
    "rev": 1
  }
]
```

## Styling Design

Wireframe reference: [ROOT View wireframe](assets/root-view-wireframe.html) (open in browser to preview).

### Style Guide [DONE]

**Visual identity: deliberately "unstyled."** The app should look like a well-structured document, not a themed product UI. Black borders, minimal colour, no rounded cards, no gradients, no drop shadows on primary elements. The visual hierarchy comes from typography weight, indentation, and whitespace — not from decorative styling. This makes the information itself the foreground, which suits a data-heavy maintenance tool.

**What "unstyled" means in practice:**

- Borders are solid black (`--border-default`), uniform weight (`--border-width: 1.5px`)
- Backgrounds are white or near-white; colour is reserved for interactive affordances (accent blue for focus/links, red for destructive actions, yellow for preview state)
- Typography is a single family (Inter) at a compact size scale (9–18px), with weight doing the work of visual hierarchy (bold titles, regular body)
- Interactive elements are stripped to bare structure: `.btn-reset` and `.input-reset` remove all browser chrome; inline editing uses a minimal underline, not a boxed input
- Animations are fast and functional (100–150ms), not decorative

**Three-layer design token system** (`src/styles/tokens.css`):

1. **Primitives** — raw palette values (`--color-gray-600: #666`)
2. **Semantic tokens** — purpose-mapped references (`--text-muted: var(--color-gray-600)`)
3. **Component tokens** — local overrides in CSS modules, referencing semantic tokens

Components never reference primitives directly. This makes the unstyled look a deliberate choice rather than an absence — the system is ready for theming by overriding the semantic layer.

**[Phase 2+]**: Per-user and per-org style configuration (colour scheme, font size, contrast/accessibility preferences) via semantic token overrides. The three-layer architecture was designed with this in mind.
