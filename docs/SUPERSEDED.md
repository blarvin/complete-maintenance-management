# SUPERSEDED.md — Retired Spec Text

Spec text that has been **removed** from `SPECIFICATION.md` (or `LATER.md`),
kept because the reasoning in it was real even though the design it describes is
no longer what the app owes.

**What belongs here is narrow**: the spec for a surface that **shipped and was
retired**, held so its thinking isn't lost the moment the code goes. It is not
an edit log. Spec for something that was never built — a plan superseded before
it landed, a section rewritten a day later — is just a wrong draft, and git has
it. Adding those would bury the few blocks worth keeping.

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

### From SPECIFICATION.md — The Add Surface: Picking is committing, and the LibraryPicker

*Removed 2026-08-15 when the Add Surface was respecced as a Field row holding a
draft, with an explicit Create/Cancel pair. The immediate-commit reasoning is
not retracted, and the SPEC records it as **suspended** rather than discarded:
its central argument — that the row IS the field, so a preview is a second
rendering path obliged to imitate the first — is exactly what the shared row
shell now delivers by other means. The multi-pick coalescing it justified is
built and generic; only its first consumer went away. The one claim that was
simply wrong is the category-grouping blocker: grouping by kind is a view over
the `library` tree and needs no re-parenting, so `parentId === null` never stood
in its way.*

> ### Picking is committing
>
> Choosing a FieldDefinition mints the DataField **immediately** — a real Element parented to the node, bound by `definitionId`, with `siblingOrder` one greater than the last persisted field and `value: null`. It appears in its final position on the card, drawn by its kind's real Renderer, unfilled.
>
> **It does not take focus.** Autofocusing the new row would fight the picker staying open, and on a phone would raise the keyboard and shove the user's place mid-pick. The deeper reason is that focus-on-mint contradicts the state itself: an unfilled field is a resting state, not a form waiting to be completed. Pick now, fill when you know.
>
> **There is no preview, because there is nothing to preview**: the row *is* the field. That is the whole of the simplification — a preview is a second rendering path obliged to imitate the first, and imitation is where the two drift.
>
> - **Multi-pick is picking twice.** The picker stays open across picks; each pick is its own write. Fields commit in **pick order** — the order the user expressed, not alphabetical.
> - **Undo, not Cancel, is the reversal.** A pick raises `"Field added"` with Undo. Consecutive picks **coalesce into one toast** (`"3 fields added"`) whose Undo removes all of them: the Snackbar is single-slot (see Snackbar & Undo), so a toast per pick would leave only the last pick reversible — the opposite of what a multi-picking user wants.
> - **An undone pick leaves a tombstone, and that is the accepted price.** Retention is absolute (see Soft Deletion), so undoing a mis-pick soft-deletes rather than erases: the Element row keeps its `deletedAt`, and its `create` history row stays. A pending draft left no trace when cancelled, so this is the one thing immediate-commit genuinely costs. It is accepted because the alternative costs the whole pending apparatus, and because a stray tombstone is invisible to the user and harmless to the tree.
> - **Nothing is pending.** Navigating away, reloading, or dismissing the picker leaves exactly what was picked, because what was picked was written. The only thing still losable is keystrokes sitting in an open value editor, and that is the ordinary edit path's behaviour, not this surface's.
> - **An unfilled field is the expected outcome, not a failure.** Picking says *this thing has one of these*; entering the value is a later, ordinary act (see Core Principles → *Minting Records Identity*). A card of unfilled fields is a work list.
>
> ### The LibraryPicker
>
> The picker is the `library` tree, rendered with the tree's own patterns rather than a bespoke list:
>
> - **One row per active FieldDefinition**, sorted alphabetically by `name`. No scope filters, no categories, no search box — a flat list is fine while the Library is small.
> - **The chevron expands the row in place** to peek at that Definition's config sub-fields, rendered read-only by their own kinds' Renderers — the same disclosure a lens gives its children. This is the disambiguation affordance: two Definitions may share a label (uniqueness is not enforced), and their config is what tells them apart.
> - **The name picks it**, minting the field and leaving the picker open.
> - **The first row is "+ New Field Definition"** — authoring, below.
>
> Typeahead filtering, popularity ranking and "recently added" sort remain deferred. [Phase 2+] **Category grouping is blocked rather than merely deferred**: `parentId === null` is currently how the storage layer identifies a Definition, so a Definition cannot sit beneath a category node until that identity test moves off the null parent.

*(Authoring's tree-row form below. The rows, the data-driven nesting and the
validation layers all survive verbatim in the current spec — what went is the
`+ New Field Definition` row that hosted them, since typing a name in the Add
Surface's own name slot is now the authoring act.)*

> **Authoring is the tree, not a form inside it.** `+ New Field Definition` is a row; expanding it lists **one row per admitted kind**; expanding a kind row reveals that kind's authoring surface. The kind choice *is* which row you expand — there is no picker control, because the tree already is one.
>
> ```
> ▾ + New Field Definition
>    ▸ Text
>    ▾ Number
>        [ name ]
>        Units symbol      psi
>        ▾ Display & nominal
>        ▸ Alarms & freshness
>        Create Number Definition
>    ▸ Enum …
> ```
>
> An expanded kind row holds three things and no more:
>
> 1. **Name** — text input, max 50 chars, required non-empty trimmed; becomes the Definition Element's `name`. Unlike every other row it is an input *at rest* rather than something to activate: naming is the act, not a knob, and it takes focus when the row opens.
> 2. **Config** — one row per config sub-field, at the depth its schema puts it.
> 3. **Create** — commits, disabled while anything blocks it.
>
> **Commit** writes the Definition Element and its config subtree (sync-queued, `updatedBy: <currentUserId>`), then **mints a DataField instance from it on the node** — the same act as picking it, so authoring and using are one continuous motion.

### From ELEMENT-MODEL.md and SPECIFICATION.md — number-kv progressive disclosure

*Removed 2026-08-16 after using it. The tiers were built (`ConfigSubField.group`,
`CONFIG_GROUPS`, and a collapsible group row in `ConfigRows`) and shipped, and the
verdict on seeing them in the running app was that every config label already
stands on its own — so the chevrons hid knobs behind a level of structure that
told the reader nothing the labels didn't, on a surface where the whole point is
that a knob you don't care about can simply be left alone.*

*Two pieces of the reasoning are kept because they are still right. The first is
the distinction the tiers were reaching for: `unitsSymbol` really is different in
kind from `expectedRefreshSeconds`, and flatness answers that with **order**
(required first) rather than with depth. The second is the naming rule the removal
forced — where a category label was load-bearing it moves into the sub-field's own
label, which is why `Low low` is now `Threshold LL`. Reintroducing depth is a spec
change; the terms are in LATER → `Config authoring: progressive disclosure`.*

*`visibleWhen` was never part of this and survives untouched — hiding an
irrelevant row is a different claim from filing a relevant one under a heading.*

> **Authoring form — progressive disclosure** (the canonical exercise for the conditional-reveal patterns the wider Library-authoring UI reuses). Three tiers:
>
> - **Required** (always visible): `unitsSymbol` (plus the surrounding `label` and `kind`).
> - **Common** (collapsible "Display & nominal", expanded by default): `unitsLongForm`, `affixPosition`, `decimals`, `displayFormat`, `nominalMode` and the inputs it reveals.
> - **Advanced** (collapsed "Alarms & freshness"): thresholds, `expectedRefreshSeconds`.

> **Config is rows, never a form.** One row per config sub-field, at the depth its schema puts it. **Nesting comes from data, never from a per-kind component**: `group` places a sub-field inside a collapsible group row, `members` expands an atomic compound into its parts one level deeper, and `visibleWhen` reveals a row only when another value calls for it. This is how `number-kv`'s progressive-disclosure tiers become tree depth rather than a form's sections.
>
> ```
> ＋ [ Discharge Pressure ]   [ 145 ] psi
>    ▾ CONFIG
>        Creating a Number field — pick a different Kind below to change that
>        Units symbol      psi
>        ▾ Display & nominal
>        ▸ Alarms & freshness
>    ▾ KIND
> ```

*Also removed with it, from ELEMENT-MODEL → number-kv → conditional reveal — a
rendering that was specced but never built, and which the flat rows do not
attempt:*

> - Threshold inputs render as one visual chain so the `LL ≤ … ≤ HH` invariant reads at a glance; a violating value marks the offending input and blocks Save with an inline message naming the broken link.

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

### From SPECIFICATION.md — FieldDefinitions are forked, never mutated

*Reversed 2026-08-17, when the Library became a place in the tree — a Definition
was to be edited in place, propagating downstream to every bound instance. **That
reversal was itself reversed 2026-08-20** when the place-design was rejected
(see the Library-as-a-place entry at the bottom of this file): the fork rule
below is current SPEC again (SPECIFICATION.md → Edit / Delete Semantics). Kept
here as the record of the round-trip.*

> **Phase 1 ships with no user-facing edit or delete of FieldDefinitions.** This is a deliberate simplification, not an oversight — multi-user identity and permissions don't exist yet, so any edit/delete UX is premature.
>
> - **Edit is conceptually "fork"**: any future UI affordance that looks like "edit this FieldDefinition" (whether the change is to label, config, or both) **mints a new FieldDefinition** rather than mutating the existing one. The original is untouched; downstream DataField instances remain bound to it. This sidesteps cascading config changes (e.g. unit changes on a `number-kv` field) and avoids the question of which user is authorised to edit a given entry.
> - **Delete is admin-only**: end users cannot delete FieldDefinitions — not their own, not others'. Bad or duplicate entries are removed by the dev team directly in Firestore. The `deletedAt` column exists on the entity for forward compatibility (and for the rare admin tombstone), but no client write path sets it in Phase 1. Soft-deleted FieldDefinitions are filtered out of the Kind band's listing.
>
> Per-user delete UX, ownership-based permissions ("you can delete your own"), config-edit-creates-fork affordances, and label-uniqueness / dedup logic are all deferred to LATER.md and revisited once real multi-user identity lands.

*And the one-sentence form of the same rule, from → The cascade:*

> A Definition is **forked, never mutated** (editing one mints a new id; existing instances stay bound to the one they were minted from); `definitionId` *is* the version, so there is no `componentVersion` and no migration runner.

### From SPECIFICATION.md — the Library as a set, and a Definition as an Element of the kind it defines

*Replaced 2026-08-17 by the Library-as-a-place design — a Definition became a
Node under a Library Node, identity moved to `definitionId === id`. **That design
was rejected 2026-08-20** (entry at the bottom of this file), and the text below
is largely current again: a Definition is a field-like Element of the kind it
defines, identified by `parentId === null`, and the Library is a population —
now read by a lens (SPEC → The Library) as well as by the Kind band, rather
than surfaced under the band alone.*

> ### The Library
>
> The Library is the set of all active FieldDefinitions, surfaced to users under the Add Surface's **Kind band** — each kind expanding to the Definitions of that kind (see The Add Surface).
>
> #### Where the Library lives
>
> - **A typed tree, not a side table**: a Definition is an `Element` (with `treeType: library`) and its config is its child sub-field Elements; it syncs, history-tracks, and reverts like any other Element.
>
> #### Listing under the Kind band
>
> - **Grouping by kind costs nothing structural.** The Kind band is a view over the `library` tree — Definitions are gathered by their `kind` and rendered beneath it, never re-parented. A Definition's identity test (`parentId === null`) is untouched, which is exactly why arbitrary user-authored groups are the deferred case and this one is not.

*And the entity definition it carried:*

> **Purpose:** A Library entry — a field-like Element of the kind it defines, living in the `library` tree (`treeType: library`), whose config is its child sub-field Elements. Instances bind to it by `definitionId`. It is **not a separate entity**: its columns are the Element columns (`kind` = the kind it defines, `name` = the label), and it has no `config` column — config is its subtree.

### From SPECIFICATION.md / ELEMENT-MODEL.md — the atomic compound config sub-field

*The `compound` kind was retired 2026-08-17 — its justification was the
place-design's editable Library ("each threshold separately editable with its
own history"). **Reversed 2026-08-20** with that design's rejection: the
retirement was never cashed in code (the schema still mints `thresholds` as one
`compound`, `configSchema.ts`), the Library lens renders storage faithfully, and
the atomicity text below is current again in SPEC / ELEMENT-MODEL.*

> - **The only object-valued residue is the compound sub-field** — co-varying values that must move together (`thresholds: {LL,L,H,HH}`) bundle into one atomic LWW'd object, by necessity (atomicity), not by default.
> - **Granularity is a choice** — decomposed config can tear under concurrent offline edits (`L` and `H` converging to `L > H`); this is allowed, flagged, and revertible. Validation is **advisory** by default; reserve the atomic compound for the few values where a wrong combination is *dangerous*, not merely silly.

*From ELEMENT-MODEL → number-kv and → Config leaves:*

> The `{LL,L,H,HH}` cluster is the one place an object-valued config survives (a small atomic compound), because the values co-vary and a torn merge (`L > H`) would be dangerous. Everything else is an independent scalar sub-field.

> - `threshold-compound` — a compound own value, atomic LWW; the one config leaf that earns a new kind.

### From LATER.md — the tree switcher (Assets / Config / Library)

*Retired 2026-08-17. There is one app and one tree, and the tree is the switcher:
`treeType` is a routing tag on the Element (which audit log, whether it syncs),
never a navigational partition, so no view state is parameterised by it and there
is nothing to switch between. The rest of the entry survives in LATER — the
config UI really is the existing renderers with no new view layer, which is why
the switcher looked necessary and wasn't.*

> So the config UI is the existing TreeNode / DataCard / FieldList renderers pointed at a different tree — one FSM state parameterised by `treeType`, not a new view layer. The same switcher also delivers the long-deferred **dedicated Library view** (above) as a side effect.
>
> - **Tree switcher on the ROOT view** — Assets / Config / Library.

*And the destination it named, from → FieldDefinition Library Phase-2 enhancements:*

> - **Dedicated Library view** (a TreeNode stack under the app's main menu) for browsing / managing FieldDefinitions outside the Add Surface — and the only place a Definition ever becomes *editable*, since the Add Surface only ever adds.

### From SPECIFICATION.md — the Library as a place in the tree (the whole design)

*Removed 2026-08-20 on branch Library-As-Lens-Tree. The place-design — specced
2026-08-17, prototyped end-to-end on branch Field-Definition-Library-alpha
(`cca33ec`), and rejected in concept: Definitions re-parented as `kind: node`
children of a Library Node, identity moved to `definitionId === id`, the defined
kind demoted to a `::cfg::kind` config Field, config materialized by a
reconciling ProvisionSpec, per-write validation, and edit-in-place with
downstream propagation. It rewrote a whole population's storage (Dexie v12,
clear-on-upgrade) to buy what a lens gather gets for free. What survives:
`treeType` as a routing tag, no switcher, and the Library entered from a Node
pinned on ROOT — respecced as SPEC → The Library (a lens). What it superseded
returns: fork-never-mutate, identity by `parentId === null` (now kind-aware),
sparse config, and the atomic `compound`. The prototype's code lives on the
abandoned branch; nothing of it is merged.*

> #### Everything in the Library is a Node with Fields
>
> - **The Library Node** — an ordinary `node` (`treeType: library`, `parentId: null`), pinned to the top of the ROOT listing. Not user-created and not user-deletable; **non-deletability is a permissions concern, not a kind** — when permissions land it becomes a property available to any Element, and until then it is simply an affordance this Node does not draw.
> - **A FieldDefinition is a Node** — `kind: node`, `treeType: library`, parented to the Library Node, with one Data Card like every other Node-like Element. It is a Node *so that every Definition is alike*: same row, same card, same gestures, same place. A Definition whose `kind` column carried the kind it defines would render, sort and navigate differently for every kind in the catalogue.
> - **A Definition's config is ordinary Fields on its Data Card** — editable in place, history-tracked, LWW'd, like any other Field. They are not a separate species: they are Fields whose values are read at mint to configure a new instance. **Config is a *use*, not a kind.**
> - **A Definition's card is open.** It may carry Fields that are not config at all — notes, ownership, whatever a team finds useful. Provisioned config Fields are told apart by their deterministic ids, never by position.

> #### What identifies a Definition
>
> **`definitionId === id`.** A Definition points at itself.
>
> This replaces `parentId === null`, which was the test only for as long as Definitions were tree roots. The self-reference holds at any depth, under any parent, so it survives the Library Node, folders inside it, and the eventual move of the whole Library beneath an app-level Node. It also reads true: `definitionId` already answers "which Definition am I bound to," and a Definition is bound to itself.
>
> **Config Fields carry `null` for now, and that is an interim.** The end state is that a config Field is itself an instance — "Units symbol", "Decimals", "Threshold LL" become seeded Definitions, and *every* Field on *every* card in the app, including the ones inside the Library, is minted from something.

> #### The defined kind is a config Field
>
> A Definition is a `node`, so the kind it defines cannot live in the `kind` column. It is a config Field like the others, at the deterministic id `${defId}::cfg::kind`, and it is the one read **first** — it selects the config schema the Definition's remaining Fields are provisioned from.
>
> **It is write-once**: set at mint, read-only thereafter. `kind` immutability is load-bearing everywhere else in the system (*One substrate, a spectrum of kinds*), and changing a Definition's kind once instances exist would re-render every one of them under a renderer their stored values do not fit. Changing the kind means coining a new Definition.

> #### Config Fields are provisioned, not authored ad hoc
>
> A Definition's config Fields are materialized from its kind's config schema by a **ProvisionSpec**, on the same terms as a lens: deterministic ids (`${defId}::cfg::${key}` — the twin of `${nodeId}::jobs`), idempotent, **reconciled rather than created once**.
>
> Reconciliation does three jobs, and only the first is obvious:
>
> 1. **Materialization** — every knob the schema declares gets a row, valued or not. Without it the Library could only show config somebody had already set: an unset knob has no Element, so no row, so nothing to tap in order to set it.
> 2. **Repair** — config is read back by exact id, so a deleted config Field would silently remove a knob from every instance bound to that Definition. Reconciliation puts it back. This is what makes config safe to edit in place rather than fragile.
> 3. **Schema evolution** — a kind gains a knob and every existing Definition grows the Field on next reconcile. No migration runner, which is the promise "value/config shapes are widen-only" has been carrying by convention alone.
>
> **Required config is enforced on every write, not at one gate.** A Definition can be edited forever, so the kind's cross-field rules (`enum-kv` options non-empty, `number-kv` units present, the threshold chain) run on each config Field write: reassemble the Definition's config, validate, reject. Stronger than the pre-Create check it replaces, which could only guard the moment of authoring.

*And the Edit / Delete Semantics it carried — the propagation half:*

> **A Definition is edited in place, and the edit reaches every instance bound to it.** This reverses the earlier *forked, never mutated* rule — deliberately, and as the whole reason the Library exists as a place: change a meaning once and the estate converges on it.
>
> - **Minted from everywhere, edited only through the Library.** Coining a Definition stays cheap and available on any card (the Add Surface); changing one has exactly one address. That asymmetry is the design, not a restriction awaiting removal.
> - **Downstream only.** An edit to a Definition flows out to its instances. An edit to an instance never flows back. **Upstream propagation is rejected outright, not deferred** — one user's local correction silently rewriting shared meaning for everyone is chaos that no amount of notification, confirmation or gating redeems. Without downstream flow, though, the Library would be a dead catalogue with no convergence; so the arrow points one way and only one way.
> - **`definitionId` stops being the version.** Under mutation it names the Definition, not a revision of it. What an instance was minted against is recoverable from the Definition's own history rather than pinned on the instance, so there is still no `componentVersion` and no migration runner.
> - **`disposition` is the intervention layer.** `owned` (copied at mint, does not propagate) is precisely a per-sub-field version pin; `pinned` is delegated-with-override-disabled. Both are already encoded on every config sub-field and read by nothing — wiring them is the cascade arbiter's job (*The cascade*). **Until then everything propagates**, which is right for the Library's alpha and too blunt for production: a units change should probably not arrive silently across ten thousand readings.
> - **Renaming a Definition propagates too.** A Field's `name` is snapshotted from the Definition's label at mint today, so a rename currently reaches nothing. Under downstream propagation it must reach every instance — that is a code change, not only a spec one.
> - **The audit consequence, stated plainly.** An instance's history records its values; the Definition's history records changes to what those values *mean*. Answering "what did 145 mean in March" needs both logs joined. This is inherent to live propagation, not a defect to be fixed later.
