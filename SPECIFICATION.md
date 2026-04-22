# Asset Tree Management Specification

## Overview

Asset maintenance and management app for physical assets (vehicles, buildings, industrial machinery, etc.) using a recursive tree structure where nodes represent things and their parts.

Unlike common tree view UIs where each node only has a name, this app has four levels of knowledge structure:

- Level I: Nodes represent things and their constituent parts. The structure, what parent and child hierarchical relationships ARE the first level of information.
- Level II: Data pertaining directly to one Node; facts, attributes, properties, characteristics, etc. of the Node itself. Each Node has one Data Card containing any number of Data Fields (facts about that thing). The Node's own Title and Subtitle are on this level conceptually, but reside above the Data Card in a Node Header.
- Level III: Each Data Field has a Field Details section containing context (e.g., metadata) and management actions (e.g., delete).
- Level IV: Each Data Field has a user‑facing history of previous Field values.
- Level V: The fifth level of knowledge presentation/interaction is the "meta" level: Help, App Training, App Feedback. These are fully contextualized at every point, every UI affordance, within the tree view. UI intention is a seperate layer of "i" icons, which may be hidden.  [Phase 2+]

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
- **Create Data Field**: [DONE] A "+" button at bottom of DataCard opens a dropdown to select from the DataField Library (Templates table). Creation is selection-only; users cannot author new Templates in Phase 1. [Phase 2+]: user-authored Templates.
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
  dismiss(): void;            // dismisses current toast without running handlers
}

interface ToastInput {
  message: string;
  variant?: "success" | "error" | "info";   // default "success"
  durationMs?: number;                      // default by variant
  action?: {
    label: string;                          // e.g. "Undo", "Retry"
    handler: QRL<() => void | Promise<void>>;
  };
  onExpire?: QRL<() => void | Promise<void>>;  // runs if the toast auto-dismisses WITHOUT the action being invoked; used for deferred-write tails (see Undo semantics)
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

### DataField Components, Templates, and Library

DataFields are instances of **DataField Components**. A DataField Component is a dev-authored contract defining how a field renders, edits, validates, stores its value, and records history. Components are a bounded set identified by `componentType` (e.g. `"text-kv"`, `"enum-kv"`). Users do not author Components.

A **DataFieldTemplate** is a library entry: a `componentType` + `config` + user-facing `label`. Templates are persisted (see Data Model) and are what users select when adding a field to a node. The Library is the set of all Templates. Phase 1 ships dev-seeded Templates; user-authored Templates [Phase 2+].

A **DataField** (instance) references a Template and stores its own typed `value`. The `componentType` is denormalized onto the DataField for dispatch.

```
Component (code)  ──▶  Template (persisted, selectable)  ──▶  DataField instance (on a node)
```

**Phase 1 componentTypes**: `text-kv`, `enum-kv`, `measurement-kv`, `single-image`. Additional Components (number-kv, date-kv, composite-kv, image-carousel, image-grid, image-aggregator, …) [Phase 2+].

#### Component: `text-kv`

**Purpose**: Free-form text. Current Phase-1 default.

**Template config**:
| Field       | Type     | Default | Notes                              |
| ----------- | -------- | ------- | ---------------------------------- |
| maxLength   | number?  | 500     | Hard limit on input                |
| multiline   | boolean  | false   | `true` renders a textarea          |
| placeholder | string?  | —       | Shown when value is empty          |

**Instance value**: `string | null`

**Edit UX**: Single-line input (or textarea if `multiline`). Double-tap activates edit. Enter saves, Escape cancels. If `multiline`, Enter inserts newline and Cmd/Ctrl+Enter saves.

**Display UX**: Plain text. Multi-line renders with preserved line breaks.

**Validation**: length ≤ `maxLength`.

#### Component: `enum-kv`

**Purpose**: Selection from a fixed option list (Status, Condition, Category, …).

**Template config**:
| Field       | Type     | Default | Notes                                       |
| ----------- | -------- | ------- | ------------------------------------------- |
| options     | string[] | —       | **Required.** Selectable values.            |
| allowOther  | boolean  | false   | If `true`, user may enter an ad-hoc value   |
| default     | string?  | —       | Pre-selected on new instance                |

**Instance value**: `string | null` — must match an `options` entry unless `allowOther`.

**Edit UX**: Dropdown. If `allowOther`, final item is "Other…" which reveals a text input.

**Display UX**: Plain text. Option styling (badges, colors) [Phase 2+].

**Validation**: value ∈ `options` (or `allowOther === true`).

#### Component: `measurement-kv`

**Purpose**: A numeric quantity with semantic units and optional operating ranges (Pressure, Temperature, Current, Flow Rate).

**Template config**:
| Field       | Type     | Required | Notes                                               |
| ----------- | -------- | -------- | --------------------------------------------------- |
| units       | string   | Yes      | Canonical unit label (e.g. `"PSI"`, `"°C"`, `"A"`)  |
| decimals    | number?  | No       | Display precision (default 2)                       |
| nominalMin  | number?  | No       | Lower bound of normal operating range               |
| nominalMax  | number?  | No       | Upper bound of normal operating range               |
| warnLow     | number?  | No       | Below this is a warning state                       |
| warnHigh    | number?  | No       | Above this is a warning state                       |
| absoluteMin | number?  | No       | Input rejected below this                           |
| absoluteMax | number?  | No       | Input rejected above this                           |

**Config invariants** (enforced at Template creation):
`absoluteMin ≤ warnLow ≤ nominalMin ≤ nominalMax ≤ warnHigh ≤ absoluteMax`. Any subset may be omitted; provided values must satisfy the chain.

**Instance value**: `number | null`. Units are **not** stored per-instance — they come from the Template and are fixed for the field's life. Unit conversion [Phase 2+].

**Edit UX**: Numeric input with fixed units label. Helper text summarizes nominal range if configured.

**Display UX**: `{value} {units}` with visual state: **ok** (within nominal), **warn** (outside nominal but within warn range), **alarm** (outside warn range). Subtle background color on value in Phase 1.

**Validation**: within `[absoluteMin, absoluteMax]` if set. Warn/nominal are informational, not blocking.

#### Component: `single-image`

**Purpose**: One image attached to a field (Asset Main Image, Nameplate Photo, Field Observation).

**Template config**:
| Field          | Type     | Default | Notes                                     |
| -------------- | -------- | ------- | ----------------------------------------- |
| maxSizeMB      | number   | 5       | Reject uploads above this size            |
| requireCaption | boolean  | false   | Caption shown and required                |
| aspectHint     | string?  | —       | e.g. `"4:3"` — display hint, not enforced |

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

### DataField Library (seeded)

Phase 1 ships with a set of dev-seeded Templates selectable during DataCard `isUnderConstruction`. Creation is selection-only; user-authored Templates [Phase 2+]. A non-exhaustive starter set:

| Label           | componentType    | Notes                                                       |
| --------------- | ---------------- | ----------------------------------------------------------- |
| Description     | text-kv          | `multiline: true`                                           |
| Type Of         | text-kv          | User-defined categories                                     |
| Tags            | text-kv          | Comma-separated values (structured tags [Phase 2+])         |
| Location        | text-kv          | Physical location                                           |
| Serial Number   | text-kv          | Manufacturer serial                                         |
| Part Number     | text-kv          | Manufacturer part number                                    |
| Manufacturer    | text-kv          | Equipment manufacturer                                      |
| Model           | text-kv          | Equipment model                                             |
| Status          | enum-kv          | `options: ["In Service", "Maintenance", "Retired"]`         |
| Installed Date  | text-kv          | ISO date; date-kv Component [Phase 2+]                      |
| Weight          | measurement-kv   | `units: "kg"`                                               |
| Power Rating    | measurement-kv   | `units: "W"`                                                |
| Note            | text-kv          | `multiline: true`                                           |
| Main Image      | single-image     | `requireCaption: false`                                     |

### Default DataFields ... Added at node creation time. [DONE]

- **"Type Of"**: Such as "Vehicle", "Building", "Machine", "Equipment", "Tool", "Other" (arbitrary string entered by user, no entry required).
- **"Description"**: A short description of the asset. (No entry required)
- **"Tags"**: A list of classification tags (arbitrary comma-separated strings entered by user. No entry required).

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

#### DataFieldTemplate Entity

**Purpose:** A library entry: a `componentType` + `config` + `label` that users select when adding a field.

| Field         | Type          | Required | Description                           | Constraints                                         |
| ------------- | ------------- | -------- | ------------------------------------- | --------------------------------------------------- |
| id            | string (UUID) | Yes      | Unique identifier                     | Generated client-side; canonical ID                 |
| componentType | string        | Yes      | Which Component this Template targets | One of the Phase 1 componentTypes                   |
| label         | string        | Yes      | User-facing field name                | Max 50 chars                                        |
| config        | JSON          | Yes      | Component-specific Template config    | Shape discriminated by `componentType` (see above)  |
| updatedBy     | string        | Yes      | User ID of last editor                | Valid user ID                                       |
| updatedAt     | timestamp     | Yes      | Last modification time (epoch)        | Client-assigned; server-assigned [Phase 2+]         |

#### DataField Entity

**Purpose:** An instance of a DataField Component, attached to a TreeNode, storing one typed value.

| Field         | Type          | Required | Description                             | Constraints                                                 |
| ------------- | ------------- | -------- | --------------------------------------- | ----------------------------------------------------------- |
| id            | string (UUID) | Yes      | Unique identifier                       | Generated client-side; canonical ID                         |
| templateId    | string (UUID) | Yes      | Reference to `DataFieldTemplate.id`     | Must exist in `DataFieldTemplate` table                     |
| componentType | string        | Yes      | Denormalized from Template for dispatch | Must match Template's `componentType`                       |
| fieldName     | string        | Yes      | Display label                           | Snapshot of Template `label` at creation; max 50 chars      |
| parentNodeId  | string        | Yes      | Parent TreeNode reference               | Must exist in TreeNode table                                |
| value         | JSON \| null  | Yes      | Typed value; shape discriminated by `componentType` | See per-Component value shapes above            |
| cardOrder     | number        | Yes      | Display ordering within DataCard        | Auto-assigned on creation                                   |
| updatedBy     | string        | Yes      | User ID of last editor                  | Valid user ID                                               |
| updatedAt     | timestamp     | Yes      | Last modification time (epoch)          | Client-assigned; server-assigned [Phase 2+]                 |
| deletedAt     | timestamp \| null | Yes  | Soft delete timestamp                   | —                                                           |

#### DataFieldHistory Entity (typed per componentType; minimal — value changes only; broader property tracking [Phase 2+])

**Purpose:** Immutable append-only audit log of `DataField.value` changes. Typed as a discriminated union over `componentType` so `prevValue` / `newValue` carry the Component's value shape.

**Shared fields**:
| Field         | Type          | Required | Description                          | Constraints                                    |
| ------------- | ------------- | -------- | ------------------------------------ | ---------------------------------------------- |
| id            | string        | Yes      | Primary key                          | Composite key `${dataFieldId}:${rev}`          |
| dataFieldId   | string (UUID) | Yes      | Reference to `DataField.id`          | Must exist in `DataField` table                |
| parentNodeId  | string (UUID) | Yes      | Reference to owning `TreeNode`       | Denormalized for easy queries                  |
| componentType | string        | Yes      | Discriminator                        | Matches `DataField.componentType`              |
| action        | enum          | Yes      | `"create" \| "update" \| "delete"`   | —                                              |
| property      | string        | Yes      | Changed property                     | Fixed: `"value"`; other properties [Phase 2+]  |
| updatedBy     | string        | Yes      | Editor identifier                    | Constant "localUser"; real user IDs [Phase 2+] |
| updatedAt     | timestamp     | Yes      | When the change occurred (epoch)     | Client-assigned; server-assigned [Phase 2+]    |
| rev           | number        | Yes      | Monotonic revision per `dataFieldId` | Starts at 0 for create                         |

**Typed value fields** (`prevValue` and `newValue` shapes, by `componentType`):
| componentType    | prevValue / newValue shape                                              |
| ---------------- | ----------------------------------------------------------------------- |
| `text-kv`        | `string \| null`                                                        |
| `enum-kv`        | `string \| null`                                                        |
| `measurement-kv` | `number \| null`                                                        |
| `single-image`   | `{ blobId, mimeType, width, height, byteSize, caption? } \| null`       |

Reversion and audit are central to the app, so the history record must preserve the Component-typed value exactly as stored on the DataField at that revision.

**Indexes**:

- treeNodes: by parentId, by updatedAt
- dataFieldTemplates: by componentType, by updatedAt
- dataFields: by parentNodeId, by updatedAt, by templateId
- dataFieldHistory: by dataFieldId, by updatedAt
- imageBlobs: by blobId (primary)

**Entity Relationships**:

- TreeNode has 0..1 parent TreeNode (self-referential)
- TreeNode has 0..n child TreeNodes
- TreeNode has 0..n DataFields
- DataField belongs to exactly 1 TreeNode
- DataField references exactly 1 DataFieldTemplate
- DataFieldTemplate has 0..n DataFields (one-to-many)
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
- **Stores**: [DONE] `treeNodes`, `dataFields`, `dataFieldHistory`
- **Primary Storage**: [DONE] Local browser storage for offline-first capability. All operations persist locally first.
- **Cloud Sync**: [DONE] Bidirectional sync with cloud storage when online. The system orchestrates push (local→remote) and pull (remote→local) operations. Conflict resolution uses Last-Write-Wins (LWW) based on `updatedAt` timestamps.
- **Sync Triggers**: [DONE] Automatic sync on startup (if online), periodic timer (every 10 minutes), and on network 'online' event. Manual sync available via dev tools.
- **Single-user environment**: [DONE] Uses constant `updatedBy` "localUser". Only `value` changes are logged, not `fieldName`/`componentType`/`templateId` changes. [Phase 2+]: real user identity, broader property change logging.

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
    "templateId": "tpl_serial_number",
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
    "templateId": "tpl_status",
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