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
| **FieldDefinition** | A Library entry: an Element in the `library` tree (`treeType: library`, `parentId: null`) whose `kind` is the field kind it defines and whose config is its child sub-field Elements. Instances bind to it by `definitionId`.                                                                                |


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
- **DataFieldDetails**: Expandable section (simple chevron) — the Field's own Data Card. Holds up to three bands: History, Config, Tools for a persisted Field; Config, Kind, Tools for the Add Surface. Which bands exist follows from what the row is. See DataField Management → Field Details below.
- **AddFieldSurface**: The DataCard's create affordance, at the bottom of the FieldList — a Field row that has not decided what it is yet, drawn by the same row shell as a persisted Field. Rendered only when the node's kind admits a field-like child. See The Add Surface.
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
- **Reveal**: A third act, distinct from both. *Re-rooting* makes a node the view; *revealing* shows an element **where it already lives** — bring its owner into view, open that card, centre the row, flash it once on arrival. It is the only way to navigate *to* a Field, which can never be a re-root.
  - **The `→` on a link always reveals, whatever the target's kind.** One glyph, one behaviour: revealing a node still leaves it one tap from being re-rooted, and costs you nothing if that wasn't what you wanted. Giving one affordance two meanings depending on what sits behind it is the thing we removed from `external-link`.
  - The reveal marker is **ephemeral state** — a flash that survived a reload would be a bug — so it never joins the persisted view-state sets. The card expansion it causes is ordinary device-local view state and does persist.

#### Canonical element address

One address form, used for breadcrumbs, reveal, and eventually commands, downloads and pack data. Segments are element names joined by ` / `, root first:

```
Node / sub-Node / sub-sub-Node / Field        the element
Node / … / Field.value                        its value
Node / … / Field/config.units                 a config sub-field's value
Node / … / Field/config.options[]             an array-valued config sub-field
```

The `.value` / `/config` / `[]` terminals are **reserved vocabulary**: the grammar is fixed here so later work doesn't invent a second one, but only the `A / B / C` join is built, and only for display. Nothing parses an address.

A name alone is not an identity — every pump has a "Pressure", every asset a "Colour" — so anywhere a link, a search result or a picker names a target, it must carry enough address to disambiguate. Where the room is one row (a link's value cell), that is the nearest ancestor plus the name, with the full address in the tooltip.

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
- **Create Data Fields**: One **AddFieldSurface** sits at the bottom of the DataCard — a Field row awaiting a name. Typing a name authors a new FieldDefinition; the Kind band beneath it reaches the Library for an existing one. Create commits, Cancel discards. See The Add Surface below.
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

The band region belongs to the row shell rather than to persisted Fields, and it has a second consumer: the Add Surface fills it with **Config, Kind, Tools** (see The Add Surface). Which bands a row shows follows from what the row is, which is why they are a list rather than three nested components.

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

**The chip is not free**, and the cost is architectural rather than visual: chrome entailment runs one way (see *Data Model → Manifest → chrome*), so *"this value is delegated"* has to be something the renderer can **read from the manifest**, never infer from a null. That requirement is the first place `ArbiterSpec` stops being a type and becomes pixels, and it is worth honouring in Phase 1's one-state version so the other two states cost nothing structural later. Tapping the chip through to its source waits on a reveal into the Library lens. [Phase 2+]

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
- **Coalescing**: a repeated same-kind action extends the current toast instead of replacing it, accumulating into one reversal closure ("3 fields added" undoes all three). This exists because single-slot replacement would otherwise make every action but the last irreversible. Coalescing is per action-kind and ends when the toast expires or any other action fires. It is generic; the Add Surface no longer commits in runs (see The Add Surface → *Picking is committing* under Deferred), so today a Create raises a single "Field added" and coalescing waits for its next consumer.
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

- **Undo is not restore.** The 5-second undo window is the Snackbar's whole contribution to recovery; past it, the toast is gone and the Snackbar has nothing more to offer.
- **Restore UI** is a separate concern, and a partial one. A deleted **DataField** is restorable from its node's details panel — a *Deleted fields* list, rendered only when the node has any (2026-08-22). Every other soft-deleted entity, a **node** included, is still recoverable only by clearing `deletedAt` directly in the cloud database. [Phase 2+]: one view for browsing and restoring deleted items across the tree, rather than a per-owner list.

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
  - AddFieldSurface: type to name; ArrowUp/ArrowDown to move between rows within a band, Enter to select, ArrowRight/ArrowLeft to expand/collapse a row, Escape to dismiss. **Deliberately unbuilt for now** — the row's two text inputs sit inside a tree that owns the arrow keys, and settling that conflict is postponed until the surface's shape stops moving.
  - TreeNodeConstruction: Enter to create, Escape to cancel
- **Focus management**: `:focus-visible` ring on all focusable elements; `:focus:not(:focus-visible)` suppresses the ring for mouse users.

### DataField Reordering

Users can reorder DataFields within a DataCard. Whatever the gesture, the commit is settled: `siblingOrder` is renumbered across the affected run (renumber-the-run, never fractional keys — see *Data Model → Sorting policy*), persisted immediately, and logged to history. This is also the point at which gaps left by deletes get compacted.

Reordering matters more than it looks, and for a reason outside this card: `siblingOrder` is the single ordering primitive across every tree. Whatever gesture arranges one asset's fields is the same gesture that will set the order every new node is born with once bindings live in the `config` tree (see LATER.md → *Config-tree UI*). It is learned once and spent twice, which is the argument for choosing it deliberately rather than reaching for the first thing that works.

**The gesture is undecided, and is not part of the Add Surface branch.** One constraint is already known: it cannot hang off the row's chevron, which is spoken for as the Details toggle — a drag handle there would need drag-versus-tap disambiguation on touch, and the two actions are too different to share a target.

Since fields mint at the bottom in the order they were created (see The Add Surface), arranging becomes the natural companion to adding rather than a separate chore — so the sequence is deliberate: the Add Surface lands first, and reorder is designed afterwards, against a card that has fields worth arranging.

## The Add Surface

***Intent:*** *adding a fact to a thing starts by naming it — everything else is a refinement you are free to leave alone.*

The Add Surface is the DataCard's create affordance — the inline-region twin of the CreateNodeButton, which does the same job in the children gutter. It is **entailed, not declared**: it renders iff the node's kind composes `Children(open)` *and* its `allowedKinds` admit at least one field-like kind (`allowedChildKinds(kind) ∩ FIELD_KINDS`). A kind admitting no field-like child offers no Add Surface at all, exactly as a content-free lens offers no create button. (See *Data Model → Manifest → chrome*: an add surface is the rendered expression of a capability, never a component someone remembered to mount.)

**It is a Field row that has not decided what it is yet.** It is drawn by the same row shell as a persisted Field — the same grid tracks, the same chevron column, the same expandable band region beneath — differing only in what fills each slot:


|                 | glyph | name slot    | value slot                | bands                    |
| --------------- | ----- | ------------ | ------------------------- | ------------------------ |
| **persisted**   | ▸     | static label | the kind's Renderer       | History · Config · Tools |
| **Add Surface** | ＋    | name input   | the draft kind's Renderer | Config · Kind · Tools    |


The shell is shared code, not an imitation of one. That is what makes this surface a true preview rather than a second rendering path obliged to resemble the first.

**The Add Surface is not a kind.** Nothing about it is ever stored, so it earns no registry entry (see *Data Model → Earning a kind*); the varying slots above are a **role** on the shared row, not a manifest.

### The row

- **The ＋ rides in the chevron column**, where a persisted Field carries its disclosure triangle. It expands and collapses the bands like any other row.
- **The name is an input at rest** in the label column, with no box chrome — it reads as a label, not a form control. Its placeholder is `Add Field`, darker than an ordinary placeholder, so the row is legible as an affordance rather than as an empty field. Max 50 chars; required non-empty trimmed; becomes the Definition Element's `name`.
- **The name input sizes to its content** inside the card's shared label track, so the column grows as the name is typed — to exactly the width the finished row will have. The row previews its own final geometry, and the card reflows to the truth rather than to a placeholder.
- **The value slot is the draft kind's real Renderer**, buffering its edits instead of writing them. What is on screen while drafting is what the Field becomes.

**The draft starts as `text-kv`.** A name and nothing else, then Create, mints a text Field with an empty value — the shortest complete path through the surface. A value may be entered on the same row first.

### The bands

**Config and Tools carry no heading and no chevron; only Kind does.** On a draft row Config and Tools are not one region among several to choose between — they are the row's whole reason to be open, and a disclosure over them is a toggle with only one useful position. Kind keeps both because it genuinely is optional: the draft starts as `text-kv`, and the shortest path through the surface never opens it. This is the *Stacking is open* latitude being spent, not a departure from it — a persisted Field's Details still stacks History · Config · Tools its own way.

**Config** — the current kind's config rows (see *Authoring a Definition* below), editable while authoring. Its first row is a **memo**: prose naming the kind being created and pointing at the Kind band below. A memo has nothing to enter and nothing to store; it is authoring chrome declared per kind, never a config sub-field.

**Kind** — one row per admitted kind.

- **Selecting a kind** sets the draft's kind, and the Config band above re-renders for it. The name and the entered value survive the change; the config does not — a number's thresholds mean nothing to an enum. Reconsidering the kind mid-draft is a supported move, not a mistake to guard against.
- **The selected kind stays marked as selected.** That is state on the draft, not browser focus, which is transient and would be lost to the next tap.
- **Expanding a kind** lists that kind's Library Definitions beneath it. It is a **view, not a re-parenting** — the gathering reads each Definition's `kind` column, and nothing about how a Definition is stored changes in order for it to appear under its kind.
- **Picking a Definition** loads it into the row: the name fills from the Definition, and the Config band shows that Definition's config **read-only**. Config is `delegated` (see Field Details), so altering what an existing Definition means is not this surface's job.

**Tools** — `Create` and `Cancel`.

### Committing

**Create** does one of two things. In both, whatever sits in the value slot rides along as the new Field's initial value — and where the slot is empty and the Definition carries a `default`, that fills in instead, so a Definition that already says what a new instance starts as mints a Field that is *filled* rather than owed. The slot wins where both speak: it is a statement about this instance, the default about every instance:

- **Authoring** — a name was typed and no Definition picked. Writes the Definition Element and its config subtree (sync-queued, `updatedBy: <currentUserId>`), then mints one DataField instance from it. Authoring and using are one continuous motion.
- **Picking** — a Definition was chosen. Mints the instance only.

The Field lands at the bottom of the card with `siblingOrder` one greater than the last persisted Field, and the surface returns to rest.

**Cancel** discards the draft and returns the surface to rest. **Collapsing the row does not.** The draft survives collapse, and a collapsed row still shows the name and value entered so far. The row wears the **under-construction tint** whenever it holds a draft, open or closed, so an unfinished Field can neither be mistaken for a real one nor lost among them. The draft is in memory: it does not survive a reload.

**Proliferation is intended.** Authoring a Definition is deliberately no harder than picking one, and the only brake on coining a duplicate is that picking an existing one is fewer taps. Curation, merging and gating are later concerns, and they are not authoring-time ones.

### Preview fidelity

The row is the Field, with one unavoidable exception: a kind that suppresses its own label once persisted (a composite, e.g. `single-image`) still shows the name input while drafting, because the Definition being named needs one. The name disappears on mint. A Field that shows no name still *has* one.

### Deferred

- **Search.** Typing into the name slot should first search the Library, so an existing Definition is found by name rather than by walking to its kind. Until that lands, the Kind band is the fast route while adding, and the Library lens (see *The Library*) is the browse route. [Phase 2+]
- **Editing a picked Definition's config**, whether by fork or otherwise (see Edit / Delete Semantics). [Phase 2+]
- **Picking is committing.** An earlier design for this surface minted on pick with no Create step, reversing by Undo rather than Cancel, on the grounds that the row *is* the field so there is nothing to preview. It is **suspended, not discarded**: an explicit Create/Cancel pair is what a draft row needs while its shape is being settled, and the surface may return to immediate commit once it is.
- **Groups beyond the kinds themselves.** Grouping by kind is free because it is a view. Arbitrary user-authored groups are not: a Definition is identified by `parentId === null` (see *The Library → What identifies a Definition*), so it cannot sit beneath a folder Node without ceasing to be one. Identity would have to move off position first. [Phase 2+]
- Typeahead ranking, popularity, "recently added" sort. [Phase 2+]

### Authoring a Definition

Authoring is the app's one deliberate exception to *Minting Records Identity*: a Definition holds an **ephemeral draft** until Create, because unlike a Node or a DataField it must be coherent at birth — a `number-kv` with no units, or an `enum-kv` with no options, is not incomplete but meaningless.

**Config is rows, never a form — one flat list, one row per knob.** No categories, no collapsible tiers, nothing nested. **What varies comes from data, never from a per-kind component**: `visibleWhen` shows a row only when another value calls for it, and `members` expands the one atomic compound (`number-kv`'s thresholds) into sibling rows — presentation of a packed object, not its storage. That is the whole of the variation.

**Flatness is the decision, not the starting point.** Collapsible category groups were built and then removed (2026-08-16), because every config label already stands on its own: the group chevrons hid knobs behind a level of structure that told the reader nothing the labels didn't. **Where a category label is genuinely load-bearing it belongs in the sub-field's own label** — `Low low` became `Threshold LL` when the `Thresholds` parent row went away. Reintroducing depth is a spec change, not a styling one; the removed reasoning is in SUPERSEDED, and the terms for its return are in LATER → *Config authoring: progressive disclosure*.

`visibleWhen` is not a category and survives: it hides a row that is *irrelevant* to the current config (`currencyCode` under a non-currency format), which is a different claim from filing one under a heading.

```
＋ [ Discharge Pressure ]   [ 145 ] psi
   ▾ CONFIG
       Creating a Number field — pick a different Kind below to change that
       Units symbol      psi
       Decimals          1
       Nominal min       120
       Nominal max       160
       Threshold LL      —
       Threshold HH      —
       Refresh seconds   —
   ▾ KIND
       ▸ Text
       ▾ Number  ●
           Pressure
           Hours Run
       ▸ Enum   ▸ Image
   ▾ TOOLS
       Create   Cancel
```

**Cross-field invariants are validation, not components.** A rule that spans sub-fields — `default ∈ options`, `currency ⇒ currencyCode`, the threshold chain — belongs to the kind rather than to any one row, and is enforced on every write. A rule that concerns one sub-field alone stays that sub-field's own guard. **No kind needs a bespoke authoring form**; the rows plus these two validation layers are the whole of it.

Required config is enforced before Create, which is disabled while anything blocks it; everything else takes the kind's defaults and may be left alone.

**The Add Surface only ever *adds*.** And nothing else edits either: a Definition is **forked, never mutated** (see *Edit / Delete Semantics for FieldDefinitions*), and the Library lens that lists Definitions is read-only. Minted from everywhere, mutated nowhere.

## DataField Components and Crowdsourced Library

***Intent:*** *the kinds of fact the app understands are grown by the people using it, not rationed by developers or managers.*

### Conceptual hierarchy

Three layers — each is the precondition for the next:

1. **kind manifest** — dev-authored code: a `Renderer` + capability subset + descriptors, keyed by `kind` (e.g. `"text-kv"`, `"number-kv"`) in the registry. The closed set is owned by the dev team; users cannot author kinds (see *Data Model → Earning a kind*).
2. **FieldDefinition** — a Library entry: a field-like Element of the kind it defines, living in the `library` tree, whose **config is its child sub-field Elements** (units, thresholds, flags — not a config blob). Definitions are what users pick from in the Add Surface's Kind band and what the Library lens lists. Both dev-seeded and user-authored entries are the same species.
3. **DataField** (instance) — an Element minted from a Definition, attached to a Node, holding one typed `value` and bound to its Definition by `definitionId`. Its `kind` is the Definition's kind. Today it **delegates** all config, reading live from the Definition — indistinguishable from copy-at-mint while a Definition is forked, never mutated; `disposition: owned` is the encoded, unwired copy-at-mint pin. `name` is snapshotted at creation.

```
kind manifest (code: Renderer + capabilities + descriptors)
  └── FieldDefinition (library-tree Element; kind = what it defines; config = child sub-field Elements)
       └── DataField instance (Element on a Node: + value + definitionId binding)
```

The word **Template** is reserved for a future feature: a *set* of Definitions bundled as a unit (e.g. "HPU with Accumulator"). Templates are out of scope for the Library work, and nothing in Phase 1 uses the word "Template".

### Phase 1 field kinds

Four field-like kinds, specced in **ELEMENT-MODEL.md → Field-like kinds**:

- `text-kv` — free-form text
- `enum-kv` — selection from a fixed option list
- `number-kv` — number with units, display format, nominal value or range, alarm thresholds, and freshness expectation
- `image` — one image attached to a field (`image-with-caption` adds a caption sub-field)

Two more field kinds exist and are currently reachable only inside config, because config is the only place they have been needed: **`flag`** (boolean) and **`string-list`** (list of strings). They are excluded from the Add Surface's picker by `mintVia: 'config-only'`, which is a statement about where they have been used, not about what they are — "Greased ☑" is a perfectly good field on a pump. Opening them up is deferred, not ruled out (LATER → *Config-only kinds excluded from the picker*).

Additional field kinds (`date-kv`, `composite-kv`, `image-carousel`, `image-grid`, `asset-gallery`, …) are catalogued in ELEMENT-MODEL.md; build is deferred. [Phase 2+]

### The Library

***Intent:*** *the vocabulary a team works in is something they can walk to, read and compare — not a hidden schema.*

The Library is a **lens, not a place things live**. A `Field Library` Node sits pinned at the top of the ROOT view; re-rooting into it shows two children, **Field Definitions** and **Kinds**; each is a lens whose listing is **gathered, never stored** — the same shape as `jobs`, which lists every `job` below its parent without owning one. Definitions stay exactly where and what they are — roots of the `library` tree, Elements of the kind they define — and the lens reads them there. Nothing about a Definition changes in order to appear in the Library.

It is one of two surfaces over the same population: the Add Surface's **Kind band** is for *using* the Library while adding a field (see The Add Surface); the Library lens is for *reading and comparing* it. Neither **writes** anything (see Edit / Delete Semantics) — the Library's previews can be manipulated, but every edit lands in state local to the preview and dies with it.

*(An earlier design made the Library a **place** — Definitions re-parented as `kind: node` children of a Library Node, identity moved to `definitionId === id`, the defined kind demoted to a config Field, config materialized, edit-in-place with downstream propagation. It was prototyped and rejected 2026-08-20: it rewrote a whole population's storage to buy what a gather gets for free. The full text is in SUPERSEDED.md. What survives of it is this section's frame: `treeType` as a routing tag, no switcher, and the Library entered from a Node on ROOT.)*

#### One tree, no switcher

There is no tree switcher, and `ViewState` carries no `treeType` — the Library is an ordinary `BRANCH`, reached by re-rooting into a Node like anything else.

`treeType` is a **routing tag on the Element, not a place**: it selects which audit log a change files under and whether the Element syncs at all (see *Populations are typed trees*). `business` and `library` sync identically; the only thing that separates them is the audit log, which is what keeps Library writes out of the maintenance record.

This supersedes the earlier *tree switcher on the ROOT view (Assets / Config / Library)* sketch: the `config` tree will arrive the same way the Library does, as a Node you walk to.

#### One global, shared Library

There is exactly **one** Library — the `library` typed tree (see *Data Model → Populations are typed trees*) — shared across all users via sync. **Authoring is contributing**: every user-authored Definition becomes visible in every other user's Kind band the next time their client syncs. There is no private/public toggle, no per-workspace scope, no opt-in import step, no moderation, no "personal vs. community" tabs in Phase 1. The Add Surface and the Library lens are the discovery surfaces.

Consequences worth being explicit about:

- A user's authored Definitions are visible to all other users immediately.
- Two users can independently author entries with the same `name` — both will appear in the Library. Label uniqueness is not enforced, and cheap authoring means duplicates are expected rather than exceptional (see The Add Surface → *Proliferation is intended*). Deduplication / merging is a future concern.
- Once authored and synced, a Definition cannot be removed by any end user (see Edit / Delete below).

Privacy implication for the user: labels may carry proprietary information (e.g. a specific manufacturer's serial-format field name). Users should know that what they author is shared. Surfacing this expectation in the authoring UI is a UX concern tracked in ISSUES.md, not a SPEC-level toggle.

#### Where the Library lives

- **A typed tree, not a side table**: a Definition is an `Element` with `treeType: library`, whose `kind` column carries the field kind it defines and whose config is its child sub-field Elements. It syncs, history-tracks and reverts like any other Element. (Landed 2026-06-27 — config-as-Elements; the old separate `fieldDefinitions` Dexie table was dropped in schema v10.)
- **A Definition is a root of that tree** — `parentId: null`, which is also what identifies it (see below). The Library lens gathers it there; nothing re-parents it.
- **Sync**: Library Elements ride the same bidirectional sync as business Elements (Push-then-Pull, LWW on `updatedAt`, queued through `SyncQueueManager`), routed by `treeType` for history/visibility.
- **Seed entries** (the starter set): written client-side on first run, idempotent via a seed version. Seed writes bypass the sync queue — seeds are identical per client, and syncing them would produce N redundant writes per N clients. Their stable deterministic ids let the UI reference defaults by constant (`DEFINITION_IDS`), not by label.
- **User-authored entries**: enqueue through the sync queue like any other user write; appear on other clients on next pull.

#### Three kinds, three Elements, no migration

The Library surface's whole storage footprint is **three seeded chrome Elements**, all `treeType: library`, written by the seeder with the other seeds (constant ids, idempotent via the seed version, bypassing the sync queue):

- **`library`** — the `Field Library` root: `parentId: null`, seeded at `siblingOrder: -1`, which *is* the "pinned above the business roots" rule — ROOT already sorts by `siblingOrder` and business roots start at 0, so no view special-cases it. (`listRootElements` must widen to admit it: the ROOT gather currently filters `treeType: 'business'`, and the Library root is recognised by its `kind`.)
- **`definitions`** — the `Field Definitions` lens, child of the root.
- **`kinds`** — the `Kinds` lens, child of the root.

Each is a **new registry kind**, which is the framework's sanctioned move — new surfaces ship as new manifests, not new tables. Being kinds rather than plain `node`s is load-bearing three times over: the provisioner's per-node lenses (Jobs, Logbook) never attach to them; the affordances they lack (delete, rename, add surfaces) are ordinary chrome entailment — the manifest simply doesn't draw them, so non-deletability needs no permissions machinery; and the `kind` column is what excludes them from Definition identity (below).

Seeding all three is the v1 choice; the two children could instead ride the lens provisioner (`${parentId}::definitions`, the `jobs` pattern) — tracked in ISSUES, not built.

#### The gather

- **Field Definitions** lists every active **field-like** Definition — a root of the `library` tree whose `kind` is field-like — sorted by `name` (every Definition mints at `siblingOrder: 0`, so name is the only order there is). Re-root policy Definitions (`fd_logbook_policy`) are excluded, exactly as the Add Surface's inline listing excludes them; whether they ever list here is open.
- **Kinds** gathers from **code, not storage**: the registry — each admitted field kind with its config schema and defaults, the same admission the Add Surface's Kind band uses. There is no Element behind any row.
- Both gathers are pure reads, hardcoded for v1 the same way `listRootElements` hardcodes the `business` population for ROOT. Making population gathers an explicit `SourceSpec` relation is tracked in ISSUES.

#### The preview is a live microcosm

Each gathered Definition draws as a **Node row plus a one-field card**: the row carries the Definition's `name` with its id as the subtitle (the interim answer to duplicate labels); the card beneath holds one instance of the field, drawn by the kind's own Renderer and bound by `definitionId`. Nothing is minted and nothing is stored — the rows and cards are the lens's rendered expression of the gather, which is what chrome is (*Manifest → chrome*).

The instance is **live, not a picture**. Its Renderer runs in `pendingMode` over state local to the preview, so an enum's options can be switched and a number typed into, with the kind's own validation and threshold states computing as they would in the field — and none of it reaches the command bus, storage, history or sync. A static render shows what a Definition *looks* like; only a live one shows what it *does*, and what distinguishes two Definitions of the same kind is exactly their behaviour — this one's options, that one's thresholds and units. Reading the Library is comparing behaviours, so the preview has to have some.

*(This section first specced a strictly inert preview, and it was built that way. Making it live came out of hand-testing, 2026-08-20: inertness bought nothing the synthetic id did not already guarantee — no command can target a row with no Element behind it.)*

- **The value starts where the kind says it should.** A manifest may declare `previewSeed(config)` — the microcosm's opening state, computed from the Definition's own config. `enum-kv` seeds its first configured option, so the row opens on a real choice rather than an empty slot. A kind declaring none starts unfilled, reusing the empty state it already draws; no placeholder vocabulary is invented. A kind that suppresses its own label once persisted (e.g. `single-image`) shows nothing in the card — its name is on the Node row above.
- **The Details bands stay live**, because a Definition is an object and has all three: History (empty here — nothing has happened to a preview), Config, and Tools, which carries the row's id and a **disabled** Delete. Disabled rather than absent: what a deployed field offers is part of what the preview is showing.
- **Config in the preview is schema-complete** — one row per knob the kind declares, `—` where the Definition stores none. This deliberately *departs* from how a deployed instance renders config, where an unset knob simply doesn't render because config is sparse child Elements. The two surfaces answer different questions: on a node you are reading *this field*, and absent knobs are noise; in the Library you are reading *what this kind offers*, and the absent knobs are the information. It is display-only — the rows are the kind's schema unioned with whatever sub-field Elements exist, computed at render. **No sub-field Element is ever created**, so "materialized" describes rows on screen and never storage behind them. `number-kv`'s thresholds render as the one atomic `compound` value they are.

#### Kinds are archetypes, not objects

A Definition has a canonical look because it carries config — a label, units, options, thresholds. A bare kind carries none of that, so no single instance honestly represents it. What a kind does have is the pair the Add Surface already draws: **a live instance and the knobs that shape it**. Each Kind node holds exactly that — the kind's Renderer over local state, above the same live config rows the Add Surface authors with, seeded from the manifest's `defaultConfig()`.

Turning a knob re-renders the instance above it: type options and the enum gains them; set a threshold, enter a value, and it lands in its band with the state colour that implies. That is the same `FieldRendererProps.config` wiring that lets an Add Surface draft preview the options being typed (*The Add Surface → The row*), with the authoring removed — nothing here mints a Definition, writes an Element, or issues a command.

The three Details bands are **absent** on a Kind node where a Definition preview keeps them: with no instance there is no history, with no Definition there is nothing for Config to read, and there is nothing to delete. Their absence is the archetype/object distinction made visible, not a simplification. The Add Surface's `authoringMemo` is likewise not shown — it points at a Kind band that exists only while minting.

#### What identifies a Definition

**A root of the `library` tree whose `kind` is field-like.** `parentId === null` in the `library` tree was the whole test while Definitions were that tree's only roots; the three Library chrome Elements now share it, so the `kind` column completes the test — chrome kinds (`library`, `definitions`, `kinds`) are never Definitions, and a Definition's kind is always the field kind it defines. (The inverse — `parentId !== null` in the `library` tree meaning "config sub-field" — needs the same kind-awareness: the two lens children are parented and are not config.)

Identity riding on position is what keeps arbitrary grouping of Definitions deferred: a Definition cannot be given a parent without ceasing to be one (see *The Add Surface → Deferred*).

#### Listing under the Kind band

See *The Add Surface → The bands* for the listing and what is deferred. Two consequences belong here rather than there:

- **The Library has no order of its own.** Every Definition is minted at `siblingOrder: 0`, so the Kind band and the Library lens both sort by `name`.
- **Grouping by kind costs nothing structural.** The Kind band gathers Definitions by their `kind` column and renders them beneath their kind, never re-parenting; the Library lens's flat listing reads the same population the same way. One gather, two surfaces.

### FieldDefinition Authoring

The authoring surface is specced with the row that hosts it — see *The Add Surface → Authoring a Definition*. What belongs here is the data side:

- The kind's **config schema** is its manifest `ChildrenSpec` over config sub-field kinds (template core + open tail); authoring fills those sub-field Elements (see *Data Model → Config is Elements*, and ELEMENT-MODEL.md for each kind's config).
- **Required config is enforced before commit** — `enum-kv.options` non-empty, `number-kv` units. `number-kv`'s threshold invariants (`LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` in range mode; the equivalent chain across `(nominalValue ± tolerance)` in discrete mode) are validated at authoring time as a **cross-field rule on the kind**, which is what a per-kind authoring component used to exist for.
- The draft carries **its own ephemeral state shape**, distinct from anything a DataField uses: no DataField exists yet, so there is nothing for a value draft to attach to. It is not persisted — dismissing discards it.

### Edit / Delete Semantics for FieldDefinitions

**Phase 1 ships with no user-facing edit or delete of FieldDefinitions**, and the Library lens writes nothing — its previews are manipulable, but the edits are local to the preview and never reach storage (see *The Library → The preview is a live microcosm*). This is a deliberate simplification, not an oversight — multi-user identity and permissions don't exist yet, so any edit/delete UX is premature.

- **Edit is conceptually "fork"**: any future affordance that looks like "edit this Definition" (label, config, or both) **mints a new Definition** rather than mutating the existing one. The original is untouched; downstream instances remain bound to what they were minted from. This sidesteps cascading config changes (e.g. a unit change on a `number-kv`) and the question of which user is authorised to edit a shared entry. `definitionId` *is* the version — there is no `componentVersion` and no migration runner.
- **Delete is admin-only**: end users cannot delete Definitions — not their own, not others'. Bad or duplicate entries are removed by the dev team directly in Firestore. `deletedAt` exists for forward compatibility and the rare admin tombstone; no client write path sets it. Soft-deleted Definitions are filtered out of the Kind band and the Library lens alike, so the Library is **not** a recovery surface.

An edit-in-place design — mutate the Definition, propagate downstream to every bound instance — was specced and prototyped (2026-08-17/18) and rejected with the place-design it rode on; its text is archived in SUPERSEDED.md. **Upstream propagation** (an instance edit rewriting its Definition) was rejected outright under both designs and stays rejected.

Per-user delete UX, ownership-based permissions ("you may edit/delete your own"), edit-as-fork affordances, and label-uniqueness / dedup logic are all deferred to LATER.md and revisited once real multi-user identity lands.

### Default DataFields at Node Creation

Every new node is born with three DataFields, minted unfilled by the construction transaction:

- **Type Of** (`text-kv`)
- **Description** (`text-kv`, `multiline: true`)
- **Tags** (`text-kv`)

They are **node-creation policy, not a rendering side effect** — they arrive whether or not any add surface was ever mounted. Once the node exists they are ordinary DataFields: editable, deletable, reorderable like any other. Nothing locks them, because there is no longer a checkbox to lock; a user who deletes "Tags" from one pump has simply decided that pump doesn't need it.

Which three is a **binding**, and it now lives where bindings belong: it is `constructionDefaults` in the active pack, not a constant in code (see *The starter Library* below). The pack is still the app layer of a cascade whose upper layers — org, role, user — are deferred to the `config` tree (LATER.md → *Definition Packs*). The eventual affordance is provenance rather than prohibition: a default field can say *where it came from* and let the user navigate there, which defers permissions to the place they land instead of a role check at the field.

Node creation reads the binding through `constructionDefaults()` and never by label; the pack names the three by stable ID (`DEFINITION_IDS`).

### What stays in LATER.md (Phase-2+)

- **Templates** (composite sets of FieldDefinitions, e.g. "HPU with Accumulator") — distinct, larger feature.
- **Library discovery UX**: typeahead filter (see The Add Surface → Deferred → *Search*), user-authored groups beyond the kinds (blocked on identity-by-position — see *What identifies a Definition*), popularity ranking, "recently added" sort.
- **Moderation / promotion to canonical** for crowdsourced entries.
- **User-facing edit/delete** of Definitions with real ownership rules; edit stays conceptually fork (see *Edit / Delete Semantics*).
- **Label uniqueness / dedup / merge** flows.
- `**number-kv` per-instance metadata**: a user-set Valid-Until date on each entered value (distinct from the config-level `expectedRefreshSeconds`); per-instance Priority/Severity, Redaction Rule, Source. These belong on the instance Element, not in the Definition's config, and interact with history/audit in ways the other knobs don't.
- `**number-kv` unit conversion at display time** (e.g. user-preferred metric/imperial). Storage stays canonical; display does the work.
- **ISO-4217 currency-code picker** for `number-kv` `currencyCode`. Phase 1 is free-text.

(Recursive sub-field composition and reusable config sub-shape extraction are no longer deferred items — config **is** child Elements; see *Data Model → Config is Elements*.)

### Field-kind specs → ELEMENT-MODEL.md

The full per-kind specifications — composition, value shape, config sub-fields, and edit / display / validation UX — live in **ELEMENT-MODEL.md → Field-like kinds**, one self-contained entry per kind. Phase-1 field kinds: `text-kv`, `enum-kv`, `number-kv` (the deliberately rich one), `image` / `image-with-caption`. The `number-kv` entry is the canonical exercise for the progressive-disclosure + value-driven conditional-reveal authoring patterns the wider Library-authoring UI reuses.

(The former `single-image` kind — which crammed image + caption into one value object — is superseded by `image` + `image-with-caption`, where the caption is a sibling `text-kv` sub-field and so gains its own history.)

### The starter Library — a bundled Definition Pack

Phase 1 ships a **pack**: a set of Definitions (Library-tree Elements, `updatedBy: "appDeveloper"`) plus the bindings that point at them, so the Library is non-empty on first run and a new node is born useful. The user-authoring path grows the Library from there.

The pack is **bundled into the app build** (`src/data/packs/defaultPack.ts`) — compiled in, so loading cannot fail and the app never boots packless. Loading a pack from a file, from an org layer, or by user upload is deferred (LATER.md → *Definition Packs*).

**`defaultPack.ts` is the authoritative list of rows.** It is not restated here: the enumeration lived in this document once, drifted from the code within a release, and the drift was itself filed as an issue. What this spec owns is the *shape* of the set:

- **30 Definitions**, covering general industrial maintenance, simple manufacturing and agricultural machinery — human maintenance and manual entry, never telemetry.
- Only kinds the app has today: `text-kv`, `enum-kv`, `number-kv`, `single-image`, `internal-link`, `logbook`. Dates are `text-kv` holding an ISO string (`date-kv` is [Phase 2+]).
- Grouped as: identity and description (Description, Type Of, Tags, Location, Serial Number, Part Number, Manufacturer, Model, Status, Installed Date, Weight, Power Rating, Note, Main Image); maintenance and service (hours, service dates and intervals, criticality, condition, safety notes, supplier); fluids, consumables and spares (fuel, lubricant, oil capacity, filter part number, grease points); and nameplate/operating values read off a gauge by hand.
- One row is not a field at all: `Logbook Policy`, the `logbook` policy Definition each provisioned Logbook container binds (see *Definition binding*).

**The bindings ship with the pack, not as constants in code.** Three of them: `constructionDefaults` (the Definitions every new node is born with — `Type Of`, `Description`, `Tags`; see "Default DataFields at Node Creation" above), `lensPolicies` (lens kind → its policy Definition), and `lensNames` (lens kind → the container's display name). Consumers read them through resolver functions rather than reaching into the pack, which is the seam the `config`-tree cascade eventually resolves instead.

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

- **Config sub-fields are ordinary field-like kinds, always** — a units sub-field is an `enum-kv`, decimals/staleness are `number-kv`, multiline/requireCaption are `flag`, an option list is a `string-list`. A kind's **config schema** is just its manifest `ChildrenSpec` over those kinds (template core + open tail); `ValueSpec` carries only the *own* value. `flag` and `string-list` are not a config-only species: they are the **boolean** and **list** field kinds, named for the only place they are used today (see *Phase 1 field kinds*).
- **There is no object-valued residue.** `compound` is retired: `thresholds: {LL,L,H,HH}` was four numbers in one slot, and the authoring UI already drew it as four flat sibling rows. It is four ordinary `number-kv` sub-fields, so storage matches presentation, each threshold gets its own history and its own edit, and the `LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` chain stays what it already was — a cross-field validator on the kind, not a value shape. The atomicity that a compound bought is given up knowingly: a decomposed chain can tear under concurrent offline edits, which is allowed, flagged and revertible (see *Granularity is a choice* below).
- **Locking — three mechanisms, no new primitive**, hardest to softest: `kind`-immutability (the units sub-field's kind is `length-unit`; "= mass" is not in its vocabulary); `template` presence-lock (the fixed config core minted by `onCreate`, not user-removable); cascade `pin` (a Definition author pins a sub-field so instances can't override).
- **Disposition — owned · delegated · pinned** — set per sub-field, all branches of inherit-unless-override: **owned** (copied at mint; Definition edits don't propagate — meaning-defining config like units/thresholds), **delegated** (absent at mint, read live; Definition edits propagate — cascade config like criticality), **pinned** (delegated with override disabled).
- **Renderer reads sub-fields directly** as reactive signals — no persisted/synced derived config object (it would be a second source of truth racing the children under LWW). Reading own children is a bounded, local read.
- **Granularity is a choice, and it has been made: decomposed.** Config can tear under concurrent offline edits (`L` and `H` converging to `L > H`); this is allowed, flagged and revertible. Validation is **advisory** by default. The atomic compound was the escape hatch for values where a wrong combination is *dangerous* rather than merely silly — it is retired (above) because the one candidate did not need it, and if a genuinely dangerous co-varying set ever appears the argument for atomicity has to be made again on its own merits, not inherited.
- **Termination (⊥).** Each level's sub-field is a strictly smaller kind than its parent, until one declares no config (a pin is a boolean; a boolean's config is `{}`). The recursion cannot cycle because the chain strictly descends.

### The cascade — one arbiter, three jobs

`inherit-unless-override` is shadow-and-delegate: an own value present shadows; absent, it delegates upward (a Derivation reading `ancestors/transitive` — the nearest ancestor that has a value) and recomputes. Inheritance is therefore the same `SourceSpec` as aggregation, pointed up. One arbiter serves three jobs:

1. **Business value inheritance** down the asset tree (criticality, rated pressure) until a node sets its own.
2. **Definition specificity** — general → narrow → instance; a narrow Definition stores only overrides and delegates the rest (config-as-Elements + inherit-unless-override *is* the specificity spectrum).
3. **App → org → role → user config** down the authority hierarchy, each layer's prefs being Fields on a Node.

**Audit-safe by construction:** config and prefs file in **Library / overlay** history, not business history, so delegating them touches no business audit. A Definition is **forked, never mutated** (editing one mints a new id; existing instances stay bound to the one they were minted from); `definitionId` *is* the version, so there is no `componentVersion` and no migration runner. `disposition: owned` is the encoded, unwired per-sub-field copy-at-mint pin — inert today, since a Definition that never changes makes live-read and copy indistinguishable.

### Populations are typed trees

**`treeType` is a routing tag, not a navigational partition.** There is one tree and one navigation: `Up` walks `parentId` to a root, then to the ROOT view, never above a root, and no view state is parameterised by `treeType`. The ROOT view lists the business-tree roots **plus the `Field Library` lens Node**, pinned above them (see *The Library → One tree, no switcher*). What the tag selects is policy only — which audit log a change files under, and whether the Element syncs:

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

**Purpose:** A Library entry — a field-like Element of the kind it defines, living in the `library` tree (`treeType: library`, `parentId: null`), whose config is its child sub-field Elements. Instances bind to it by `definitionId`. It is **not a separate entity**: its columns are the Element columns (`kind` = the kind it defines, `name` = the label), and it has no `config` column — config is its subtree.

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
- Restoration: see Snackbar & Undo for the 5s undo window. Beyond it, a deleted DataField is restorable from its node's details panel; every other kind is still cloud-db-only. [Phase 2+]: one in-app view for browsing and restoring deleted elements across the tree.

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
- Backgrounds are white or near-white; colour is reserved for interactive affordances (accent blue for focus/links, red for destructive actions). The **unfilled** field state (see DataField States) is drawn by de-emphasis — a muted **label**, with the value column left to whatever empty affordance its renderer already draws — not by a colour, because it marks an absence rather than an action. Dimming the label is what makes it scannable: the label column reads as a work list down the card, uniformly across every kind
- **Under construction is the one background hue.** A row holding an uncommitted draft (the Add Surface, see The Add Surface → Committing) is tinted by its own semantic token — a hue, not another grey, because it must not be read as the expanded-field shade it sits inside. It says *this does not exist yet*, which is a different claim from unfilled (*exists, holds nothing*) and must not look like it. The tint is worn whenever a draft is held, including while the row is collapsed
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