# Build the Add Surface as a Field row

## Context

`docs/SPECIFICATION.md → The Add Surface` was rewritten on 2026-08-15 and is the
contract this plan implements. The problem it solves: the add affordance and a
persisted Field are two different layout systems sitting in the same
neighbourhood. A Field row is a grid item in `FieldList`'s subgrid (chevron /
label / value tracks) whose details region is `display: contents` so its children
stay grid items. `AddFieldSurface` is a flex column that declines the subgrid,
takes the full row, and grows a bordered picker underneath. That divergence is
what ISSUES → Features #1 recorded, and it is why the add flow can't preview what
it will produce.

The target: the add affordance **is** a Field row that hasn't decided what it is
yet — same tracks, same chevron column, same expandable band region — with bands
**Config · Kind · Tools** in place of History · Config · Tools. Typing a name
authors a Definition; the Kind band reaches the Library for an existing one.
Create commits, Cancel discards, collapse keeps the draft.

Decisions already taken (see the SPEC; not re-litigated here): explicit
Create/Cancel rather than mint-on-pick; default kind `text-kv`; proliferation of
Definitions is intended; picked Definitions show config read-only; keyboard
support is deliberately out of scope this pass.

## What already exists and gets reused

| Need | Reuse | Where |
| --- | --- | --- |
| Value slot that buffers instead of writing | `pendingMode` on every kv Renderer | `ComposerRow.tsx:111` is the working precedent |
| Config authoring rows | `ConfigRows` | `src/components/ConfigRows/ConfigRows.tsx` |
| Read-only config display | `ConfigSummary` | shared with Field Details, so the two can't drift |
| Draft Definition state + commit | `useDefinitionDraft` | `src/hooks/useDefinitionDraft.ts` |
| Definition + instance in one motion | `CREATE_DEFINITION` then `CREATE_ELEMENT_FROM_DEFINITION` (takes `initialValue`) | `src/data/commands/handlers.ts` |
| Tree row chrome at depth | `styles/disclosure.module.css`, `AddFieldSurface.module.css` `.row`/`.rowHead`/`.rowName` | keep the CSS file, drop its two components |
| Grid tracks + chevron + expanded tint | `DataField.module.css` | imported directly by the new row |
| Undo toast | `commitWithUndo` | one action / one inverse fits now that pick-runs are gone |

## The build

### 1. Prerequisites (independent, land first)

**Construction token** — `src/styles/tokens.css`. `--color-yellow-100: #fff8dc`
already exists as a primitive, so this is one semantic line next to
`--bg-expanded`: `--bg-construction: var(--color-yellow-100);`. A hue, not
another grey, per SPEC → Style Guide — it must not read as the expanded-field
shade it sits inside.

### 2. Let a Renderer take a draft config

Blocking constraint: `TextKvField`, `NumberKvField` and `EnumKvField` each resolve
config by `createResource(() => props.definitionId, …getDefinitionById)`. A draft
has no Definition, so `enum-kv` would render with **no options** — exactly where
preview fidelity matters most.

- `src/kinds/types.ts` — add to `FieldRendererProps`:
  `config?: DefinitionConfig` ("draft config for a Field with no Definition yet;
  replaces the `definitionId` fetch when present").
- The three renderers — gate the resource and prefer the override:
  `createResource(() => (props.config ? null : props.definitionId), …)` then
  `const config = () => props.config ?? fetched()`. `SingleImageField` reads no
  config for display; check and skip if so.

Note the consequence: `TextKvField`'s `<Show keyed>` remounts the body when the
config object identity changes, so editing config in the band below re-renders
the value slot and discards an in-progress value edit. That is acceptable — and
for `enum-kv` it is required, since the options just changed.

### 3. Extract the band region

New `src/components/DetailBands/DetailBands.tsx` + `.module.css`, lifted verbatim
from `DataFieldDetails.tsx:118-243` (the `openSections` signal, the `Section`
type, the `<For>` that renders heading-or-toggle then body).

- Exported type `DetailBand` = `{ id, title, present, collapsible, defaultOpen, body }`.
- Section chrome CSS (`sectionHeading`, `sectionToggle`, `sectionChevron*`,
  `sectionBody`, `sectionNote`) moves to `DetailBands.module.css`.
- `DataFieldDetails.tsx` keeps its own `metadata` / `actionsRow` / `deleteButton`
  / `inlineWrapper` classes and renders `<DetailBands bands={sections()} />`.

**Load-bearing:** `DetailBands` must itself be `display: contents`.
`DataFieldDetails.inlineWrapper` is `display: contents` precisely so History
entries land as *direct subgrid children* of `datafieldWrapper` — a real wrapper
element here breaks that contract and the History layout with it.

### 4. Widen the draft

`src/hooks/useDefinitionDraft.ts` — **add** members only, never change existing
ones: the dormant `DefinitionAuthoringForm` still imports this hook and must keep
compiling.

- `value` / `setValue` — the instance's initial value.
- `picked` / `pickDefinition(def)` / — picking mirrors the Definition's `label`
  and `config` into the draft for display; `pickKind` clears `picked`.
- `isDirty()` — any of name / value / picked / non-default config. Drives the tint.
- `reset()` — `cancel()` plus value and picked.
- `commit(parentId, siblingOrder)` — the two Create branches in one place:
  authoring calls the existing `save()` then mints; picking mints only. Both pass
  `initialValue: value()`. Returns the created Element.

### 5. Rewrite `AddFieldSurface.tsx` in place

Keeping the filename, export and props preserves the roster id (`'add-surface'`)
and the `FieldList` call site, so nothing downstream changes.

```
<div classList={{ [df.datafieldWrapper]: true,
                  [df.datafieldWrapperExpanded]: isOpen(),
                  [styles.constructing]: draft.isDirty() }}>
   <button class={styles.plusGlyph} onClick={toggle} />        grid-column: details-chevron
   <input  class={styles.nameInput} placeholder="Add Field" /> grid-column: label
   <Dynamic component={manifest().Renderer}
            id={draftId} config={draft.config()}
            pendingMode={{ onChange: draft.setValue }} />
   <Show when={isOpen()}><DetailBands bands={[config, kind, tools]} /></Show>
</div>
```

- `draftId` — one `generateId()` per draft; `pendingMode` renderers need an id for
  `useFieldEdit`'s edit tracking, same as `ComposerRow` passes `pendingForm.id`.
- Wearing `.datafieldWrapper` is what opts the row into the subgrid. Note it now
  competes with `.fieldList > * { grid-column: 1 / -1 }` at equal specificity, so
  CSS source order decides — the same standoff `DataField` already wins today, but
  the first thing to check if the row spans the full width instead of its tracks.
- The `+` reuses the existing `.plusToggle` rotate-to-× treatment but moves into
  the grid's `details-chevron` column.
- Tint is worn whenever `isDirty()`, open or collapsed (SPEC → Committing).

**The name input, the truthful method** (settled in discussion):

```css
.nameInput {
    grid-column: label;  grid-row: 1;
    field-sizing: content;            /* card reflows to the finished width */
    min-width: var(--label-width);
    appearance: none; border: 0; outline: none; background: transparent;
    padding: 0; margin: 0; font: inherit; color: var(--text-primary);
}
.nameInput::placeholder { color: var(--text-secondary); }  /* darker than --text-placeholder */
```

Risk worth watching: `field-sizing: content` is Chromium 123+ (already relied on
by `textarea.datafieldTextarea`). Without it the input keeps its ~20ch intrinsic
width and **widens the shared `label` track for every row in the card** — the
lurch documented twice in `DataField.module.css`. If that shows up, add `size={1}`
so the intrinsic width collapses to the `min-width`.

### 6. The three bands

**Config** — memo line first, then `<ConfigRows>` while authoring or
`<ConfigSummary>` when a Definition is picked. Default open.
The memo is a new `authoringMemo?: string` on `ManifestIdentity`
(`src/kinds/types.ts`), set on the four inline manifests. It must **not** go into
`ConfigSubField` / `CONFIG_SCHEMAS` — SPEC and ELEMENT-MODEL both say a memo is
authoring chrome that is never stored, and those arrays drive `serializeConfig`.

**Kind** — one row per `FIELD_KINDS ∩ admittedKinds`, labelled from
`getKindManifest(k).pickerLabel`. Tapping the row selects the kind
(`draft.pickKind`); its chevron expands to that kind's Definitions, from a single
`listDefinitions()` resource filtered by `isInline` and grouped by `d.kind`,
sorted by label. Picking one calls `draft.pickDefinition`. The selected kind
carries a persistent marker class — SPEC is explicit that this is draft state,
not browser focus, which wouldn't survive the next tap. Rows reuse
`AddFieldSurface.module.css`'s `.row`/`.rowHead`/`.rowName` and
`disclosure.module.css`.

**Tools** — Create + Cancel. Create is gated by the same `blocker()` that
`DefinitionAuthoring.tsx:56-61` uses (name non-empty, `draft.configError()`,
`CONFIG_VALIDATORS[kind]`) and is unblocked outright when a Definition is picked.
Create routes through `commitWithUndo` for the existing "Field added" toast.

### 7. Delete the superseded components

`LibraryPicker.tsx` and `DefinitionAuthoring.tsx` lose their only caller. Delete
both in the same commit. **Keep `AddFieldSurface.module.css`** — the row, peek,
nested and authoring classes are what the new bands are built from; prune only
what ends up unreferenced (`.picker`'s `border-left`, `.addButton`, `.addGlyph`).

### 8. Cypress

New `cypress/e2e/add-surface.cy.ts`, following `core-loop.cy.ts`'s
`cy.freshVisit()` / `cy.createNode()` / `cy.expandCard()` helpers
(`cypress/support/e2e.ts`). Three cases, click-path only:

1. Type a name → Create → the field row exists with an empty value, and the
   Definition is in the Library.
2. Kind band → Number → pick an existing Definition → a second row mints.
3. Type a name → collapse the row → reopen → the draft is still there.

This is the first coverage of the surface at all (ISSUES → Tech Debt #12).

## Verification

```
npm run typecheck
npm run lint                    # eslint-plugin-solid at error, incl. solid/reactivity
npm run test                    # vitest — no component tests reach this surface by design
npm run dev                     # then the hand-test below
npm run cypress                 # needs emulator + dev server up
```

Component tests structurally cannot reach any of this: `vitest.config.ts` has no
Solid transform and nothing test-reachable may import a `.tsx`. Cypress and the
hand-test are the real gates.

Hand-test, in order:

1. **Caret** — expand a card, open the add row, type. Caret visible. Same in a
   `ConfigRows` input and the Internal Link field (the Bugs #3 report).
2. **Alignment** — the `+` sits in the same column as the rows' chevrons, and the
   name input starts exactly on the label column.
3. **Reflow** — type a long name; the card's label column grows and every row's
   value column re-flows with it. This is intended; confirm it settles rather
   than jitters.
4. **Shortest path** — name only → Create → an unfilled text field appears at the
   bottom of the card.
5. **Value on the row** — name + value → Create → the field lands populated, with
   one create-history row carrying the value (not a null create then an update).
6. **Kind change** — type a name, open Kind, pick Number: the name survives, the
   Config band re-renders, config resets. Confirm the value slot becomes a number
   renderer.
7. **Enum preview** — pick Enum, add options in the Config band, confirm the value
   slot offers them. This is the case step 2 of the build exists for.
8. **Pick an existing** — Kind → Number → a seeded Definition: name fills, config
   shows read-only, Create mints the instance and coins no Definition.
9. **Collapse keeps the draft** — half-fill, collapse, confirm name and value are
   still shown and the tint is still on. Reopen, Create.
10. **Cancel** — discards, tint clears, nothing written.
11. **Phone width** — at `--container-max` 650px and narrower, check the Kind band
    nested under Config nested in an indented card (ISSUES → Tech Debt #11, which
    hand-tested fine before this change and should get better, not worse — the
    `.picker` border-left and its extra indent are gone).

## Project Context Management

After the user confirms the implementation works:

1. **docs/ISSUES.md** — delete Features #1 and #2, and Bugs #3 (the caret fix).
   Update Tech Debt #12 to whatever coverage remains missing rather than deleting
   it — the keyboard model stays untested by explicit decision.
2. **docs/IMPLEMENTATION.md** — add notes only for the two non-obvious choices a
   future reader will ask about: why a Renderer accepts a `config` override
   (a draft has no Definition to fetch from), and why `DetailBands` is
   `display: contents` (History entries must stay direct subgrid children).
3. **docs/LATER.md** — already carries search, edit-as-fork and arbitrary groups
   from the spec pass. Add anything else the build surfaces.
4. **docs/SPECIFICATION.md** — no change expected; it was written to this design.
   If the build contradicts it, the SPEC is what's wrong and gets corrected.
