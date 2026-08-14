# SUPERSEDED.md — Retired Spec Text

Spec text that has been **removed** from `SPECIFICATION.md` (or `LATER.md`),
kept because the reasoning in it was real even though the design it describes is
no longer what the app owes.

**House rules:**

- **Nothing here is current.** No document, code comment, issue, or agent may
  cite this file as a statement of what the app does or should do. If something
  here is still true, it belongs in SPECIFICATION.md, not here.
- **Blocks are verbatim**, in the voice they had when they were live. They are
  not edited to reflect what replaced them.
- **Each block carries a header line**: what replaced it, and the date it was
  retired. That line is the only editorial matter in a block.
- **Append, never reorder.** Newest at the bottom.

---

## Retired 2026-08-14 — the Field Composer and the legacy "+ Add Field"

*Replaced by* **SPECIFICATION.md → The Add Surface**. Both surfaces were
scaffolding: they existed to get the data model and the registry/manifest
rebuilt, and they were switched off (`ENABLED_ADD_FIELD_SURFACES = []`) before
this text was retired. The tree-native replacement mints on pick, so the whole
pending/batch/preview apparatus these sections describe has no successor.

### From "DataField Management" — the Create Data Fields bullet

> - **Create Data Fields**: Two surfaces sit at the bottom of the DataCard in display mode. A legacy **+ Add Field** (singular) dropdown is the quick-add path — pick one FieldDefinition, the DataField is created immediately. A **+ Add Fields** (plural) button expands the **Field Composer** alongside it for batch-add and FieldDefinition authoring: an inline section showing every available FieldDefinition as a row in a single list, each with a checkbox; checking a row replaces the label-only row in-place with a live editable preview of that Definition (rendered with its real kind manifest). Save commits every checked row as a real DataField on the node; Cancel discards them. The Composer also hosts the "+ New Field Definition…" authoring affordance. See "Field Composer" and "DataField Components, Field Definitions, and Library" below.

### The whole "Field Composer" section

> ## Field Composer
>
> ***Intent:*** *adding facts to a thing is fast, and the vocabulary of facts grows from what users actually need — captured first, tidied later, never gatekept.*
>
> The Field Composer is a unified inline UI for adding one or more DataFields to a TreeNode. It replaces the bare default-fields list in construction mode and adds a batch-add + authoring surface in display mode. In display mode the single-pick **+ Add Field** dropdown is intentionally **kept alongside** the Composer — the two coexist as a deliberate experiment comparing fast single-add against the richer Composer flow, with the keep-or-drop decision left open. (This is an experiment, not committed design; it does not contradict the "collapse parallel paths" rationale below, which is about unifying the construction- and display-mode *draft* flows inside the Composer.) The Composer is also the **single Phase-1 entry point for FieldDefinition authoring** (see FieldDefinition Authoring UI below).
>
> #### When the composer is visible
>
> - **Display mode** (existing node, viewing its DataCard): the single-pick **+ Add Field** dropdown handles quick adds; a separate **+ Add Fields** (plural) button opens the inline Composer for batch-add and FieldDefinition authoring. The two are kept side by side as a deliberate experiment (not vestigial — see above), pending a decision on whether the quick-add path earns its keep. Composer Save or Cancel dismisses it. Only one of the two surfaces is active at a time — opening one closes the other.
> - **Construction mode** (new node, before Save): the composer is visible by default. The seeded default FieldDefinitions ("Type Of", "Description", "Tags") appear as **locked checked rows** — checkbox visibly checked but disabled, so the user can't uncheck them. The user can still check additional FieldDefinitions as normal.
>
> #### Layout
>
> The composer is a single inline-expanded section within the DataCard, distinguished from persisted fields by a **dashed border** around the whole zone. It contains:
>
> 1. **In-situ FieldDefinition list** — every active FieldDefinition appears as a row, sorted alphabetically by label. Each row has a checkbox. A **"+ New Field Definition…"** affordance appears as the first row, expanding inline into the authoring form (see FieldDefinition Authoring UI).
>   - **Unchecked row**: checkbox + FieldDefinition label only.
>   - **Checked row**: checkbox + a live, editable preview of that Definition, rendered with its actual kind manifest renderer (TextKvField, EnumKvField, NumberKvField, ImageField). Toggling the checkbox replaces the row in-place — checking expands the row into the full manifest preview; unchecking collapses it back to label-only.
>   - **Locked checked row** (construction mode defaults only): rendered as a checked row, but the checkbox is disabled.
>   - The preview is fully editable: the user can set the value, etc. Nothing is persisted to storage until **Save**.
>   - Rows transition smoothly (~200ms) on toggle. On check, the *checkbox* is anchored in the viewport so a tall preview (an `image` especially) doesn't shove the user's place off-screen.
>   - (Grouping rows by `category` into collapsible sections is [Phase 2+], deferred until FieldDefinition count makes a flat list unwieldy.)
> 2. **Sticky Save / Cancel footer** — pinned to the bottom of the viewport while the composer is in view, so a long list doesn't bury the actions. Save disabled (display mode) when no rows are checked.
>
> #### Interactions
>
> - **Existing persisted fields remain visible and editable** above the composer. Edits to existing fields commit immediately as today; edits inside the composer are pending until Save.
> - **Save** persists every checked row as a `DataField` (executing `ADD_FIELD_FROM_DEFINITION` per row), in **alphabetical order** (matching the visual order in the composer), with each new field assigned a `siblingOrder` greater than every already-persisted field on the card. New fields appear at the bottom of the FieldList in the same order they previewed in. After Save, the composer collapses.
> - **Cancel** discards every pending row. If any rows had been checked, a Snackbar with Undo follows (`"N fields discarded"` — Undo re-opens the composer with the same rows checked and the same entered values).
> - **Click-away does not dismiss the composer.** Pending work is preserved across in-app navigation; the composer is dismissed only by Save or Cancel. (Pending state across reload is best-effort via existing localStorage scaffolding.)
> - **Construction mode**: Save here is implicit in node creation. The node's "Save" button finalises the node *and* the composer's batch in one transaction. Cancel discards the in-progress node entirely, as today.
> - **No reorder of pending rows** in this round. Commit order is alphabetical. Reorder of fields (pending and persisted) is designed together as a future task.
>
> #### Why one composer for both modes
>
> Construction-mode "pending forms" and display-mode "newly-added field draft" are the same shape: a set of pending DataField drafts attached to a node, batch-committed on finalize. Unifying them collapses two parallel UI paths into one and removes the awkward "single-row picker" intermediate state.
>
> #### Composer rows pending vs. FieldDefinition authoring
>
> The two pending-state shapes inside the Composer are distinct:
>
> - **Pending DataField draft** (`pendingForm` in `usePendingForms`) — a checked row holds an in-progress *value* for an existing FieldDefinition. Committed by Save → writes a `DataField`.
> - **Pending FieldDefinition draft** — the "+ New Field Definition…" form holds an in-progress *Definition* (kind, label, config sub-fields). Committed by Save → writes a Library-tree Definition Element (and its config subtree), then *immediately* spawns a pre-checked pending DataField draft for it at the same row position.
>
> These are deliberately separate hooks/states because a DataField cannot exist without a FieldDefinition to anchor it.

### From "The Library" — Listing in the Composer

*The alphabetical flat list survives in the picker; the mint-position rule does
not, because a newly authored Definition now mints its instance directly rather
than seeding a pre-checked row.*

> #### Listing in the Composer
>
> The Composer renders **every active FieldDefinition** sorted alphabetically by `label` — one row per entry, no scope filters, no categories, no search box. Phase-1 simplicity: a flat list is fine while the Library is small. Typeahead filtering, `category` grouping, and dropdown-flip behaviour all remain deferred. [Phase 2+]
>
> **Placement of a newly authored entry**: When a user authors a FieldDefinition from inside the Composer, the new row appears **at the position where it was minted** (i.e. wherever the "+ New Field Definition…" affordance was when the user clicked it, at the top of the Composer's pick list for now), pre-checked and ready to receive a value. On the *next* opening of the Composer the entry takes its normal alphabetical place — this avoids both losing the user's place during the authoring → fill-value flow, and bespoke "recently created" sort logic.

### The "FieldDefinition Authoring UI" section

*Replaced by* **SPECIFICATION.md → The Add Surface → Authoring a Definition**.
The numbered form steps become tree rows; the kind's config sub-fields are
authored as Elements rather than through a per-kind form, per the SPEC's own
"the generic Treeview is the default authoring UI" rule — which survives, and
which `number-kv`'s `ConfigForm` override still qualifies.

> ### FieldDefinition Authoring UI
>
> The "+ New Field Definition…" affordance lives **inside the Field Composer**. It is the single Phase-1 entry point for authoring; there is no separate "Library Management" view in Phase 1. (A dedicated Library view will eventually exist as a TreeNode stack under the app's main menu. [Phase 2+])
>
> Clicking the affordance expands an inline authoring form in-place:
>
> 1. **Pick kind** — segmented control with the four Phase-1 field choices (`text-kv`, `enum-kv`, `number-kv`, `image`).
> 2. **Enter label** — text input, max 50 chars, required (must be non-empty trimmed string); becomes the Definition Element's `name`.
> 3. **Config sub-fields** — the kind's config schema is its manifest `ChildrenSpec` over config sub-field kinds (template core + open tail); authoring fills those sub-field Elements (see *Data Model → Config is Elements*, and ELEMENT-MODEL.md for each kind's config). Required config (e.g. `enum-kv.options` non-empty, `number-kv` units) is enforced before Save. `number-kv` threshold invariants (`LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH` in range mode; the equivalent chain across `(nominalValue ± tolerance)` in discrete mode) are validated here. The generic Treeview is the default authoring UI; a per-kind `ConfigForm` is an optional override for cross-field invariants / progressive disclosure (e.g. `number-kv`).
> 4. **Save** — commits the Definition Element and its config subtree (sync-queued, `updatedBy: <currentUserId>`, currently `"localUser"`), collapses the authoring form, and **immediately materialises a checked Composer row** at the same position, so the user can fill in the value and proceed to the batch Save in one continuous motion.
> 5. **Cancel** — discards the in-progress authoring form. No Definition is written. The Composer returns to its prior state.
>
> The authoring form has **its own pending-state shape**: it is *not* a `pendingForm` from `usePendingForms`, because no DataField exists yet — the FieldDefinition has to commit first before a DataField draft can attach to it. The hook surface for this state is a separate concern; naming TBD during implementation (working name: `useDefinitionDraft`).

### From "Default DataFields at Node Creation" — the locked checked rows

*The lock was a property of the checkbox. With no checkbox, the three defaults
are simply the fields a new node is born with.*

> Three FieldDefinitions are pre-checked in the Composer when a node is in `isUnderConstruction`:
>
> - **Type Of** (`text-kv`)
> - **Description** (`text-kv`, `multiline: true`)
> - **Tags** (`text-kv`)
>
> These appear as **locked checked rows** — checkbox visibly checked but disabled — so the user can't uncheck them. They commit as DataFields on node Save regardless of whether a value was entered (empty fields are allowed). Other FieldDefinitions in the Composer are unchecked by default and behave normally.

### Assorted one-liners

> - **CreateDataFieldButton**: Button at the bottom of the DataCard to create a new Data Field for the node on its DataCard.

*(Component hierarchy — replaced by `AddFieldSurface` + `LibraryPicker`.)*

> - **isUnderConstruction**: Default Data Field values are active for entry in-situ (though not required). TreeNodeDetails not shown. CreateDataFieldButton in last row and functions as normal. "Save" and "Cancel" buttons at the bottom.

*(DataCard States — the card under construction no longer hosts a create
affordance; fields are added after the node exists.)*

> - **Add DataFields at Node creation**: In isUnderConstruction state, the `DataCard.isUnderConstruction` contains the default DataFields, with DataFieldValue ready for user entry, but may be left blank.

*(Node Creation — the defaults are now committed by the construction
transaction, not entered in it.)*

> - CreateDataField dropdown: ArrowDown to open, Enter to select, Escape to close

*(Keyboard interactions.)*

### From LATER.md — Add-Field Surface A/B

*The A/B **framing** is retired: the question is no longer which of these two
earns its keep, because both lose. The **contract** described here is not — the
surface registry in `addFieldSurfaces.ts` is how the Add Surface ships
*alongside* them during its build, so all three can be compared in the running
app by editing one array before the losers are deleted (ISSUES → Tech Debt).
An earlier version of this note claimed the replacement was "not a third variant
of the same contract"; that is true of the end state and wrong about the build.*

> ### Add-Field Surface A/B
>
> Both add-field surfaces (FieldComposer and the legacy `CreateDataField` single-pick dropdown) ship side by side as a deliberate A/B experiment, coordinated by the `ActiveSurface` mutex and the `ENABLED_ADD_FIELD_SURFACES` roster in `src/constants.ts` (audit item 2.7, resolved as keep-both). Deferred:
>
> - **More surface variants** — follow the contract in `src/components/FieldList/addFieldSurfaces.ts` (add id to `AddFieldSurfaceId`, build to contract, add to roster, render in FieldList).
> - **Winner picking** — eventually decide which surface(s) earn their keep and delete the losers (component + CSS + roster entry + union member).

### From LATER.md — Composer discard → real command

*The cancel path it describes no longer exists: nothing is discarded, because
nothing is pending. The observation about the inert error branch is kept because
the same shape recurs whenever a no-throw `execute$` rides `commitWithUndo`.*

> - **Composer discard → real command** — `FieldComposer` cancel rides `commitWithUndo` via a no-throw `execute$` (discard) + restore-callback undo, so its error branch is inert. When draft discard becomes a real command (e.g. `DISCARD_DRAFT`), it slots into the standard command/inverse path and the dead branch goes live.

### From LATER.md — ComposerRow check/uncheck slide-in animation

*The row it animated no longer exists. The underlying finding — that
`display: contents` kvField wrappers cannot be animated — is real and will
recur; it is recorded in ISSUES if it bites the Add Surface.*

> ### ComposerRow check/uncheck slide-in animation
>
> Spec (`§Field Composer → Layout`) calls for a ~200ms transition on the body when a row is checked/unchecked. The DataCard grid-template-rows trick doesn't compose with the existing kvField renderers (they wrap with `display: contents` so they can position into the FieldList subgrid, which can't be animated). Either flatten the kvField output for the composer (extra wrapper component per kind), or split the body into an animatable container that the kvField writes into. Until then the row's body appears/disappears immediately; the checkbox is still anchored in view via `scrollIntoView({ block: 'nearest' })` after toggle.
