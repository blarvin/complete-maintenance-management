# Asset Tree Management Specification

## Overview

Asset maintenance and management app for physical assets (vehicles, buildings, industrial machinery, etc.) using a recursive tree structure where nodes represent things and their parts.

Unlike common tree view UIs where each node only has a name, this app has four levels of knowledge structure:

- Level I: Nodes represent things and their constituent parts. The structure, parent and child hierarchical relationships ARE the first level of information.
- Level II: Data pertaining directly to one Node; facts, attributes, properties, characteristics, etc. of the Node itself. Each Node has one Data Card containing any number of Data Fields (facts about that thing). The Node's own Title and Subtitle are on this level conceptually, but reside above the Data Card in a Node Header.
- Level III: Each Data Field has a Field Details section containing context (e.g., metadata) and management actions (e.g., delete).
- Level IV: Most Data Fields have a user‑facing history of previous Field values or changes.
- Level V: The fifth level of knowledge presentation/interaction is the "meta" level: Help, App Training, App Feedback. These are fully contextualized at every point, every UI affordance, within the tree view. UI intention is a seperate layer of "i" icons, which may be hidden. [Phase 2+]

This structure enables users to construct, explore, and understand detailed hierarchical models of real world assets.

## Concepts & Vocabulary

This spec speaks in two registers, and keeping them distinct is the whole game. The user navigates **surfaces**; the system stores one primitive, the `Element`, drawn by the **manifest** its `kind` selects. The boundary between the two registers is **declared once, here** — after which every other section may use either word set unambiguously. Two surfaces — **Node** and **Field** — are *primary*: they carry the entire experience. At the storage layer they are not two systems but two regions of one spectrum of kinds (see **One substrate, a spectrum of kinds** below).

**Surfaces** — what the user sees; what we say in intent and UI copy. Stable pattern language; the set grows as the product does.


| Surface                                                  | What it is to the user                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node**                                                 | A navigable thing in the tree — an asset or a logical container. Has a Header (Title + Subtitle) and one Data Card. Has two view states, isParent and isChild. In isChild state its Data Card can be expanded and all Fields interacted. In isParent state its children also appear in isChild state. |
| **Data Card**                                            | The body of a Node: the list of its Fields. Some Fields and properties properly belonging to Node may also appear on other surfaces, particularly a Node's Header which is just a visual sectioning.                                                                                                  |
| **Field**                                                | One fact on a Card — a `Label : Value` row, or a more comoprehensive display of data or facts directly associated with the Node, such as an image carousel or chart of values.                                                                                                                        |
| **Field Details**                                        | A Field's metadata (context) and management actions.                                                                                                                                                                                                                                                  |
| **Field History**                                        | A Field's append-only value audit.                                                                                                                                                                                                                                                                    |
| *(future)* **Job, Logbook, Log Entry, Setting, Person…** | New surfaces, added as the product grows — each introduced as a new **kind** composing the six capabilities (see *One substrate, a spectrum of kinds*), never as a free-standing primitive beside them.                                                                                                         |


**Storage & runtime** — what the system actually keeps and runs.


| Term                | What it is to the system                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Element**         | The single recursive record. *Every surface above is an Element.*                                                                                                                        |
| **kind**            | The immutable field on an Element that dispatches into the registry (`node`, `text-kv`, `number-kv`, `job`, `value-chart`…). The *only* hard discriminant in the system.                 |
| **manifest**        | The module-level record, keyed by `kind`, holding all of that kind's behaviour — capability subset, descriptors, and `Renderer`. Looked up at runtime; **never stored on an Element.**   |
| **capability**      | One of the six composable behaviours (OwnValue, Children, Edges, Derivation, Action, Reads) a manifest draws from. A kind is the origin displaced by a capability subset.                |
| **placement**       | A manifest field: where a kind draws its surface — `inline` (a Field-like row on a Data Card) or `re-root` (a Node-like navigable view). Placement, not a separate table, separates node-like from field-like. |
| **Renderer**        | Code that draws an Element for a surface, selected by `placement`. **New surfaces ship as new manifests, not new tables.**                                                              |
| **FieldDefinition** | A Library entry: a field-like Element of the kind it defines, living in the `library` tree, whose config is its child sub-field Elements. Instances bind to it by `definitionId`.                                                                                                            |


**The bridge, in one sentence:** *every surface is one Element drawn by the renderer its `kind`'s manifest supplies — the user navigates surfaces; the system stores Elements and looks up behaviour by `kind`.*

**Naming discipline:**

- Intent/PRD prose and UI copy use **surface** words (Node, Field, Card).
- Data-model and runtime prose use **storage** words (Element, kind, renderer).
- `TreeNode`, `DataCard`, `DataField`, `DataFieldDetails` survive as **component (renderer) identifiers in code — not storage entities.** The only storage entity is the `Element` (with its append-only `ElementHistory`); a FieldDefinition is just an Element in the `library` tree.

### One substrate, a spectrum of kinds

The `Element` primitive is a uniformity for storage, history, and sync — not something the user ever meets generically. Every Element has a single immutable `kind`, and every kind — node-like or field-like — is composed from **one** closed capability vocabulary (see *Data Model*). Node-like and field-like are **not two systems**; they are two regions of one composition space, distinguished by `placement` (`re-root` vs `inline`) plus capability emphasis.

At the **surface** layer, the user meets two primary surfaces:

- **Node** (rendered as a **TreeNode**) — a thing, or one of its constituent parts. A Node has identity (Title + Subtitle), nests into other Nodes, and is *navigated into*. **Nodes are the Tree.** `node` is a kind in the registry like any other (`{Children(open)}`); its recursion and navigation are owned by the **shell**, not by a kind privilege. There is no privileged *kind* — only a privileged *shell* and *root position* (`parentId: null`).
- **Field** (rendered as a **DataField**) — a single unit of recorded knowledge attached to a Node: a typed `Label : Value` (and richer surfaces — galleries, charts, links) with its own Details and History. A Field does *not* nest into the Tree; it lives on its Node's Data Card and is *edited in place*. The set of field kinds is open and extensible — each supplied by a manifest.

So `Element.kind` is `node` or any other kind; "Field-like" is the inline region of the spectrum, "Node-like" the re-root region. The kinds are where the system is *meant* to grow: future surfaces (Job, Logbook, Setting, …) enter as new kinds composing the same six capabilities — never as primitives standing beside the Element model. The full catalogue of kinds lives in **ELEMENT-MODEL.md**.

**Design invariant — keep it Tree-, Node-, and Field-shaped.** The unified `Element` model makes it *cheap* to add surfaces; this invariant keeps that cheapness from dissolving the product into a featureless soup. A new kind must **earn the registry** by composing non-trivial behaviour from the six capabilities (see *Data Model → Earning a kind*); a behaviour-free domain label is a soft `typeOf` tag, not a kind. Before adding any kind, ask: *what does it compose that the existing vocabulary can't already express?* If the answer is "nothing," it is a tag or a renderer, not a new kind. Variety is welcome; new primitives are not.

## Core Principles

- **Recursive Tree Structure**: Every node is much the same as any other and can have any number of child nodes.
- **Self Similarity**: A single node-renderer (the `TreeNode` component) draws every Node at every depth — and the same self-similarity spans the whole spectrum: one `Element` model underlies node-like and field-like alike, each drawn by the renderer its `kind`'s manifest supplies (see Concepts & Vocabulary). New surfaces (Jobs, Logbook, …) are new manifests over that one model, not new data models.
- **Self-Construction**: Users are fully enabled to create and edit assets, structure, and attributes.
- **All-Editable**: Everything is edited, changed, added by Users (except metadata).
- **Modeless In-Situ Editing**: Edit without leaving the tree view or entering edit modes
- **Mobile-First**: Vertical scrolling, single/double-tap interactions
- **Offline-First**: Full UI and any data created locally or already loaded is available indefinitely. All operations persist to local storage first, then sync to cloud when online. No difference in UX online or offline. Seamless automatic background sync, update, and reconcile via bidirectional sync with Last-Write-Wins conflict resolution.

## Component Architecture

***Intent:*** *the whole app is a single scrollable tree the user reads, builds, and edits in place — no separate pages, modes, or forms to get lost in.*

### Views

- **ROOT View**: Listview of top-level TreeNodes (each in isRoot state) + "Create New Asset" button at the bottom.
- **BRANCH View**: One parent TreeNode (isParent state) at top, followed by indented children below. Children are visually indented by `--child-indent`.

### Core component hierarchy

- **TreeNode**: Main component with NodeTitle, NodeSubtitle, DataCard, CardExpandButton. Should appear as a horizontal row with two nested rows (NodeTitle and NodeSubtitle components), optimized for vertical scrolling lists.
- **NodeTitle**: Displays the current node's `nodeName` (bold).
- **NodeSubtitle**: Simple description or location string
- **DataCard**: Every TreeNode has exactly one DataCard. Contains DataFields (user values) + "Add New Field" button + node metadata section. Expands/collapses with an animated slide-down, triggered by a chevron button on the TreeNode body to the right of NodeSubtitle. Animation must be content-aware (no fixed heights). See IMPLEMENTATION.md → DataCard Animation for technique.
- **DataField**: Row item with Label:Value pairs, which users add to a node. Most values can be edited afterwards with a simple double-tap interaction. When isEditing=true, the Value is replaced with an input field (Label remains static). No separate input sub-component needed.
- **DataFieldDetails**: Expandable section (simple chevron) with Field Value history, edit history, creation details, etc., and a delete feature for the Data Field.
- **CreateDataFieldButton**: Button at the bottom of the DataCard to create a new Data Field for the node on its DataCard.
- **UpButton**: On the left end of isParent nodes (node at top of BRANCH view). Navigates up the tree using parentId to find the parent node. If parentId is null, navigates to ROOT view.
- **CreateNodeButton**: Create new TreeNodes. One component with contextual variants for ROOT and BRANCH views.
- **TreeNodeDetails**: Expandable section (simple chevron and label "Tree Node Details") containing details, actions, and settings pertaining to the whole TreeNode. DELETE button only for now; Rename and Move [Phase 2+].
- **Snackbar**: Global transient notification toast. See Snackbar & Undo section below for full spec.

## TreeNode States

- **isRoot**: Top-level nodes on ROOT view. Full width, no children shown, no "Up" button, abbreviated DataCard (first 6 DataFields by updatedAt, or all if fewer than 6). All TreeNodes are in this state at ROOT view.
- **isParent**: Current node being viewed at top of BRANCH view. Full width, children shown below, "Up" button, full DataCard. One TreeNode is in this state at top of BRANCH view.
- **isChild**: Child nodes under current parent. Narrower (indented) on the left, no children shown, full DataCard. Any number of first-child TreeNodes appear in this state below the current isParent instance in the BRANCH view.
- **isUnderConstruction**: New node requiring setup with in-situ fillable Name and Subtitle fields. Replaces CreateNodeButton button in-place as either isRoot or isChild. The isUnderConstruction node's DataCard state is also set to isUnderConstruction.

## DataCard States

- **isExpanded**: DataCard is open/closed. Persisted to local storage.
- **isUnderConstruction**: Default Data Field values are active for entry in-situ (though not required). TreeNodeDetails not shown. CreateDataFieldButton in last row and functions as normal. "Save" and "Cancel" buttons at the bottom.

## DataField States

- **isMetadataExpanded**: Field Details area is expanded/collapsed. Persisted to local storage.
- **isEditing**: Data Field is active for editing (active input field). Not persisted - component-local state only.

## CreateNodeButton Contextual Variants

- **root** (ROOT view): Large button styled to mimic a ROOT node at the bottom of ROOT view. Aria-label/title: "Create New Asset".
- **child** (BRANCH view): Small inline buttons aligned with the children indent gutter. For n child nodes, render n+1 buttons (between, above, below child nodes). Aria-label/title: "Create New Sub‑Asset Here". Clicking creates a `TreeNode` in isChild state and inserts it at the button's position.
- **State on Create** New node appears in `isUnderConstruction` state with in‑situ Name and Subtitle fields.

### State Transitions (use finite state machine pattern)

- isRoot → isParent (navigate to BRANCH VIEW)
- isChild → isParent (navigate deeper)
- isParent → isRoot (navigate to home using "Up" button)
- isUnderConstruction → isRoot or isChild (new node created in-situ where button clicked)

## User Experience pathways

### Navigation Logic ... handled client-side without URL changes

- **Down-tree**: Move down the tree by tapping any child node. Takes user to isParent state for that node.
- **Up-tree**: The "Up" button navigates to current node's parent's isParent state, or to ROOT view if no parent.

### Node Creation

- **Create Node**: CreateNodeButton Creates a new TreeNode in isUnderConstruction state, as a child of the current parent (including ROOT). On the BRANCH view, multiple child variant instances appear between the isChild instances of TreeNode.
- **Node Construction UI/UX**: In isUnderConstruction state, user must enter "Name" (nodeName) and "Subtitle" (nodeSubtitle) in their respective places on the TreeNode. Name is required; empty names are not allowed.
- **Add DataFields at Node creation**: In isUnderConstruction state, the `DataCard.isUnderConstruction` contains the default DataFields, with DataFieldValue ready for user entry, but may be left blank.
- **Actions**: "Create"/"Cancel" buttons to finalize or abort the creation of the new TreeNode.

### Node Deletion

- **Delete Tree Node**: Button available in TreeNodeDetails section of DataCard.
- Deleting any `TreeNode` performs a **soft delete**: sets `deletedAt` timestamp on the node. Children are implicitly hidden (not cascade soft-deleted) — queries filter out children of soft-deleted parents.
- During deletion, no new `DataFieldHistory` entries are written; manual per‑field deletes do write a `delete` history entry (see DataField Management).
- Root (tree) deletion uses the same soft delete mechanism.
- Confirmation dialog summarizing counts (nodes, fields) before proceeding. Snackbar with Undo follows (see Snackbar & Undo).

## DataField Management

***Intent:*** *facts about a thing are captured and corrected right where they sit, and every change is kept — so the record can always be trusted and walked back.*

- **Double-Tap to edit**: Double-tap on a DataField row (Label or Value) to edit the Value. The Value becomes an active input field. Save by double-tapping again. Cancel by tapping outside. If another DataField is already editing, it is cancelled. Save confirmation shown via Snackbar (see Snackbar & Undo).
- **Create Data Fields**: Two surfaces sit at the bottom of the DataCard in display mode. A legacy **+ Add Field** (singular) dropdown is the quick-add path — pick one FieldDefinition, the DataField is created immediately. A **+ Add Fields** (plural) button expands the **Field Composer** alongside it for batch-add and FieldDefinition authoring: an inline section showing every available FieldDefinition as a row in a single list, each with a checkbox; checking a row replaces the label-only row in-place with a live editable preview of that Definition (rendered with its real kind manifest). Save commits every checked row as a real DataField on the node; Cancel discards them. The Composer also hosts the "+ New Field Definition…" authoring affordance. See "Field Composer" and "DataField Components, Field Definitions, and Library" below.
- **Delete Data Field**: Expand the DataFieldDetails to see a "Delete" button at the bottom of the section. Snackbar with Undo follows (see Snackbar & Undo).
  - **Soft Delete**: DataField deletion sets `deletedAt` timestamp. The field is filtered from normal UI queries but can be restored. DataFieldHistory entries remain linked but are implicitly hidden when the field is soft-deleted.
  - A `DataFieldHistory` entry with `action: "delete"`, `property: "value"`, and `newValue: null` is written only after the undo window elapses.

## Snackbar & Undo

***Intent:*** *a destructive tap is reversible for a few seconds, so no one has to hesitate before acting.*

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
    handler: () => void | Promise<void>;
  };
  onExpire?: () => void | Promise<void>; // runs if the toast auto-dismisses WITHOUT the action being invoked; used for deferred-write tails (see Undo semantics)
}
```

- Access via `getSnackbarService()`; call at handler time, not at component setup (same rule as other services).
- State is held in a store object inside the service. The app renders exactly one `<SnackbarHost>` near the app root, which registers a signal-backed accessor object as that store — so the service's plain property assignments stay reactive without the service knowing about the framework.
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

- **BranchView**: Shows "Loading..." while the parent node and children are fetched from storage.
- **RootView**: Should show an equivalent loading indicator while root nodes load. Currently renders empty until data arrives (see ISSUES.md).
- **DataFieldHistory**: History entries load on expand; the component renders once data is available.

### Error states

Storage operations can fail (IndexedDB quota, corrupt data, Firestore unavailable). Error handling is currently minimal:

- `StorageError` contract normalises adapter failures with typed codes (`not-found`, `validation`, `conflict`, `unauthorized`, `unavailable`, `internal`) and a `retryable` flag.
- User-facing error feedback will use the Snackbar to surface brief error messages when storage operations fail. The `StorageError.describeForUser()` helper provides Snackbar-friendly messages.
- No retry UI or explicit error/retry states in components — Firestore's offline persistence and IndexedDB reliability absorb most failures in practice.

### Sync feedback

The sync system operates silently in the background. There is no user-facing indication of sync status, online/offline state, or data staleness. [Phase 2+]: consider a subtle status indicator (e.g. offline badge, last-synced timestamp).

## Keyboard & Accessibility

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

Users can reorder DataFields within a DataCard. Reordering updates `siblingOrder` for all affected fields and persists immediately. Detailed UX/interaction design TBD.

## Field Composer

***Intent:*** *adding facts to a thing is fast, and the vocabulary of facts grows from what users actually need — captured first, tidied later, never gatekept.*

The Field Composer is a unified inline UI for adding one or more DataFields to a TreeNode. It replaces the bare default-fields list in construction mode and adds a batch-add + authoring surface in display mode. In display mode the single-pick **+ Add Field** dropdown is intentionally **kept alongside** the Composer — the two coexist as a deliberate experiment comparing fast single-add against the richer Composer flow, with the keep-or-drop decision left open. (This is an experiment, not committed design; it does not contradict the "collapse parallel paths" rationale below, which is about unifying the construction- and display-mode *draft* flows inside the Composer.) The Composer is also the **single Phase-1 entry point for FieldDefinition authoring** (see FieldDefinition Authoring UI below).

#### When the composer is visible

- **Display mode** (existing node, viewing its DataCard): the single-pick **+ Add Field** dropdown handles quick adds; a separate **+ Add Fields** (plural) button opens the inline Composer for batch-add and FieldDefinition authoring. The two are kept side by side as a deliberate experiment (not vestigial — see above), pending a decision on whether the quick-add path earns its keep. Composer Save or Cancel dismisses it. Only one of the two surfaces is active at a time — opening one closes the other.
- **Construction mode** (new node, before Save): the composer is visible by default. The seeded default FieldDefinitions ("Type Of", "Description", "Tags") appear as **locked checked rows** — checkbox visibly checked but disabled, so the user can't uncheck them. The user can still check additional FieldDefinitions as normal.

#### Layout

The composer is a single inline-expanded section within the DataCard, distinguished from persisted fields by a **dashed border** around the whole zone. It contains:

1. **In-situ FieldDefinition list** — every active FieldDefinition appears as a row, sorted alphabetically by label. Each row has a checkbox. A **"+ New Field Definition…"** affordance appears as the first row, expanding inline into the authoring form (see FieldDefinition Authoring UI).
  - **Unchecked row**: checkbox + FieldDefinition label only.
  - **Checked row**: checkbox + a live, editable preview of that Definition, rendered with its actual kind manifest renderer (TextKvField, EnumKvField, NumberKvField, ImageField). Toggling the checkbox replaces the row in-place — checking expands the row into the full manifest preview; unchecking collapses it back to label-only.
  - **Locked checked row** (construction mode defaults only): rendered as a checked row, but the checkbox is disabled.
  - The preview is fully editable: the user can set the value, etc. Nothing is persisted to storage until **Save**.
  - Rows transition smoothly (~200ms) on toggle. On check, the *checkbox* is anchored in the viewport so a tall preview (an `image` especially) doesn't shove the user's place off-screen.
  - (Grouping rows by `category` into collapsible sections is [Phase 2+], deferred until FieldDefinition count makes a flat list unwieldy.)
2. **Sticky Save / Cancel footer** — pinned to the bottom of the viewport while the composer is in view, so a long list doesn't bury the actions. Save disabled (display mode) when no rows are checked.

#### Interactions

- **Existing persisted fields remain visible and editable** above the composer. Edits to existing fields commit immediately as today; edits inside the composer are pending until Save.
- **Save** persists every checked row as a `DataField` (executing `ADD_FIELD_FROM_DEFINITION` per row), in **alphabetical order** (matching the visual order in the composer), with each new field assigned a `siblingOrder` greater than every already-persisted field on the card. New fields appear at the bottom of the FieldList in the same order they previewed in. After Save, the composer collapses.
- **Cancel** discards every pending row. If any rows had been checked, a Snackbar with Undo follows (`"N fields discarded"` — Undo re-opens the composer with the same rows checked and the same entered values).
- **Click-away does not dismiss the composer.** Pending work is preserved across in-app navigation; the composer is dismissed only by Save or Cancel. (Pending state across reload is best-effort via existing localStorage scaffolding.)
- **Construction mode**: Save here is implicit in node creation. The node's "Save" button finalises the node *and* the composer's batch in one transaction. Cancel discards the in-progress node entirely, as today.
- **No reorder of pending rows** in this round. Commit order is alphabetical. Reorder of fields (pending and persisted) is designed together as a future task.

#### Why one composer for both modes

Construction-mode "pending forms" and display-mode "newly-added field draft" are the same shape: a set of pending DataField drafts attached to a node, batch-committed on finalize. Unifying them collapses two parallel UI paths into one and removes the awkward "single-row picker" intermediate state.

#### Composer rows pending vs. FieldDefinition authoring

The two pending-state shapes inside the Composer are distinct:

- **Pending DataField draft** (`pendingForm` in `usePendingForms`) — a checked row holds an in-progress *value* for an existing FieldDefinition. Committed by Save → writes a `DataField`.
- **Pending FieldDefinition draft** — the "+ New Field Definition…" form holds an in-progress *Definition* (kind, label, config sub-fields). Committed by Save → writes a Library-tree Definition Element (and its config subtree), then *immediately* spawns a pre-checked pending DataField draft for it at the same row position.

These are deliberately separate hooks/states because a DataField cannot exist without a FieldDefinition to anchor it.

## DataField Components and Crowdsourced Library

***Intent:*** *the kinds of fact the app understands are grown by the people using it, not rationed by developers or managers.*

### Conceptual hierarchy

Three layers — each is the precondition for the next:

1. **kind manifest** — dev-authored code: a `Renderer` + capability subset + descriptors, keyed by `kind` (e.g. `"text-kv"`, `"number-kv"`) in the registry. The closed set is owned by the dev team; users cannot author kinds (see *Data Model → Earning a kind*).
2. **FieldDefinition** — a Library entry: a field-like Element of the kind it defines, living in the `library` tree, whose **config is its child sub-field Elements** (units, thresholds, flags — not a config blob). Definitions are what users pick from in the Field Composer. Both dev-seeded and user-authored entries are Library-tree Elements — there is no other species.
3. **DataField** (instance) — an Element minted from a Definition, attached to a Node, holding one typed `value` and bound to its Definition by `definitionId`. It **copies** its meaning-defining config (owned sub-fields: units, thresholds) at mint and **delegates** the rest (read live from the Definition); `name` is snapshotted at creation, so a forked Definition never rewrites user data.

```
kind manifest (code: Renderer + capabilities + descriptors)
  └── FieldDefinition (library-tree Element; config = child sub-field Elements)
       └── DataField instance (Element on a Node: + value + definitionId binding)
```

The word **Template** is reserved for a future feature: a *set* of Definitions bundled as a unit (e.g. "HPU with Accumulator"). Templates are out of scope for the Library work, and nothing in Phase 1 uses the word "Template".

### Phase 1 field kinds

Four field-like kinds, specced in **ELEMENT-MODEL.md → Field-like kinds**:

- `text-kv` — free-form text
- `enum-kv` — selection from a fixed option list
- `number-kv` — number with units, display format, nominal value or range, alarm thresholds, and freshness expectation
- `image` — one image attached to a field (`image-with-caption` adds a caption sub-field)

Additional field kinds (`date-kv`, `composite-kv`, `image-carousel`, `image-grid`, `asset-gallery`, …) are catalogued in ELEMENT-MODEL.md; build is deferred. [Phase 2+]

### The Library

The Library is the set of all active FieldDefinitions, surfaced to users as the row list inside the **Field Composer**.

#### One global, shared Library

There is exactly **one** Library — the `library` typed tree (see *Data Model → Populations are typed trees*) — shared across all users via sync. **Authoring is contributing**: every user-authored Definition becomes visible in every other user's Composer the next time their client syncs. There is no private/public toggle, no per-workspace scope, no opt-in import step, no moderation, no "personal vs. community" tabs in Phase 1. The picker is the discovery surface.

Consequences worth being explicit about:

- A user's authored Definitions are visible to all other users immediately.
- Two users can independently author entries with the same `name` — both will appear in the Library. Label uniqueness is not enforced. The Composer's live-preview row (rendered with the actual kind manifest) is the disambiguation affordance. Deduplication / merging is a future concern.
- Once authored and synced, a Definition cannot be removed by any end user (see Edit / Delete below).

Privacy implication for the user: labels may carry proprietary information (e.g. a specific manufacturer's serial-format field name). Users should know that what they author is shared. Surfacing this expectation in the authoring UI is a UX concern tracked in ISSUES.md, not a SPEC-level toggle.

#### Where the Library lives

- **A typed tree, not a side table**: a Definition is an `Element` (with `treeType: library`) and its config is its child sub-field Elements; it syncs, history-tracks, and reverts like any other Element. (Landed 2026-06-27 — config-as-Elements; the old separate `fieldDefinitions` Dexie table was dropped in schema v10.)
- **Sync**: Library Elements ride the same bidirectional sync as the business tree (Push-then-Pull, LWW on `updatedAt`, queued through `SyncQueueManager`), routed by `treeType` for history/visibility.
- **Seed entries** (the starter set): written client-side on first run, idempotent via a seed version. Seed writes bypass the sync queue — seeds are identical per client, and syncing them would produce N redundant writes per N clients. Their stable deterministic ids let the UI reference defaults by constant (`DEFINITION_IDS`), not by label.
- **User-authored entries**: enqueue through the sync queue like any other user write; appear on other clients on next pull.

#### Listing in the Composer

The Composer renders **every active FieldDefinition** sorted alphabetically by `label` — one row per entry, no scope filters, no categories, no search box. Phase-1 simplicity: a flat list is fine while the Library is small. Typeahead filtering, `category` grouping, and dropdown-flip behaviour all remain deferred. [Phase 2+]

**Placement of a newly authored entry**: When a user authors a FieldDefinition from inside the Composer, the new row appears **at the position where it was minted** (i.e. wherever the "+ New Field Definition…" affordance was when the user clicked it, at the top of the Composer's pick list for now), pre-checked and ready to receive a value. On the *next* opening of the Composer the entry takes its normal alphabetical place — this avoids both losing the user's place during the authoring → fill-value flow, and bespoke "recently created" sort logic.

### FieldDefinition Authoring UI

The "+ New Field Definition…" affordance lives **inside the Field Composer**. It is the single Phase-1 entry point for authoring; there is no separate "Library Management" view in Phase 1. (A dedicated Library view will eventually exist as a TreeNode stack under the app's main menu. [Phase 2+])

Clicking the affordance expands an inline authoring form in-place:

1. **Pick kind** — segmented control with the four Phase-1 field choices (`text-kv`, `enum-kv`, `number-kv`, `image`).
2. **Enter label** — text input, max 50 chars, required (must be non-empty trimmed string); becomes the Definition Element's `name`.
3. **Config sub-fields** — the kind's config schema is its manifest `ChildrenSpec` over config sub-field kinds (template core + open tail); authoring fills those sub-field Elements (see *Data Model → Config is Elements*, and ELEMENT-MODEL.md for each kind's config). Required config (e.g. `enum-kv.options` non-empty, `number-kv` units) is enforced before Save. `number-kv` threshold invariants (`LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` in range mode; the equivalent chain across `(nominalValue ± tolerance)` in discrete mode) are validated here. The generic Treeview is the default authoring UI; a per-kind `ConfigForm` is an optional override for cross-field invariants / progressive disclosure (e.g. `number-kv`).
4. **Save** — commits the Definition Element and its config subtree (sync-queued, `updatedBy: <currentUserId>`, currently `"localUser"`), collapses the authoring form, and **immediately materialises a checked Composer row** at the same position, so the user can fill in the value and proceed to the batch Save in one continuous motion.
5. **Cancel** — discards the in-progress authoring form. No Definition is written. The Composer returns to its prior state.

The authoring form has **its own pending-state shape**: it is *not* a `pendingForm` from `usePendingForms`, because no DataField exists yet — the FieldDefinition has to commit first before a DataField draft can attach to it. The hook surface for this state is a separate concern; naming TBD during implementation (working name: `useDefinitionDraft`).

### Edit / Delete Semantics for FieldDefinitions

**Phase 1 ships with no user-facing edit or delete of FieldDefinitions.** This is a deliberate simplification, not an oversight — multi-user identity and permissions don't exist yet, so any edit/delete UX is premature.

- **Edit is conceptually "fork"**: any future UI affordance that looks like "edit this FieldDefinition" (whether the change is to label, config, or both) **mints a new FieldDefinition** rather than mutating the existing one. The original is untouched; downstream DataField instances remain bound to it. This sidesteps cascading config changes (e.g. unit changes on a `number-kv` field) and avoids the question of which user is authorised to edit a given entry.
- **Delete is admin-only**: end users cannot delete FieldDefinitions — not their own, not others'. Bad or duplicate entries are removed by the dev team directly in Firestore. The `deletedAt` column exists on the entity for forward compatibility (and for the rare admin tombstone), but no client write path sets it in Phase 1. Soft-deleted FieldDefinitions are filtered out of the Composer listing.

Per-user delete UX, ownership-based permissions ("you can delete your own"), config-edit-creates-fork affordances, and label-uniqueness / dedup logic are all deferred to LATER.md and revisited once real multi-user identity lands.

### Default DataFields at Node Creation

Three FieldDefinitions are pre-checked in the Composer when a node is in `isUnderConstruction`:

- **Type Of** (`text-kv`)
- **Description** (`text-kv`, `multiline: true`)
- **Tags** (`text-kv`)

These appear as **locked checked rows** — checkbox visibly checked but disabled — so the user can't uncheck them. They commit as DataFields on node Save regardless of whether a value was entered (empty fields are allowed). Other FieldDefinitions in the Composer are unchecked by default and behave normally.

UI code references these three by stable ID via the `DEFINITION_IDS` constant, never by label.

### What stays in LATER.md (Phase-2+)

- **Templates** (composite sets of FieldDefinitions, e.g. "HPU with Accumulator") — distinct, larger feature.
- **Composer discovery UX**: typeahead filter, category grouping, popularity ranking, "recently added" sort, dropdown-flip behaviour.
- **Moderation / promotion to canonical** for crowdsourced entries.
- **Versioning by identity, not a field** — `definitionId` answers "which version"; a Definition is forked (new id), never mutated, so no `componentVersion` column is needed (value/config shapes are widen-only).
- **User-facing edit/delete** of Definitions with real ownership rules.
- **Label uniqueness / dedup / merge** flows.
- **Dedicated Library view** (the "TreeNode stack under the app's main menu").
- `**number-kv` per-instance metadata**: a user-set Valid-Until date on each entered value (distinct from the config-level `expectedRefreshSeconds`); per-instance Priority/Severity, Redaction Rule, Source. These belong on the instance Element, not in the Definition's config, and interact with history/audit in ways the other knobs don't.
- `**number-kv` unit conversion at display time** (e.g. user-preferred metric/imperial). Storage stays canonical; display does the work.
- **ISO-4217 currency-code picker** for `number-kv` `currencyCode`. Phase 1 is free-text.

(Recursive sub-field composition and reusable config sub-shape extraction are no longer deferred items — config **is** child Elements; see *Data Model → Config is Elements*.)

### Field-kind specs → ELEMENT-MODEL.md

The full per-kind specifications — composition, value shape, config sub-fields, and edit / display / validation UX — live in **ELEMENT-MODEL.md → Field-like kinds**, one self-contained entry per kind. Phase-1 field kinds: `text-kv`, `enum-kv`, `number-kv` (the deliberately rich one), `image` / `image-with-caption`. The `number-kv` entry is the canonical exercise for the progressive-disclosure + value-driven conditional-reveal authoring patterns the wider Library-authoring UI reuses.

(The former `single-image` kind — which crammed image + caption into one value object — is superseded by `image` + `image-with-caption`, where the caption is a sibling `text-kv` sub-field and so gains its own history.)

### Seeded FieldDefinitions (starter Library)

Phase 1 ships with a set of dev-seeded Definitions (Library-tree Elements, `updatedBy: "appDeveloper"`) so the Library is non-empty on first run. The starter set is small and biased toward fields any asset is likely to have — the user-authoring path is expected to grow the Library from here.


| Label          | kind          | Notes                                               |
| -------------- | ------------- | --------------------------------------------------- |
| Description    | text-kv       | `multiline: true`                                   |
| Type Of        | text-kv       | User-defined categories                             |
| Tags           | text-kv       | Comma-separated values (structured tags [Phase 2+]) |
| Location       | text-kv       | Physical location                                   |
| Serial Number  | text-kv       | Manufacturer serial                                 |
| Part Number    | text-kv       | Manufacturer part number                            |
| Manufacturer   | text-kv       | Equipment manufacturer                              |
| Model          | text-kv       | Equipment model                                     |
| Status         | enum-kv       | `options: ["In Service", "Maintenance", "Retired"]` |
| Installed Date | text-kv       | ISO date; `date-kv` kind [Phase 2+]                 |
| Weight         | number-kv     | `unitsSymbol: "kg", unitsLongForm: "kilograms"`     |
| Power Rating   | number-kv     | `unitsSymbol: "W", unitsLongForm: "Watts"`          |
| Note           | text-kv       | `multiline: true`                                   |
| Main Image     | image         | one image                                           |


The three pre-checked construction defaults (`Type Of`, `Description`, `Tags`) are a subset of this list and are described under "Default DataFields at Node Creation" above.

### Empty State (ROOT View)

- Default welcome message "Create a new asset to get started"
- CreateNodeButton shown (isRoot state)

## Data Model

***Intent:*** *one shape underlies every thing in the app, so a new kind of thing is a new way of drawing it — never new plumbing.*

The data model is a single recursive primitive, the **Element**. A node is an Element with children and a null value; a field is an Element with a value and (usually) no children; a composite (Equipment Plate, Logbook) is an Element with both. See Concepts & Vocabulary for how the user-facing surfaces map onto it.

#### Element Entity

**Purpose:** The single recursive primitive — a named thing that may carry a value and/or contain child Elements.


| Field             | Type          | Required | Description                                                                                      | Constraints                                                                                                                           |
| ----------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| id                | string (UUID) | Yes      | Unique identifier                                                                                | Generated client-side; canonical ID                                                                                                   |
| kind              | string        | Yes      | Immutable dispatch discriminant into the registry; the *only* hard discriminant. Behaviour is looked up in the manifest, never stored. | A registry key (`"node"`, `"text-kv"`, `"enum-kv"`, `"number-kv"`, `"image"`, `"job"`, …); `Kind` derives from the registry. Immutable after mint |
| name              | string        | Yes      | Level-I/II label (the element's Title).                                                          | Max 100 chars; required (empty names not allowed)                                                                                     |
| subtitle          | string        | null     | No                                                                                               | Description/location (the element's Subtitle).                                                                                        |
| value             | JSON          | null     | No                                                                                               | Typed value, shape discriminated by `kind`. `null` for pure container (`kind: "node"`) elements.                                      |
| parentId          | string        | null     | Yes                                                                                              | Canonical ("home") parent element. `null` = tree root.                                                                                |
| siblingOrder      | number        | Yes      | Order among siblings under the canonical parent, assigned incrementally at mint (every element). | Auto-assigned: next integer after the last sibling; inserting between siblings renumbers the affected run (see Sorting policy)        |
| definitionId | string (UUID) | null     | No                                                                                               | Set for field-like elements minted from a Library Definition; binds the instance to it (cascade source). `null` for hand-created nodes.|
| updatedBy         | string        | Yes      | User ID of last editor                                                                           | Valid user ID                                                                                                                         |
| updatedAt         | timestamp     | Yes      | Last modification time (epoch)                                                                   | Client-assigned; server-assigned [Phase 2+]                                                                                           |
| deletedAt         | timestamp     | null     | Yes                                                                                              | Soft delete timestamp                                                                                                                 |


> The Phase-1 `Element` is exactly the columns above. `name` and `siblingOrder` are
> **permanent columns** — identity and order are uniform across every kind and on the
> hot path; a feature that would force them into child Elements is, by that fact,
> chrome or derived state, not an Element. Capabilities (below) add behaviour, not
> columns; the graph features in *Future Architecture* are the only column-adds, and
> they are additive — column-adds, not migrations.

### The registry & manifest

All kind-specific behaviour lives in a module-level **manifest** keyed by `kind`, never stored on an Element: behaviour is code, and an Element is data that round-trips through IndexedDB and Firestore. The manifest is the entire plug-in seam, identical in shape for node-like and field-like kinds:

```ts
type KindManifest = {
  // identity
  kind: Kind;
  pickerLabel: string;
  mintVia: "composer" | "node-create"; // which create affordance offers this kind
  placement: "inline" | "re-root";     // where this kind draws ITS surface
  Renderer: Component<RendererProps>;   // placement-keyed (inline row | re-root view)

  // capabilities — each optional; absence = origin in that axis
  ownValue?: ValueSpec;
  children?: { spec: ChildrenSpec; validateChild?; onCreate?; };
  edges?: { target: TargetSpec; validateTarget?; };
  derivation?: { source: SourceSpec; compute?; };
  action?: { spec: ActionSpec; run?; };

  // node-oriented descriptors (ride on the six; not new capabilities)
  provision?: ProvisionSpec;
  container?: "physical" | "logical";

  // cross-capability + meta
  arbiter?: ArbiterSpec;
  coherence?: (caps: CapabilitySet) => Result<void, string[]>;
  reads?: { resolver?: boolean; historyStream?: boolean };
  lazy?: boolean;
};

export const KIND_REGISTRY = { node, 'text-kv': …, 'number-kv': …, job, jobs, … }
  satisfies Record<Kind, KindManifest>;
```

`Kind` and `Value` **derive from the registry**, not hand-maintained — a missing or mistyped kind is a compile error. **There is no privileged kind** — only the privileged *shell* and *root position* (`parentId: null`). Adding a kind is the only place the framework learns of it: add it to the registry, drop a `<kind>.manifest.ts` declaring its subset + descriptors, implement its `Renderer`, and the `satisfies Record<Kind, …>` check enforces completeness.

### The six capabilities

Closed to modification, open to extension: a new **kind** is cheap (a manifest recomposing these); a new **capability** is a deliberate framework change, warranted only by a sync/read/compute/write path none of the six has. A kind is `origin + subset`; field-like kinds lean on **OwnValue**, node-like kinds on **Children / Edges / Derivation**.

| Capability     | Descriptor    | Sync contract                                                  |
| -------------- | ------------- | -------------------------------------------------------------- |
| **OwnValue**   | `ValueSpec`   | LWW `value` by `updatedAt`                                     |
| **Children**   | `ChildrenSpec`| parent has no own value to LWW; each child LWW'd independently |
| **Edges**      | `TargetSpec`  | LWW the edge only; target content untouched                   |
| **Derivation** | `SourceSpec`  | never stored, never synced, never in history (pure compute)   |
| **Action**     | `ActionSpec`  | emits commands; stores no value; effects are ordinary mutations |
| **Reads**      | `{ resolver?, historyStream? }` | none — pure read (injected, read-only)      |

- **Children** carries `mode: template` (fixed core) `| open` (user-grown); `open` is always type-constrained (`open(allowlist)`, never `open(any)`).
- **Action** is the only imperative capability — non-idempotent under replay, so it needs `idempotencyKey` + `confirm`. Everything else is declarative, convergent, offline-safe. Built last; likely never user-authorable.

**Descriptors** parameterize the capabilities (same closed set for node-like and field-like):

- **`ValueSpec`** — value shape, validation, renderer input (field-like core).
- **`ChildrenSpec`** — `{ mode, allowedKinds, cardinality, validateChild, onCreate }`. `cardinality` defaults to `'one'`; repeatable data is one list-valued child. `onCreate` provisions an atomic multi-Element draft at mint and per sub-field may **pre-fill a copied value** (owned) or **leave it absent** (delegated, read live).
- **`TargetSpec`** — `{ scope, pin?, appearance?, allowedKinds?, valid? }`. `scope`: `internal` (value is an Element id) `| external` (`{ url }`, no resolver). `pin`: `'live'` (resolves current state) `| 'revision'` (pins `${targetId}:${rev}`, immutable — an approval). `appearance`: `'citation'` (inline reference) `| 'portal'` (navigable child of a *virtual* parent; one canonical `parentId`, appearances layered on top, so **detach ≠ delete**).
- **`SourceSpec`** — `{ relation, reach }` matched to a target kind: `relation` ∈ `children` (down) / `ancestors` (up) / `edges` (out); `reach` ∈ `direct` / `transitive`. So `children/transitive` = subtree rollup (and the gather behind a **lens**); `ancestors/transitive` = inheritance (nearest-first); `edges/direct` = curated membership.
- **`ProvisionSpec`** — declarative, idempotent, **framework-reconciled** materialization `{ trigger, target, idScheme }`: ensure **exactly one node exists at each target place**, keyed by a deterministic id, so concurrent creates converge (never duplicates). Not `Action` — declarative and convergent, never imperative.
- **`container`** — `physical` (membership via Children/`parentId`, single home, cascade-delete) `| logical` (membership via Edges, many, resolved, no cascade).
- **`ArbiterSpec` / `ValiditySpec`** — resolve a contending capability pair (§ the cascade); decide when a pinned edge still counts.

Node behaviour decomposes entirely into these: **aggregation** = Derivation reading `children/transitive`; **a lens** = that gather provisioned upward at every level; **inheritance** = Derivation reading `ancestors/transitive`; **auto-provisioning** = Derivation + ProvisionSpec; **membership-mode** = container; **lifecycle** = constrained Action or validated OwnValue. The per-kind catalogue (ELEMENT-MODEL.md) gives each kind's exact composition.

### Earning a kind

A kind exists **iff it composes non-trivial behaviour** from the six capabilities — the rule is identical for node-like and field-like kinds.

- **Behaviour-bearing → kind.** `number-kv` composes OwnValue(+thresholds); `jobs` composes `Derivation(children/transitive) + ProvisionSpec` (the lens). These earn the registry.
- **Behaviour-free label → not a kind.** `pump`, `vessel`, `fuse` compose nothing — they are `typeOf` *tags* (soft data) on `node`, shipped as forkable seed data. A capability-empty kind that is neither the base `node` nor justified by composed behaviour is the **degeneration anti-pattern** (a domain label masquerading as code); it is CI-lintable.
- **Targeting alone does not earn a kind.** Being an Edges *target* is a use of a kind, not a behaviour it composes.

So the **registry holds composed behaviour; `typeOf` holds the open domain typology.** Users mint *instances* and coin *`typeOf` tags* (both unbounded data); they never author kinds. `kind` being immutable means reclassifying an instance's *domain label* is a `typeOf` edit, while changing a node's *behavioural kind* is rare and destructive (delete-and-recreate) — correct, because it is a change of behaviour, not of label.

Three places capabilities aren't orthogonal: **arbitration** (a contending pair, e.g. `OwnValue + Derivation` = inherit-unless-override, needs an `arbiter`); **validity** (`coherence(caps)` rejects incoherent subsets — `Derivation + historyStream` stores nothing → invalid; `Children + OwnValue` is valid but flagged); and **identity/targeting** (`kind` is the one hard match key, spanning node-like and field-like alike, which is why no separate classifier column is needed).

### Config is Elements

A field's secondary values — units, quantity-kind, decimals, ranges, alert points, channels, staleness, source link — are **child Elements** (sub-fields), each minted from its own kind, editable, history-tracked, LWW'd. **There is no `config` blob.** A Definition lives as an Element in the `library` tree and its config *is* its child subtree, so config becomes business-grade data: synced, history-tracked, revertible.

- **Most config sub-fields reuse existing field-like kinds** — a units sub-field is an `enum-kv`, decimals/staleness are `number-kv`, multiline/requireCaption are flags. A kind's **config schema** is just its manifest `ChildrenSpec` over config sub-field kinds (template core + open tail); `ValueSpec` carries only the *own* value.
- **The only object-valued residue is the compound sub-field** — co-varying values that must move together (`thresholds: {LL,L,H,HH}`) bundle into one atomic LWW'd object, by necessity (atomicity), not by default.
- **Locking — three mechanisms, no new primitive**, hardest to softest: `kind`-immutability (the units sub-field's kind is `length-unit`; "= mass" is not in its vocabulary); `template` presence-lock (the fixed config core minted by `onCreate`, not user-removable); cascade `pin` (a Definition author pins a sub-field so instances can't override).
- **Disposition — owned · delegated · pinned** — set per sub-field, all branches of inherit-unless-override: **owned** (copied at mint; Definition edits don't propagate — meaning-defining config like units/thresholds), **delegated** (absent at mint, read live; Definition edits propagate — cascade config like criticality), **pinned** (delegated with override disabled).
- **Renderer reads sub-fields directly** as reactive signals — no persisted/synced derived config object (it would be a second source of truth racing the children under LWW). Reading own children is a bounded, local read.
- **Granularity is a choice** — decomposed config can tear under concurrent offline edits (`L` and `H` converging to `L > H`); this is allowed, flagged, and revertible. Validation is **advisory** by default; reserve the atomic compound for the few values where a wrong combination is *dangerous*, not merely silly.
- **Termination (⊥).** Each level's sub-field is a strictly smaller kind than its parent, until one declares no config (a pin is a boolean; a boolean's config is `{}`). The recursion cannot cycle because the chain strictly descends.

### The cascade — one arbiter, three jobs

`inherit-unless-override` is shadow-and-delegate: an own value present shadows; absent, it delegates upward (a Derivation reading `ancestors/transitive` — the nearest ancestor that has a value) and recomputes. Inheritance is therefore the same `SourceSpec` as aggregation, pointed up. One arbiter serves three jobs:

1. **Business value inheritance** down the asset tree (criticality, rated pressure) until a node sets its own.
2. **Definition specificity** — general → narrow → instance; a narrow Definition stores only overrides and delegates the rest (config-as-Elements + inherit-unless-override *is* the specificity spectrum).
3. **App → org → role → user config** down the authority hierarchy, each layer's prefs being Fields on a Node.

**Audit-safe by construction:** config and prefs file in **Library / overlay** history, not business history, so delegating them touches no business audit. A Definition is **forked, never mutated** (editing one mints a new id; existing instances stay bound to the one they were minted from); `definitionId` *is* the version, so there is no `componentVersion` and no migration runner.

### Populations are typed trees

Each tree is rooted at its own Element (`parentId: null`); the ROOT view lists the business-tree roots; `Up` walks `parentId` to a root, then to the ROOT view — never above a root. Structure is uniform; **policy travels per-tree** as a `treeType` axis:

| `treeType`   | example contents                          | history  | sync                     |
| ------------ | ----------------------------------------- | -------- | ------------------------ |
| `business`   | assets, fields, jobs, logs                | business | shared, LWW              |
| `library`    | field Definitions + their config subtrees | Library  | shared, LWW              |
| `config`     | org / role / user prefs                   | overlay  | shared or per-user       |
| `view-state` | expansion, ordering overlays              | none     | device-local, not synced |

Per-viewer resolution layers `config` / `view-state` at read time through a single `effectiveChildren(node, viewer)` chokepoint — never written into the shared Element. (Personal `siblingOrder` is such an overlay: the canonical order is the column; a personal reorder is a sparse per-viewer overlay.) This **supersedes** the old "Tree Partitioning (Multi-Collection)" deferral — populations are typed trees, each with its own root.

### Manifest → chrome (one-way entailment)

Chrome is never an Element. Each affordance is a consequence of the kind's composed set, drawn by the renderer reading the manifest; the entailment runs one way (manifest → chrome):

| Affordance               | Entailed by                               | Stored as                          |
| ------------------------ | ----------------------------------------- | ---------------------------------- |
| Up button                | `placement: re-root` + own `parentId`     | nothing (derived)                  |
| Expand/collapse chevron  | has children                              | device-local view state (`isExpanded`) |
| Breadcrumb               | own `parentId` walk                       | nothing (derived)                  |
| Add surface(s)           | `Children(open)` + child kinds' `mintVia` | nothing (rendered expression of `open`) |
| Field Details / Settings | has meta-field children                   | region is chrome; its contents are config Elements |
| Section header           | a grouping tag on the items               | nothing (a render grouping, not a node) |

Chrome is always **derived**, **device-local view state**, or **the rendered expression of a capability** — never content. The shell is **fractal**: every Node carries a tiny shell, the renderer reading that Node's manifest. **Presentation follows from a value's shape, not per-kind flags:** a small closed vocabulary of value shapes (`scalar | block | stream | composite`) carries the arrangement rules once — a kind picks a shape; it never declares the layout. Layout is entailed, never declared.

#### FieldDefinition (a Library-tree Element)

**Purpose:** A Library entry — a field-like Element of the kind it defines, living in the `library` tree (`treeType: library`), whose config is its child sub-field Elements. Instances bind to it by `definitionId`. It is **not a separate entity**: its columns are the Element columns (`kind` = the kind it defines, `name` = the label), and it has no `config` column — config is its subtree.

> Migration note: **landed** (2026-06-27, config-as-Elements). The old separate `fieldDefinitions` Dexie table, its `config` JSON blob, and the `authorId`/`componentType` columns are gone — the table collapsed into the `library` tree, the blob into a config subtree, and `authorId` into `updatedBy`. In code the assembled read-model view is the `Definition` type; instances bind by `definitionId` (renamed from `fieldDefinitionId` 2026-07-01 — the binding is kind-agnostic: re-root policy containers like `logbook` bind a Definition through the same column).

#### ElementHistory Entity

**Purpose:** Immutable append-only audit log of Element changes, spanning every tracked property: value edits, renames, re-subtitling, re-parenting (a *move* is a `parentId` change), reordering, and structural create/delete. Typed as a discriminated union over `kind` so value `prevValue` / `newValue` carry the element's value shape.

**Append-only means it must converge.** Rows are never updated in place, so the log is a grow-only set: every append gets a unique id and two clients merge by union, with nothing overwritten and no coordination needed. This is why `id` carries a random tail and why `rev` is only a per-client sequence — `rev` is minted from a local read, which cannot see another client, so two offline edits to the same element legitimately share a `rev` and must not share an id. Display order is therefore `(rev, updatedAt, id)`, not `rev` alone.

**Shared fields**:


| Field     | Type          | Required | Description                        | Constraints                                      |
| --------- | ------------- | -------- | ---------------------------------- | ------------------------------------------------ |
| id        | string        | Yes      | Primary key                        | `${elementId}:${rev}:${random}` — unique per append |
| elementId | string (UUID) | Yes      | Reference to `Element.id`          | Must exist in `elements` table                   |
| parentId  | string (UUID) | null     | Yes                                | Owning/canonical parent at time of change        |
| kind      | string        | Yes      | Discriminator                      | Matches `Element.kind`                           |
| action    | enum          | Yes      | `"create"`                         | `"update"`                                       |
| property  | enum          | Yes      | Which property changed.            | `"value"`                                        |
| prevValue | JSON          | null     | Cond.                              | Prior value of the changed property              |
| newValue  | JSON          | null     | Cond.                              | New value of the changed property                |
| updatedBy | string        | Yes      | Editor identifier                  | Constant `"localUser"`; real user IDs [Phase 2+] |
| updatedAt | timestamp     | Yes      | When the change occurred (epoch)   | Client-assigned; server-assigned [Phase 2+]      |
| rev       | number        | Yes      | Per-client sequence per `elementId` | Starts at 0 for create; **not** unique across clients |


`**prevValue` / `newValue` shapes**:

- `property === "name"` or `"subtitle"` → `string | null`
- `property === "parentId"` → `string | null` (the element id of the old/new parent)
- `property === "siblingOrder"` → `number`
- `property === "value"` → discriminated by `kind`:


| kind           | value shape                                              |
| -------------- | -------------------------------------------------------- |
| `text-kv`      | `string                                                  |
| `enum-kv`      | `string                                                  |
| `number-kv`    | `number                                                  |
| `image`        | `{ blobId, mimeType, width, height, byteSize }           |


Reversion and audit are central to the app, so the history record must preserve the typed value exactly as stored on the element at that revision.

**Indexes**:

- elements: by parentId, by updatedAt, by kind, by definitionId, by treeType — (`*virtualParents` multi-entry index [Phase 2+])
- elementHistory: by elementId, by updatedAt, by parentId
- imageBlobs: by blobId (primary)

**Entity Relationships**:

- Element has 0..1 canonical parent Element (self-referential, via `parentId`)
- Element has 0..n child Elements
- A field-like instance Element references 0..1 Definition Element (via `definitionId`); a Definition Element has 0..n instances; nodes typically reference none
- An `image` Element references exactly 1 `imageBlobs` row per non-null value
- [Phase 2+] Element has 0..n virtual appearances (`virtualParents`) and 0..n `reference` edges to other elements

**Sorting policy**:

Every element carries a `siblingOrder`, assigned incrementally when it is minted. Children render in two visual regions (navigable child nodes below; inline value-bearing fields in the Data Card), and **both regions sort by `siblingOrder` ascending**. Positions are stable and manually reorderable.

- **Insertion strategy is renumber-the-run, not fractional keys.** New elements get the next integer `siblingOrder` after the last sibling. Inserting between two existing siblings (e.g. via CreateNodeButton) reassigns sequential integers to the affected run rather than computing a fractional midpoint. `siblingOrder` stays an integer sequence; gaps left by deletes are tolerated and compacted later (via `computeCardOrderUpdates`), never bridged with fractional values.
- Manual reorder updates `siblingOrder` for all affected siblings (the same renumber-the-run helper) and is logged to history (see DataField Reordering below).

**Element Rules**:

- Root elements have `parentId = null`
- Names don't need to be unique; names are required (non-empty)
- A value-bearing element with `value: null` is the empty/unfilled case; a container (`kind: "node"`) element holds `value: null` permanently
- All values are stored per the `kind`'s value shape (parsing/validation in UI)
- Metadata field `updatedAt` auto-updates on changes (client-assigned; server-assigned [Phase 2+])

**Data Persistence**:

- **Storage Abstraction**: Storage operations are abstracted through a backend-agnostic interface, enabling the system to work with different storage backends (local browser storage for offline-first, cloud storage for sync) without requiring component changes. This abstraction allows swapping storage implementations as needed.
- **Stores**: `elements` (all `treeType`s, including the `library` tree), `elementHistory`, `imageBlobs`. (The old separate `fieldDefinitions` store was dropped in schema v10 — the Library lives in `elements`.)
- **Primary Storage**: Local browser storage for offline-first capability. All operations persist locally first.
- **Cloud Sync**: Bidirectional sync with cloud storage when online. The system orchestrates push (local→remote) and pull (remote→local) operations. Conflict resolution uses Last-Write-Wins (LWW) based on `updatedAt` timestamps.
- **Sync Triggers**: Automatic sync on startup (if online), periodic timer (every 10 minutes), and on network 'online' event. Manual sync available via dev tools.
- **Single-user environment**: Uses constant `updatedBy` "localUser". Changes to `value` / `name` / `subtitle` / `parentId` / `siblingOrder` are logged to history; `kind` / `definitionId` changes are not. [Phase 2+]: real user identity.

### Future Architecture (Phase 2+)

The capability model above already *expresses* the graph features below; what is **deferred is their build**, not their design. Each lands as an additive column-add against the Element, never a migration. The kinds that consume them are catalogued in ELEMENT-MODEL.md.

- **Virtual appearances (`virtualParents`)** — the graph overlay, expressed by **Edges** (`TargetSpec.appearance: 'portal' | 'citation'`). An element keeps its one canonical `parentId` (home) plus zero-or-more appearances under other parents: one identity, many appearances, never a copy; **detach ≠ delete**. Consumed by the `other-end` kind. Stored as objects `{ parentId, siblingOrder, navMode, render }` so each appearance carries its own ordering and portal-vs-citation behaviour.
- **Reference edges (`references`)** — one-way `depends-on` links, expressed by **Edges** + **Derivation**, needed the first time an element's value is *computed* from other elements (sums, match rules, service-due countdowns). A `relation` discriminator keeps these distinct from parent/appearance edges.
- **Smart-element compute** — `Derivation(SourceSpec)` reading children/ancestors/edges; never stored, never synced (the lens, asset-gallery, rollups, inherit-unless-override). Authored config is **Elements**, not a blob — see *Config is Elements* above; a pointer to another element is an edge, not config.
- **Per-viewer overlays** — the `view-state` typed tree: a user's/team's personal ordering and topology, layered sparsely at read time via the single `effectiveChildren(node, viewer)` chokepoint, never written into the shared element. Rollups/badges/search resolve against the *viewer's effective graph*.

## Storage Architecture

***Intent:*** *the app behaves identically offline and online; nothing a user does in the field is ever lost to a dropped connection.*

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
- **Routed by `treeType`**: sync, history, and visibility follow the tree's `treeType` (see *Data Model → Populations are typed trees*) — `business` and `library` sync shared+LWW, `config` shared-or-per-user, `view-state` stays device-local and is never synced.

### Soft Deletion

**Retention is the default. Deletion is soft delete, and soft delete is the only
delete.** No client code path removes an element row — not a user action, not a
sync reconcile, not a reset. An element leaves the user's view by acquiring a
`deletedAt`, and the row itself stays.

This is a guarantee about the sync layer as much as the UI: a pull is additive.
Absence of a row on the server never means "delete it locally", because server
absence cannot distinguish a deletion from a row that never arrived — including
the row whose upload permanently failed, the one least safe to drop.

Elements support soft deletion via `deletedAt` timestamps:

- Active elements have `deletedAt: null`
- Deleted elements have `deletedAt: <timestamp>`
- Queries filter out soft-deleted elements by default
- Children of soft-deleted elements are implicitly hidden (not cascade soft-deleted)
- Soft deletes sync as ordinary field updates, so they propagate through the same lane as any other change
- Restoration: see Snackbar & Undo for the 5s undo window; beyond that, restore is currently cloud-db-only. [Phase 2+]: in-app restore UI (a dedicated view for browsing and restoring deleted elements).

Purging a row outright is an admin capability, deferred — see LATER.md →
Destructive Operations. Resetting a *development* client is a separate, local
act (`window.__wipeLocal()`), not a data-model feature.

#### Element Example (a container — a Node)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "kind": "node",
  "name": "Main HVAC Unit",
  "subtitle": "Building A Primary Cooling System",
  "value": null,
  "parentId": null,
  "siblingOrder": 0,
  "definitionId": null,
  "updatedBy": "user456",
  "updatedAt": 1709942400000,
  "deletedAt": null
}
```

#### Element Examples (value-bearing — Fields, parented to the node above)

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440004",
    "kind": "text-kv",
    "name": "Serial Number",
    "subtitle": null,
    "value": "HVAC-2024-001",
    "parentId": "550e8400-e29b-41d4-a716-446655440001",
    "siblingOrder": 0,
    "definitionId": "fd_serial_number",
    "updatedBy": "user123",
    "updatedAt": 1709856000000,
    "deletedAt": null
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440005",
    "kind": "enum-kv",
    "name": "Status",
    "subtitle": null,
    "value": "In Service",
    "parentId": "550e8400-e29b-41d4-a716-446655440001",
    "siblingOrder": 1,
    "definitionId": "fd_status",
    "updatedBy": "user456",
    "updatedAt": 1709942400000,
    "deletedAt": null
  }
]
```

#### ElementHistory Example (for a single value-bearing element)

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440004:0",
    "elementId": "660e8400-e29b-41d4-a716-446655440004",
    "parentId": "550e8400-e29b-41d4-a716-446655440001",
    "kind": "text-kv",
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
    "elementId": "660e8400-e29b-41d4-a716-446655440004",
    "parentId": "550e8400-e29b-41d4-a716-446655440001",
    "kind": "text-kv",
    "action": "update",
    "property": "value",
    "prevValue": "HVAC-2024-001",
    "newValue": "HVAC-2025-002",
    "updatedBy": "localUser",
    "updatedAt": 1709942400000,
    "rev": 1
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440004:2",
    "elementId": "660e8400-e29b-41d4-a716-446655440004",
    "parentId": "550e8400-e29b-41d4-a716-446655440001",
    "kind": "text-kv",
    "action": "update",
    "property": "name",
    "prevValue": "Serial Number",
    "newValue": "Serial No.",
    "updatedBy": "localUser",
    "updatedAt": 1709943000000,
    "rev": 2
  }
]
```

## Styling Design

Wireframe reference: [ROOT View wireframe](assets/root-view-wireframe.html) (open in browser to preview).

### Style Guide

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

**Layout is entailed by value shape, not declared per-kind.** A small closed vocabulary of value shapes (`scalar | block | stream | composite`) carries the arrangement rules once: a `scalar` renders inline with a centred chevron; a `block` is tall and pins the chevron to the top; a `composite` draws its own sub-structure and suppresses the generic label. A kind picks a shape; it never declares the layout (same one-way rule as *Data Model → Manifest → chrome*). A new shape must carry a distinct *arrangement law*, not merely a different look — otherwise it is styling and belongs in the renderer.

**[Phase 2+]**: Per-user and per-org style configuration (colour scheme, font size, contrast/accessibility preferences) via semantic token overrides. The three-layer architecture was designed with this in mind.