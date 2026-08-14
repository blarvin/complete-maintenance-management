# ADD-SURFACE-WORKPHASE-II — Authoring, tree-native

> Supersedes the first Phase II plan (`54f72e2`), which specced authoring as a
> segmented kind control plus a config form. That was a form wearing the tree's
> clothes, and the whole branch exists to not do that. Reverted in `bad3f75`.

## Context

Phase I restored *picking* a Definition. Authoring one — coining a fact the
Library doesn't have yet — is still unreachable: the only authoring UI is
`DefinitionAuthoringForm`, inside the dormant composer.

**Authoring must be the tree.** Not a picker plus a form, but rows and chevrons
all the way down, the same disclosure gesture as everything else:

```
▾ + New Field Definition
   ▸ Text
   ▾ Number
       Name              [ Discharge Pressure ]
       Units symbol      [ psi ]
       Decimals          [ 2 ]
       ▸ Display & nominal
       ▾ Alarms & freshness
           ▾ Thresholds
               Low low   [ 0 ]
               Low       [ 2 ]
               High      [ 8 ]
               High high [ 10 ]
           Refresh seconds [ 3600 ]
       Create Number Definition
   ▸ Enum
   ▸ Image
   ▸ Internal Link
   ▸ External Link
▸ Description
▸ Serial Number
```

The kind choice **is which row you expand**. Config sub-fields are rows at that
level; grouped and advanced config nests one level deeper. `number-kv`'s
three-tier progressive disclosure (SPEC → ELEMENT-MODEL → number-kv) stops being
a form idiom and becomes tree depth, which is what it was always describing.

**Phase gate:** `typecheck`, `lint`, Vitest green, and a hand-test authoring a
Definition of each kind and using it in one motion.

## Strategy decisions

1. **`ConfigForm` is left exactly as it is** — required on `InlineManifest`, all
   four still wired. The new authoring simply never reads it. This is the
   opposite of last plan's optional-override churn, and it is what the
   no-deletion posture (ISSUES #11) actually implies: leave the old machinery
   alone and build beside it. `ConfigForm` becomes dead-but-harmless exactly like
   the rest of the composer, and the dormant surface keeps working verbatim.
2. **Nesting comes from data, not from special cases.** Three declarative
   additions to `ConfigSubField` cover every shape the catalogue needs: `group`,
   `members`, `visibleWhen`. A kind never declares layout.
3. **Cross-field invariants become validation, not components.** The threshold
   chain already lives on the compound's `validate`; the rules that span
   sub-fields (`currency ⇒ currencyCode`, `default ∈ options`) get a per-kind
   `validateConfig`. `validateNumberKvConfig` already exists in `numberKvState.ts`
   and is component-free — reuse it rather than writing a second one.
4. **Every row is a `treeitem`, including leaf config rows.** Focus lands on the
   row with its focus ring; Enter or Space *activates* it — expanding a parent,
   or opening the editor on a leaf; Enter saves and Escape cancels, both
   returning focus to the row.

   This is not a new interaction: it is exactly what every DataField value
   already does. `useFieldEdit.valueKeyDown` (`useFieldEdit.ts:262`) begins
   editing on Enter/Space, `inputKeyDown` (`:225`) saves on Enter and cancels on
   Escape, and `TextKvField` renders the resting row as `role="button"` with
   `aria-description="Press Enter to edit"`. SPEC → Keyboard already specifies
   it. Reusing it means config rows behave like value rows, which is the whole
   point of the surface being the tree.

   There is therefore **no arrow-key/caret conflict**: you are only inside an
   input after activating it deliberately, and you leave deliberately. Arrows
   navigate the tree whenever a row is focused, and move the caret whenever an
   editor is open. (An earlier draft of this plan split rows into treeitem and
   non-treeitem to dodge a conflict that this idiom simply does not have.)

   Activation differs by control, as it already does per kind: a `flag` toggles
   outright, an `enum-kv` opens its select, a text or number row opens its
   editor.
5. **Commit is a Create row at the bottom** of the expanded kind (confirmed),
   not Enter-on-name — required config means the gate has to be visible.
   Committing reuses Phase I's `pick()`, so authoring and using stay one act.

## Steps

### 1. Schema: `group`, `members`, `visibleWhen`, `validateConfig` — commit

`src/kinds/types.ts` (`ConfigSubField`) and `src/kinds/configSchema.ts`. All
component-free, all unit-testable without JSX — `configElements.test.ts` is the
precedent.

- **`group?: string`** — sub-fields sharing a label render inside one expandable
  group row, in first-appearance order. Absent = top level. Populate
  `NUMBER_KV_CONFIG_SCHEMA`: `Display & nominal` for the format/nominal knobs,
  `Alarms & freshness` for thresholds + `expectedRefreshSeconds`.
- **`members?: { key, label, kind }[]`** — an atomic compound's authorable parts.
  The `thresholds` entry stores one `{lowLow, low, high, highHigh}` object, but
  the draft config already carries those four as **flat keys** (`packThresholds`
  reads them off the flat object) — so `members` is purely how authoring renders
  them, and storage is unchanged.
- **`visibleWhen?: (config) => boolean`** — value-driven conditional reveal:
  `currencyCode` only when `displayFormat === 'currency'`; `nominalMin`/`Max`
  vs `nominalValue`/`tolerance` by `nominalMode`.
- **Per-kind `validateConfig?: (config) => string | null`** on the manifest
  (declared in `configSchema.ts` so it stays component-free). `number-kv` points
  at the existing `validateNumberKvConfig`; `enum-kv` gets `default ∈ options`
  plus non-empty `options`.

Tests: `visibleWhen` predicates, group ordering, and that `serializeConfig` /
`assembleConfig` round-trips are **unchanged** by any of it.

### 2. `ConfigRows` — the editable rows

New `src/components/ConfigRows/`. Bound to the draft config object (flat), not
to Elements — nothing exists to parent a sub-field Element to until commit, and
`serializeConfig` builds the subtree then, as it already does.

Four row kinds, one recursive component:

| Row | From | Renders |
| --- | --- | --- |
| scalar | `flag` / `number-kv` / `text-kv` / `enum-kv` | label + control, no chevron |
| group | `group` on ≥1 sub-field | chevron row; children are its members' rows |
| compound | `members` | chevron row; children are member rows, packed by existing `pack` |
| list | `string-list` | chevron row; item rows + an `+ add` row + per-item remove |

Skips any sub-field whose `visibleWhen` is false. Re-runs the sub-field's own
`validate` on write and the kind's `validateConfig` on every change, surfacing
one error line.

Reuses the picker's chevron classes so the disclosure is visually identical —
lift them out of `AddFieldSurface.module.css` into a shared place rather than
copying, since this is now the third consumer.

### 3. The authoring subtree

`LibraryPicker` gains a `+ New Field Definition` row **inside** the tree this
time (last plan put it outside to dodge an index bug — see step 5, which fixes
the cause instead). Expanding it lists one row per admitted kind; expanding a
kind row shows:

1. **Name** — text input row, required, max 50.
2. **`ConfigRows`** for that kind.
3. **`Create <Kind> Definition`** — disabled until name is non-empty and
   `validateConfig` passes; on click, `useDefinitionDraft.save()` then the
   caller's `pick()`.

`useDefinitionDraft` is reused unchanged, but **one draft per expanded kind row**
— expanding Number then Text must not carry units across. `pickKind` already
batches kind+config, so a draft per row is the simpler read.

### 4. Roving focus over a nested tree

The Phase I `move()` walks `[role="treeitem"]` in document order and holds a flat
`activeIndex`. Document order *is* visual order for a tree, and collapsed
subtrees aren't in the DOM, so arrows keep working as depth arrives — but the
index must be derived from the row's position in the live query, **not** from a
`<For>` index, which is what broke last time. Compute the active row by
comparing DOM nodes, not integers.

Per strategy #4 every row participates, so the whole surface is one keyboard
model:

| Key | On a parent row | On a leaf config row |
| --- | --- | --- |
| ↑ / ↓ | move between visible rows | same |
| → | expand | (nothing) |
| ← | collapse, or move to parent | move to parent |
| Enter / Space | expand or collapse | **activate the editor** (or toggle a flag) |
| Enter *while editing* | — | save, focus returns to the row |
| Escape *while editing* | — | cancel, focus returns to the row |
| Escape | dismiss the picker | dismiss the picker |

Returning focus to the row after save/cancel is the one piece `useFieldEdit`
does not already do — it owns the input's lifecycle, not the tree's.

### 5. Verification battery, then commit

## Verification

1. `npm run typecheck`, `npm run lint`, `npm run test` → green. New tests from
   step 1; `configElements` is the canary that storage is untouched.
2. **Dev boot** (offline or `?emulator=true`, never production Firestore):
   - `+ New Field Definition` expands to six kind rows; each expands to its own
     config as rows.
   - **Text**: name + four scalar rows, no groups. Create → the Definition
     appears *and* an unfilled field of it lands on the card in one motion.
   - **Number**: `Display & nominal` and `Alarms & freshness` as nested group
     rows; `Thresholds` nests one deeper into four member rows; a broken chain
     blocks Create with one error line; `currencyCode` appears only when
     `displayFormat` is currency; `nominalMode` swaps which nominal rows show.
   - **Enum**: options as a list row with add/remove; the default row constrained
     to the options entered.
   - Expand Number, then Text — no config carries across.
   - Collapse mid-authoring → draft discarded, nothing written.
3. **Keyboard**: arrows traverse kinds → config groups → compound members;
   Enter on a leaf opens its editor and Enter saves it, exactly as double-tapping
   a DataField value does; Escape cancels; focus lands back on the row both
   times. Arrows move the caret while an editor is open and the tree when it
   isn't — confirm the handoff both ways.
4. **Regression**: Phase I picking, multi-pick coalescing, the config peek,
   and Field Details (`32438db`) all still work.

## Out of scope

Editing an existing Definition (authoring only ever adds), the cascade arbiter,
reordering, and the tree switcher. `ConfigForm` and the four config forms stay
on disk, wired but unread by this surface.

## Project Context Management

After the coding work is believed complete, ask the user to run the Verification
steps. **Only if the user confirms it works:**

1. **docs/SPECIFICATION.md** — the *Authoring a Definition* section currently
   describes a kind picker, a label input and a ConfigForm override. Rewrite it
   as the tree, and retire the "ConfigForm is an override earned by cross-field
   invariants" rule — invariants are validation now, not a component. Retired
   text to SUPERSEDED.md.
2. **docs/ISSUES.md** — delete #10 (read-only config, settled by `ConfigSummary`).
   File that `ConfigForm` is now unread by any live surface.
3. **docs/IMPLEMENTATION.md** — the three schema additions and why nesting is
   data; the draft-per-kind-row rule; the DOM-node-not-index focus fix.
4. **docs/LATER.md** — whatever the hand-test defers.
