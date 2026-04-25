---
name: ""
overview: ""
todos: []
isProject: false
---

# Field Composer — In-Situ Multi-Select Template List with Live Previews

## Goal

Replace the awkward single-row Template picker with a unified **Field Composer**: a single inline-expanded list inside the DataCard where every row is an available Template, rendered as either an unchecked checkbox-row (just label) or — when checked — a live, editable preview of the Template using its real Component. Checking a row replaces the label-only row in-place with the full Component preview; unchecking collapses it back. Save commits every checked row as a real `DataField` on the node; Cancel discards them.

This collapses construction-mode and display-mode field-adding into a single UI path, on top of the existing `usePendingForms` draft store.

See SPECIFICATION.md → "Field Composer" and "DataField Management".

## Scope (in)

- Field Composer component: dashed-bordered inline section inside DataCard, shown by clicking **+ Add Fields**. One composer instance at a time. Save or Cancel collapses it; the button returns.
- A single in-situ list. Each row corresponds to one Template, sorted alphabetically by label.
  - **Unchecked**: checkbox + Template label.
  - **Checked**: checkbox + live, editable preview of the Template, rendered with its real Component (TextKv / EnumKv / MeasurementKv / SingleImage). Toggling the checkbox replaces the row in-place.
- Pending-mode flag in `useFieldEdit` so the same renderer commits to a draft store instead of IDB.
- Sticky **Save** / **Cancel** footer pinned to the bottom of the viewport while the composer is in view (so a long list doesn't bury the actions).
- Save: batch-execute `ADD_FIELD_FROM_TEMPLATE` for every checked row, in **alphabetical order** (matching the visual order in the composer), with each new field assigned `cardOrder = currentMaxCardOrder + N` so they appear after every already-persisted field on the card and preserve their composer-order relative to each other. After Save, the composer collapses; new fields appear at the bottom of the FieldList in the same order they previewed in.
- Cancel: discard every pending row with a Snackbar `"N fields discarded — Undo"`. Undo re-opens the composer with all the same rows checked and their entered values restored.
- Construction mode: composer is shown by default and pre-populated with the seeded default Templates as **locked checked rows** (checkbox disabled in the on state). Other Templates appear as normal toggle-able rows. Node Save commits the node + the composer's batch in one flow; node Cancel discards the in-progress node entirely.
- Persisted fields remain visible above the composer and remain editable while the composer is open.
- Smooth height transition (~200 ms) on check/uncheck so the layout shift reads as intentional.
- Scroll anchoring on the checkbox row: when checking a Template whose preview is tall (single-image especially), the *checkbox* stays put rather than the top of the preview, so the user's eye doesn't lose the row they just clicked.

## Scope (out)

- **No reorder of pending or persisted fields** in this round — neither bump buttons, drag handles, nor any other reorder UX. Commit order is alphabetical, full stop. Persisted-field reorder remains a future task per SPEC ("Detailed UX/interaction design TBD"); we'll design pending and persisted reorder together as a single Phase-2 problem.
- No `category` field on `DataFieldTemplate`. With ~6 seeded Templates, a flat alphabetized list is fine. Adding `category` later is cheap (dev-junk data: wipe + re-seed, no migration). [LATER]
- No multi-instance composers. The earlier "stack multiple composers, each with its own batch" model is dropped — the in-situ list is a richer single composer, and the multi-instance pattern was really a stand-in for "insert fields anywhere in the card," which we're punting.
- No Template-authoring UI — Templates remain dev-seeded.
- No persistence of pending state across page reload (existing `usePendingForms` localStorage behavior is fine as-is).
- No search / filter in the picker. [LATER]
- No suppression of Templates already persisted on this node (the picker shows every Template, even ones already on the card; user could accidentally double-add). Important to flag: under the in-situ pattern, accidental double-adds are more plausible than they were under a separate-picker pattern. [LATER]

## Architecture notes

- **Writes**: still through `getCommandBus().execute({ type: 'ADD_FIELD_FROM_TEMPLATE', ... })`. Save iterates pending rows in alphabetical order.
- **Reads**: `getTemplateQueries().listTemplates()` (existing). Render flat, sorted alphabetically by label.
- **Draft store**: `usePendingForms` is the single source of pending DataField drafts. The hook already supports both modes (construction vs display) — simplify so both modes share the same "draft list, finalize commits" semantics. Display-mode auto-save-on-pick goes away.
- **Pending edits**: each pending row's value lives on its `PendingForm`. `useFieldEdit` gains a `pendingMode` flag (or a parallel `usePendingFieldEdit`); when set, `commit` calls a passed-in `onPendingChange$(value)` instead of executing `UPDATE_FIELD`.
- **No `cardOrder` on `PendingForm`**: cardOrder is derived at commit time from the alphabetical Template order plus the current max persisted cardOrder on the node. Pending rows don't carry an explicit order.
- **Subgrid reuse**: the composer's row list participates in the FieldList subgrid. Both unchecked rows (checkbox + label) and checked rows (checkbox + Component) align labels with persisted fields above.

---

## Implementation Steps

### 1. Pending-mode for `useFieldEdit`

`**src/hooks/useFieldEdit.ts**`

- Add an optional `pendingMode?: { onChange$: QRL<(value) => void> }` parameter.
- When set, replace the IDB commit path with `onChange$(parsedValue)`. Skip Snackbar; the composer's Save is the user-visible commit point.
- Preview/revert behavior is moot in pending mode (no history exists yet) — disable details/history affordances on pending rows (see Step 3).

### 2. `usePendingForms` simplification

`**src/hooks/usePendingForms.ts**`

- Today the hook tracks `saved` (display-mode autosave bit) and a `templateLabel` snapshot. Drop the `saved` branch — display mode no longer auto-saves.
- Each `PendingForm` carries `{ id, templateId, componentType, fieldName, value }`. Drop `cardOrder` — it's derived at commit time.
- Methods:
  - `togglePending$(template)` — checkbox handler. Adds a pending row if absent; removes it if present (matched by `templateId`).
  - `setPendingValue$(formId, value)` — wired from `useFieldEdit`'s `onChange$`.
  - `commitAll$(currentMaxCardOrder)` — sort pending rows by Template label, execute `ADD_FIELD_FROM_TEMPLATE` per row with `cardOrder = currentMaxCardOrder + i + 1`. Returns the committed count.
  - `discardAll$()` — clear the batch; return the cleared rows so Snackbar Undo can restore them.
  - `restoreAll$(rows)` — re-seed the batch from a captured snapshot (used by Snackbar Undo).

### 3. `ComposerRow` component

`**src/components/FieldComposer/ComposerRow.tsx**` (new)

A single row keyed by `Template.id`. Polymorphs on checked-state.

- Always renders a checkbox in the leftmost cell (chevron column of the FieldList grid; pending rows don't need a chevron).
- **Unchecked state**: checkbox + Template label in the label column. Whole row click target toggles the checkbox.
- **Checked state**: checkbox + the appropriate Component renderer (`TextKvField` / `EnumKvField` / `MeasurementKvField` / `SingleImageField`) in pending mode. The Component receives `pendingMode={ onChange$: setPendingValue$ }`. No details chevron, no history (no field exists yet).
- **Locked-checked state** (construction-mode defaults): checkbox rendered as checked + disabled (or visually equivalent — a non-removable indicator). Otherwise renders identically to a checked row.
- Smooth `max-height` / `opacity` transition (~200 ms) on toggle so the swap reads as a single intentional movement, not a jump.
- Scroll anchoring: on check, before the height expansion, capture the checkbox's `getBoundingClientRect().top`; after expansion, adjust scroll so the checkbox top is unchanged. (Simple imperative effect inside the toggle handler. If `CSS overflow-anchor` does the right thing for free, prefer that.)

`**src/components/FieldComposer/ComposerRow.module.css**` (new)

- Subgrid participation: `grid-column: 1 / -1; grid-template-columns: subgrid;`. Checkbox in column 1, label in column 2, value in column 3 (matches persisted fields).
- Height transition + transform-origin: top.

### 4. `FieldComposer` container

`**src/components/FieldComposer/FieldComposer.tsx**` (new)

- Loads Templates via `getTemplateQueries().listTemplates()`. Sorts alphabetically by label.
- Invokes `usePendingForms` for its batch.
- For each Template (in alphabetical order), renders a `<ComposerRow>` with `checked = pendingForms.value.some(f => f.templateId === tpl.id)`. In construction mode, defaults render with `locked: true`.
- Sticky footer with **Save** and **Cancel**.
  - Save: read `currentMaxCardOrder` from props (passed in by FieldList), call `pendingForms.commitAll$(currentMaxCardOrder)`, then call `onDismiss$()`.
  - Cancel (display mode): capture rows, call `pendingForms.discardAll$()`, call `onDismiss$()`, fire Snackbar (see Step 7).
  - Save disabled when `pendingForms.value.length === 0` (display mode). In construction mode, the composer's Save button is hidden — node Save handles commit.
- Wraps everything in a dashed-bordered container.

`**src/components/FieldComposer/FieldComposer.module.css**` (new)

- Dashed border around the whole zone.
- `grid-column: 1 / -1` to span the FieldList grid.
- Sticky footer: `position: sticky; bottom: 0;` with a solid background so it doesn't show rows beneath through it.

### 5. `FieldList` integration

`**src/components/FieldList/FieldList.tsx**`

- Add a `composerOpen` `useSignal<boolean>`. Default `false` in display mode, `true` in construction mode.
- Render persisted fields, then (when `composerOpen`) `<FieldComposer onDismiss$={() => composerOpen.value = false} currentMaxCardOrder={...} />`, then a **+ Add Fields** button (hidden when composerOpen). Clicking the button opens the composer.
- `currentMaxCardOrder` is computed from the current persisted-field list at render time and passed in.
- In construction mode, hide the **+ Add Fields** button entirely (composer is always open, and there's no concept of opening a second one).
- Persisted fields keep rendering as today and remain editable while the composer is open.

### 6. Legacy `CreateDataField`

- Leave `src/components/CreateDataField/` in the tree for now. `FieldList.tsx` stops rendering it (replaced by `FieldComposer`), but the component itself stays as a reference / fallback while the composer settles. Removal is deferred to LATER.md.

### 7. Snackbar wiring for Cancel

**In `FieldComposer.tsx` Cancel handler (display mode only):**

- Capture the pending batch (the actual `PendingForm` rows with their entered values) into a closure.
- Call `pendingForms.discardAll$()` and `onDismiss$()`.
- Show Snackbar: `"{N} fields discarded"` with `Undo` action that re-opens the composer (parent flips `composerOpen` back to true) *and* calls `pendingForms.restoreAll$(capturedRows)` to re-seed the batch with the original values.
- The parent (FieldList) needs to expose a callback that the composer / snackbar can use to re-open and re-seed in one go. Concretely: add a `restoreComposerWith$(rows)` callback on FieldList that the snackbar's Undo invokes.

### 8. Construction-mode wiring

`**src/components/TreeNode/TreeNodeConstruction.tsx**`

- Pass `lockedTemplateIds: TemplateId[]` to `FieldList` → `FieldComposer`. Composer marks rows for those Templates as `locked: true` (and pre-checked in the pending batch). The user cannot uncheck them.
- Node "Save": compute `currentMaxCardOrder = -1` (new node, no fields yet), then call `pendingForms.commitAll$(currentMaxCardOrder)` after the node is created. Composer dismisses as part of node creation flow.
- Node "Cancel": discard pending batch (no snackbar in construction; the whole node is being abandoned).

### 9. Tests

- `**src/test/usePendingForms.test.ts`** — togglePending (add/remove), setPendingValue, commitAll alphabetical ordering + cardOrder math, discardAll + restoreAll round-trip.
- `**src/test/FieldComposer.test.tsx`** (only if existing test infra supports component tests of this surface; otherwise skip — there's no precedent in repo for this).

---

## UX details

- **Save disabled** (display mode): when `pendingForms.value.length === 0`. Visual disabled state.
- **Locked default rows** (construction mode): checkbox visibly checked but `disabled`; cursor stays default; no toggle on click.
- **Smooth toggle**: ~200ms `max-height` + `opacity` transition. `prefers-reduced-motion` should disable the animation.
- **Scroll anchoring**: on check, the row's checkbox stays at its original viewport position even when the row's content (preview) expands many pixels tall.
- **Sticky footer**: Save / Cancel pinned to viewport bottom while the composer is in view. Once the user scrolls past the composer, the footer scrolls with the document.
- **Existing fields edit-during-composer**: today's edit path is unchanged; both committed-edits-on-existing and pending-edits coexist visually because the dashed border on the composer is the only distinguishing affordance.

## Risks & footguns

- **`useFieldEdit` divergence**: pending-mode changes to `useFieldEdit` must not regress the persisted-edit path. Keep the new branch behind an optional prop and default-off.
- **Layout shift jank**: variable row heights (especially `single-image` previews) cause big visual jumps on toggle. The animation + scroll anchor combo is what makes this feel intentional rather than chaotic. Worth real-device testing on mobile before merging.
- **Sticky footer + iOS Safari**: `position: sticky` inside a scrolling container can be flaky. Confirm in the actual app shell, not just the dev preview.
- **`usePendingForms` hook surface change**: dropping the `saved` bit, dropping `cardOrder`, renaming methods — touches every caller. Do the hook change and the FieldList integration in the same commit so the tree is never half-migrated.
- **Already-persisted Templates appear in the picker** (intentional this round): if "Description" is already on the card, the user can check it again in the composer and a second Description gets added. Acceptable for prototyping (some Templates *are* meant to appear multiply: Tags, Notes), but worth flagging — the in-situ pattern makes the mistake more plausible than the old picker did.

---

## Project Context Management

After verification is complete, update project documentation:

1. **ISSUES.md** — Mark off any items related to:
   - "Pick a template…" awkward picker UX.
   - DataField multi-add ergonomics.

2. **IMPLEMENTATION.md** — Short note explaining: the unified pending-draft path (`usePendingForms` for both modes), `useFieldEdit`'s pending-mode parameter, and the in-situ checkbox-swap-with-Component pattern (so future Component types know they need to render reasonably whether persisted or pending).

3. **LATER.md** — Add deferred items:
   - Reorder of fields — both pending (within composer) and persisted (within DataCard). Design as a single coherent UX. May involve drag handles, may involve the "promote pending row out of composer into the persisted list" idea.
   - `category: string` field on `DataFieldTemplate` + grouped/collapsible picker UI (deferred until seed/Template count makes a flat list unwieldy).
   - Filter or visually mark Templates already persisted on this node (so the composer doesn't quietly invite a double-add). Higher priority under the in-situ model than under the old separate-picker model.
   - Template-authoring UI; category management UI; normalized `categories` table.
   - Picker search / filter.
   - Pending state persistence across page reload (more robust than current localStorage scaffolding).
   - Delete the legacy `CreateDataField` component once the Field Composer has been in use long enough to confirm we don't want to fall back to it.
