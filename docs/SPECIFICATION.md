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
- **Minting Records Identity**: An Element is created by naming it — or by choosing the Definition that names it. Nothing else is required and nothing is batched. An Element with no value is a **recorded intention** (*this pump has a serial number; nobody has read the plate yet*), not an unfinished form — which is why `value: null` is a first-class state and not a validation failure. Values arrive afterwards through ordinary in-situ editing. Two surfaces are deliberate exceptions and say so where they are specced: node construction commits a node and its policy defaults as one transaction, and Definition authoring holds an ephemeral draft because a Definition must be coherent at birth.
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
- **DataCard**: Every TreeNode has exactly one DataCard. Contains DataFields (user values) + the AddFieldSurface + node metadata section. Expands/collapses with an animated slide-down, triggered by a chevron button on the TreeNode body to the right of NodeSubtitle. Animation must be content-aware (no fixed heights). See IMPLEMENTATION.md → DataCard Animation for technique.
- **DataField**: Row item with Label:Value pairs, which users add to a node. Most values can be edited afterwards with a simple double-tap interaction. When isEditing=true, the Value is replaced with an input field (Label remains static). No separate input sub-component needed.
- **DataFieldDetails**: Expandable section (simple chevron) — the Field's own Data Card. Holds up to three sections — History, Config, Tools — each present only if the kind entails it. See DataField Management → Field Details below.
- **AddFieldSurface**: The DataCard's create affordance, at the bottom of the FieldList. Collapsed it is one quiet "+ Add Field" row; expanded it is the LibraryPicker. Rendered only when the node's kind admits a field-like child. See The Add Surface.
- **LibraryPicker**: The `library` tree rendered for picking — one row per active FieldDefinition, each expandable in place to peek at its config, each pickable to mint a DataField. Hosts the "+ New Field Definition" authoring row.
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
- **isUnderConstruction**: The node does not exist yet, so neither can its fields. TreeNodeDetails not shown; no AddFieldSurface. The card is empty until "Create" commits the node together with its default DataFields (see Node Creation). "Create" and "Cancel" buttons at the bottom.

## DataField States

- **isMetadataExpanded**: Field Details area is expanded/collapsed. Persisted to local storage.
- **isEditing**: Data Field is active for editing (active input field). Not persisted - component-local state only.
- **isUnfilled**: `value === null` — a recorded intention with nothing recorded against it yet. **Derived, never stored**: it is read off the value, not tracked, so it resolves the moment a value lands and returns if the value is cleared. Rendered in a distinct low-emphasis skin so a card shows at a glance which facts are still owed. It marks *empty*, not *new* — a field deliberately left blank forever reads the same as one minted a second ago, which is correct: both are facts the record does not yet hold.

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
- **Default DataFields at Node creation**: The node's default DataFields (see Default DataFields at Node Creation) are committed *with* the node, unfilled, by the same Create. They are not entered during construction — the node has no id in storage yet, so nothing can be parented to it. Fields are added afterwards through the AddFieldSurface, in the ordinary way.
- **Construction is the one batch**: node creation is the single place the app defers a write. Nothing reaches storage until "Create"; "Cancel" leaves no orphan. This is a deliberate exception to *Minting Records Identity*, bought for one reason — an abandoned construction surface must not litter the tree with half-named nodes — and it holds no user-authored content, only the node and its policy defaults.
  - **"Batch" is not yet "atomic."** Create issues the node write and then one write per default, sequentially; a failure partway leaves a node with some of its defaults. Tolerable (the node is valid and the missing fields can be added), and true of the current implementation too — but the guarantee is *deferred until Create*, not all-or-nothing, and should not be described as transactional until it is one.
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
- **Create Data Fields**: One **AddFieldSurface** sits at the bottom of the DataCard. Expanding it browses the Library; picking a FieldDefinition mints the DataField immediately, in its final place on the card, focused for value entry. There is no batch and no Save — a mis-pick is reversed by Undo. See The Add Surface below.
- **Field Details**: Expanding a DataField's chevron reveals the Field's own card — History, Config, Tools, in whichever of those the kind entails. See Field Details below.
- **Delete Data Field**: Expand the DataFieldDetails and use "Delete" in the Tools section. Snackbar with Undo follows (see Snackbar & Undo).
  - **Soft Delete**: DataField deletion sets `deletedAt` timestamp. The field is filtered from normal UI queries but can be restored. DataFieldHistory entries remain linked but are implicitly hidden when the field is soft-deleted.
  - A `DataFieldHistory` entry with `action: "delete"`, `property: "value"`, and `newValue: null` is written only after the undo window elapses.

### Field Details

***Intent:*** *a field can always account for itself — what it has been, what it means, and what can be done to it — without leaving the row.*

A Field is an Element with `placement: inline`, so its Details region is not a special panel: it is **the Field's own Data Card**, drawn by the same renderers as any other card. The shell is fractal (see *Data Model → Manifest → chrome*), and this is where that stops being a claim.

#### The sections are entailed, not enumerated

Details holds up to three sections, and **which of them exist follows from the kind's manifest** — the same one-way entailment that governs every other affordance:


| Section     | Entailed by                                | Holds                                                        |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| **History** | a tracked OwnValue / `Reads.historyStream` | the append-only value audit (see Field History)              |
| **Config**  | `Children` — the config sub-fields         | what the field *means*: units, decimals, thresholds, options |
| **Tools**   | always present (delete at minimum)         | actions on the field itself                                  |


The trio is not an arbitrary grouping: it is **one section per source of content a Field has** — its children (data), its own value over time (a read), and things done to it (chrome now, `Action` later). A fourth section must earn its place the way a kind earns the registry: by drawing on a capability the existing three don't.

So the count varies by kind. `external-link` carries no config sub-fields at all, so it has **no** Config section rather than an empty one; a `Derivation` kind like `asset-gallery` stores nothing and is never in history, so it has no History section.

#### Stacking is open

Whether the sections nest or lie flat is **undecided**, and this section deliberately does not settle it:

- **Three inside one** *(working default)* — the Field's chevron opens the card; each section carries its own chevron within it. Consistent with the fractal shell — a card holding rows, some of which expand.
- **Flat** — each section's chevron shows under every Field permanently. Costs vertical space on every row of every card, and is **ruled out as specced** by the entailment above: a fixed row of three chevrons would advertise sections a given kind does not have.
- **Collapse the singleton** — where a kind entails only one section, the Field's chevron reveals it directly rather than making the user open two things. Adaptive and cheap; the cost is that the interaction changes shape between kinds.

Where sections do stack, order is **History → Config → Tools**: most-consulted first, reference material second, the destructive action furthest from the thumb.

**Config here is resolved, not owned.** In Phase 1 every config sub-field is `delegated`: it lives on the Definition and is read live, so an instance has no config children of its own.

These rows are therefore the app's **first rendering of a delegated value**, and they draw one state of a single widget that eventually serves all three cascade jobs — business-value inheritance, Definition specificity, and config:


| State         | Reads as                                                                       | Built                |
| ------------- | ------------------------------------------------------------------------------ | -------------------- |
| **delegated** | ghosted value + a source chip naming where it came from (`⟨Weight⟩`)           | **Phase 1 — here**   |
| **shadowing** | solid value + `⟨this node⟩` + a revert control that drops the own value and delegates again | needs the arbiter |
| **pinned**    | delegated with the override suppressed                                          | needs the arbiter    |


Phase 1 builds the first row only: the delegation is **visible** and the override is **absent**, which is the honest rendering of what the system actually does. Making a row editable is **the cascade arbiter's job, not this surface's** — it requires honouring `disposition` so an override writes an owned child rather than mutating shared meaning.

**The chip is not free**, and the cost is architectural rather than visual: chrome entailment runs one way (see *Data Model → Manifest → chrome*), so *"this value is delegated"* has to be something the renderer can **read from the manifest**, never infer from a null. That requirement is the first place `ArbiterSpec` stops being a type and becomes pixels, and it is worth honouring in Phase 1's one-state version so the other two states cost nothing structural later. Tapping the chip through to its source waits on the Library view. [Phase 2+]

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
| DataField(s) added           | success | "Field added" / "N fields added"       | Undo — deletes the field(s) just added |
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
- **Coalescing**: a repeated same-kind action extends the current toast instead of replacing it, accumulating into one reversal closure ("3 fields added" undoes all three). This exists because single-slot replacement would otherwise make every action but the last irreversible — which is exactly wrong for a surface built around picking several things in a row. Coalescing is per action-kind and ends when the toast expires or any other action fires.
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
  - AddFieldSurface: Enter/Space to expand; within the picker, ArrowUp/ArrowDown to move between Definition rows, Enter to pick, ArrowRight/ArrowLeft to expand/collapse a row's config peek, Escape to dismiss
  - TreeNodeConstruction: Enter to create, Escape to cancel
- **Focus management**: `:focus-visible` ring on all focusable elements; `:focus:not(:focus-visible)` suppresses the ring for mouse users.

### DataField Reordering

Users can reorder DataFields within a DataCard. Whatever the gesture, the commit is settled: `siblingOrder` is renumbered across the affected run (renumber-the-run, never fractional keys — see *Data Model → Sorting policy*), persisted immediately, and logged to history. This is also the point at which gaps left by deletes get compacted.

Reordering matters more than it looks, and for a reason outside this card: `siblingOrder` is the single ordering primitive across every tree. Whatever gesture arranges one asset's fields is the same gesture that will arrange the Library, and the one that will set the order every new node is born with once bindings live in the `config` tree (see LATER.md → *Config-tree UI*). It is learned once and spent three times, which is the argument for choosing it deliberately rather than reaching for the first thing that works.

**The gesture is undecided, and is not part of the Add Surface branch.** One constraint is already known: it cannot hang off the row's chevron, which is spoken for as the Details toggle — a drag handle there would need drag-versus-tap disambiguation on touch, and the two actions are too different to share a target.

Since fields now mint at the bottom in pick order (see The Add Surface), arranging becomes the natural companion to adding rather than a separate chore — so the sequence is deliberate: the Add Surface lands first, and reorder is designed afterwards, against a card that has fields worth arranging.

## The Add Surface

***Intent:*** *adding a fact to a thing is the same act as adding a part to it — pick what it is and it exists; fill it in whenever you know.*

The Add Surface is the DataCard's create affordance — the inline-region twin of the CreateNodeButton, which does the same job in the children gutter. It is **entailed, not declared**: it renders iff the node's kind composes `Children(open)` *and* its `allowedKinds` admit at least one field-like kind (`allowedChildKinds(kind) ∩ FIELD_KINDS`). A kind admitting no field-like child offers no Add Surface at all, exactly as a content-free lens offers no create button. (See *Data Model → Manifest → chrome*: an add surface is the rendered expression of a capability, never a component someone remembered to mount.)

Collapsed, it is one quiet row — **+ Add Field** — beneath the persisted fields. Expanded, it is the LibraryPicker. It follows the lens create row's idiom: a button that becomes its own working surface in place, dismissed by Escape or by tapping the row again.

### Picking is committing

Choosing a FieldDefinition mints the DataField **immediately** — a real Element parented to the node, bound by `definitionId`, with `siblingOrder` one greater than the last persisted field and `value: null`. It appears in its final position on the card, drawn by its kind's real Renderer, unfilled.

**It does not take focus.** Autofocusing the new row would fight the picker staying open, and on a phone would raise the keyboard and shove the user's place mid-pick. The deeper reason is that focus-on-mint contradicts the state itself: an unfilled field is a resting state, not a form waiting to be completed. Pick now, fill when you know.

**There is no preview, because there is nothing to preview**: the row *is* the field. That is the whole of the simplification — a preview is a second rendering path obliged to imitate the first, and imitation is where the two drift.

- **Multi-pick is picking twice.** The picker stays open across picks; each pick is its own write. Fields commit in **pick order** — the order the user expressed, not alphabetical.
- **Undo, not Cancel, is the reversal.** A pick raises `"Field added"` with Undo. Consecutive picks **coalesce into one toast** (`"3 fields added"`) whose Undo removes all of them: the Snackbar is single-slot (see Snackbar & Undo), so a toast per pick would leave only the last pick reversible — the opposite of what a multi-picking user wants.
- **An undone pick leaves a tombstone, and that is the accepted price.** Retention is absolute (see Soft Deletion), so undoing a mis-pick soft-deletes rather than erases: the Element row keeps its `deletedAt`, and its `create` history row stays. A pending draft left no trace when cancelled, so this is the one thing immediate-commit genuinely costs. It is accepted because the alternative costs the whole pending apparatus, and because a stray tombstone is invisible to the user and harmless to the tree.
- **Nothing is pending.** Navigating away, reloading, or dismissing the picker leaves exactly what was picked, because what was picked was written. The only thing still losable is keystrokes sitting in an open value editor, and that is the ordinary edit path's behaviour, not this surface's.
- **An unfilled field is the expected outcome, not a failure.** Picking says *this thing has one of these*; entering the value is a later, ordinary act (see Core Principles → *Minting Records Identity*). A card of unfilled fields is a work list.

### The LibraryPicker

The picker is the `library` tree, rendered with the tree's own patterns rather than a bespoke list:

- **One row per active FieldDefinition**, sorted alphabetically by `name`. No scope filters, no categories, no search box — a flat list is fine while the Library is small.
- **The chevron expands the row in place** to peek at that Definition's config sub-fields, rendered read-only by their own kinds' Renderers — the same disclosure a lens gives its children. This is the disambiguation affordance: two Definitions may share a label (uniqueness is not enforced), and their config is what tells them apart.
- **The name picks it**, minting the field and leaving the picker open.
- **The first row is "+ New Field Definition"** — authoring, below.

Typeahead filtering, popularity ranking and "recently added" sort remain deferred. [Phase 2+] **Category grouping is blocked rather than merely deferred**: `parentId === null` is currently how the storage layer identifies a Definition, so a Definition cannot sit beneath a category node until that identity test moves off the null parent.

### Authoring a Definition

Authoring is a distinct act from picking, and it is the app's other deliberate exception to *Minting Records Identity*: a Definition holds an **ephemeral draft** until committed, because unlike a Node or a DataField it must be coherent at birth — a `number-kv` with no units, or an `enum-kv` with no options, is not incomplete but meaningless. The draft lives in memory only; dismissing the picker discards it and nothing is written.

The authoring row expands into three things and no more:

1. **Kind** — a picker over the user-mintable field kinds (`mintVia: 'add-surface'`), defaulting to `text-kv`.
2. **Label** — text input, max 50 chars, required non-empty trimmed; becomes the Definition Element's `name`.
3. **Config sub-fields** — rendered as rows, each by its own kind's Renderer. **The generic tree view is the default authoring UI**; a per-kind `ConfigForm` is an override, and it earns that override only by carrying **cross-field invariants a row list cannot express**. In Phase 1 exactly two kinds qualify:
  - **`number-kv`** — the `LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` chain plus the value-driven conditional reveals (see ELEMENT-MODEL.md → number-kv).
  - **`enum-kv`** — `default` must be one of `options`, which means the two cannot be authored as independent rows: the default's vocabulary *is* the options list, and removing an option has to clear a default that named it.

  A kind whose config is a set of independent knobs gets rows, not a form — `text-kv` and the image kinds are the cases that do.

Required config is enforced before commit; everything else takes the kind's defaults and may be left alone.

**Commit** writes the Definition Element and its config subtree (sync-queued, `updatedBy: <currentUserId>`), then **mints a DataField instance from it on the node** — the same act as picking it, so authoring and using are one continuous motion.

Authoring is the only Phase-1 entry point to the Library, and it only ever *adds*: editing an existing Definition remains absent (see Edit / Delete Semantics). A dedicated Library view — the same tree renderers pointed at the `library` tree — is where editing will eventually live. [Phase 2+]

## DataField Components and Crowdsourced Library

***Intent:*** *the kinds of fact the app understands are grown by the people using it, not rationed by developers or managers.*

### Conceptual hierarchy

Three layers — each is the precondition for the next:

1. **kind manifest** — dev-authored code: a `Renderer` + capability subset + descriptors, keyed by `kind` (e.g. `"text-kv"`, `"number-kv"`) in the registry. The closed set is owned by the dev team; users cannot author kinds (see *Data Model → Earning a kind*).
2. **FieldDefinition** — a Library entry: a field-like Element of the kind it defines, living in the `library` tree, whose **config is its child sub-field Elements** (units, thresholds, flags — not a config blob). Definitions are what users pick from in the LibraryPicker. Both dev-seeded and user-authored entries are Library-tree Elements — there is no other species.
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

The Library is the set of all active FieldDefinitions, surfaced to users as the row list inside the **LibraryPicker** (see The Add Surface).

#### One global, shared Library

There is exactly **one** Library — the `library` typed tree (see *Data Model → Populations are typed trees*) — shared across all users via sync. **Authoring is contributing**: every user-authored Definition becomes visible in every other user's picker the next time their client syncs. There is no private/public toggle, no per-workspace scope, no opt-in import step, no moderation, no "personal vs. community" tabs in Phase 1. The picker is the discovery surface.

Consequences worth being explicit about:

- A user's authored Definitions are visible to all other users immediately.
- Two users can independently author entries with the same `name` — both will appear in the Library. Label uniqueness is not enforced. The picker's expandable config peek is the disambiguation affordance. Deduplication / merging is a future concern.
- Once authored and synced, a Definition cannot be removed by any end user (see Edit / Delete below).

Privacy implication for the user: labels may carry proprietary information (e.g. a specific manufacturer's serial-format field name). Users should know that what they author is shared. Surfacing this expectation in the authoring UI is a UX concern tracked in ISSUES.md, not a SPEC-level toggle.

#### Where the Library lives

- **A typed tree, not a side table**: a Definition is an `Element` (with `treeType: library`) and its config is its child sub-field Elements; it syncs, history-tracks, and reverts like any other Element. (Landed 2026-06-27 — config-as-Elements; the old separate `fieldDefinitions` Dexie table was dropped in schema v10.)
- **Sync**: Library Elements ride the same bidirectional sync as the business tree (Push-then-Pull, LWW on `updatedAt`, queued through `SyncQueueManager`), routed by `treeType` for history/visibility.
- **Seed entries** (the starter set): written client-side on first run, idempotent via a seed version. Seed writes bypass the sync queue — seeds are identical per client, and syncing them would produce N redundant writes per N clients. Their stable deterministic ids let the UI reference defaults by constant (`DEFINITION_IDS`), not by label.
- **User-authored entries**: enqueue through the sync queue like any other user write; appear on other clients on next pull.

#### Listing in the picker

See *The Add Surface → The LibraryPicker* for the listing, the config peek, and what is deferred. Two consequences belong here rather than there:

- **The Library has no order of its own.** Every Definition is minted at `siblingOrder: 0`, so the picker sorts by `name`. Once the Library gains structure, `siblingOrder` should mean in the `library` tree what it means everywhere else.
- **A newly authored entry needs no special placement.** It mints its instance directly, so it never has to be found in the list it just joined; on the next opening it simply takes its alphabetical place. (The retired Composer needed a mint-position rule because authoring only produced a *row*.)

### FieldDefinition Authoring

The authoring surface is specced with the picker that hosts it — see *The Add Surface → Authoring a Definition*. What belongs here is the data side:

- The kind's **config schema** is its manifest `ChildrenSpec` over config sub-field kinds (template core + open tail); authoring fills those sub-field Elements (see *Data Model → Config is Elements*, and ELEMENT-MODEL.md for each kind's config).
- **Required config is enforced before commit** — `enum-kv.options` non-empty, `number-kv` units. `number-kv`'s threshold invariants (`LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` in range mode; the equivalent chain across `(nominalValue ± tolerance)` in discrete mode) are validated at authoring time, and are the reason that kind keeps a `ConfigForm` override.
- The draft carries **its own ephemeral state shape**, distinct from anything a DataField uses: no DataField exists yet, so there is nothing for a value draft to attach to. It is not persisted — dismissing discards it.

### Edit / Delete Semantics for FieldDefinitions

**Phase 1 ships with no user-facing edit or delete of FieldDefinitions.** This is a deliberate simplification, not an oversight — multi-user identity and permissions don't exist yet, so any edit/delete UX is premature.

- **Edit is conceptually "fork"**: any future UI affordance that looks like "edit this FieldDefinition" (whether the change is to label, config, or both) **mints a new FieldDefinition** rather than mutating the existing one. The original is untouched; downstream DataField instances remain bound to it. This sidesteps cascading config changes (e.g. unit changes on a `number-kv` field) and avoids the question of which user is authorised to edit a given entry.
- **Delete is admin-only**: end users cannot delete FieldDefinitions — not their own, not others'. Bad or duplicate entries are removed by the dev team directly in Firestore. The `deletedAt` column exists on the entity for forward compatibility (and for the rare admin tombstone), but no client write path sets it in Phase 1. Soft-deleted FieldDefinitions are filtered out of the picker listing.

Per-user delete UX, ownership-based permissions ("you can delete your own"), config-edit-creates-fork affordances, and label-uniqueness / dedup logic are all deferred to LATER.md and revisited once real multi-user identity lands.

### Default DataFields at Node Creation

Every new node is born with three DataFields, minted unfilled by the construction transaction:

- **Type Of** (`text-kv`)
- **Description** (`text-kv`, `multiline: true`)
- **Tags** (`text-kv`)

They are **node-creation policy, not a rendering side effect** — they arrive whether or not any picker was ever mounted. Once the node exists they are ordinary DataFields: editable, deletable, reorderable like any other. Nothing locks them, because there is no longer a checkbox to lock; a user who deletes "Tags" from one pump has simply decided that pump doesn't need it.

Which three is a binding, and bindings are destined for the `config` tree (see LATER.md → *Definition Packs*). The eventual affordance is provenance rather than prohibition: a default field can say *where it came from* and let the user navigate there, which defers permissions to the place they land instead of a role check at the field.

UI code references these three by stable ID via the `DEFINITION_IDS` constant, never by label.

### What stays in LATER.md (Phase-2+)

- **Templates** (composite sets of FieldDefinitions, e.g. "HPU with Accumulator") — distinct, larger feature.
- **Picker discovery UX**: typeahead filter, category grouping (blocked on Definition identity — see The LibraryPicker), popularity ranking, "recently added" sort.
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
  mintVia: "add-surface" | "node-create"; // which create affordance offers this kind
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
- Backgrounds are white or near-white; colour is reserved for interactive affordances (accent blue for focus/links, red for destructive actions). The **unfilled** field state (see DataField States) is drawn by de-emphasis — muted label, placeholder rule where the value would sit — not by a colour, because it marks an absence rather than an action
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