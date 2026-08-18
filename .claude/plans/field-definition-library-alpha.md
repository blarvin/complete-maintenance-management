# The Library alpha — implementation plan

## Context

`SPECIFICATION.md → The Library` was written and committed (`3f74fdb`, 2026-08-17) but
nothing is built. Several open items are waiting on it: a Field's Config band has no
Definition to link to (ISSUES Features #8), a Definition row shows nothing but its label
(#11), two same-named Definitions cannot be told apart (#7), and "what happens when you
re-configure a Field" had no answer (#9). All of them need the Library to *exist as a
destination* first.

The alpha delivers exactly that: a `Field Library` Node pinned at the top of ROOT, each
FieldDefinition a child Node with a Data Card, and that card's Fields being the
Definition's config — editable, history-tracked, and propagating downstream to every
bound instance.

**Design decisions already settled in SPEC** (do not re-open while implementing):
a Definition is `kind: node`; identity is `definitionId === id`; the defined kind is a
write-once config Field; there is no tree switcher; `compound` is retired; editing
mutates in place and flows downstream only.

---

## What already works, and must not be rebuilt

Worth knowing before touching anything — most of the rendering falls out of making a
Definition a `node`:

| Concern | Why it already works |
| --- | --- |
| Definitions list in the Library's children gutter | `isReRoot('node')` is true, so `useElementChildren(id, 'nodes')` returns them |
| Each Definition gets a Data Card | `canHaveChildren('node')` is true → `TreeNodeDisplay.showDataCard()` |
| Config rows render as Fields | `useElementChildren(defId, 'fields')` returns the config children (all inline kinds) |
| Config edits are history-tracked | `shouldLogHistory('library')` is true; `DataFieldDetails` already draws a History band |
| Definitions stay out of the node index | `nodeIndexSubscriber` / `seedNodeIndexFromDb` scope to `treeType === 'business'` |
| No stray `::jobs` lens on a Definition | `provisionBackfill` skips non-business trees |
| Every existing consumer of a Definition | They read the `Definition` **read-model view** (`{id, kind, label, config, …}`) from `IDBAdapter.buildDefinitionView`, never the Element. Keep that view's shape identical and `handlers.ts`, `useLensPolicy`, the Kind band and all four kv renderers need no change. |

**`buildDefinitionView` is the seam that absorbs this whole change.** Deriving `kind`
from the kind config child instead of the `kind` column is what keeps the blast radius
inside `IDBAdapter`.

---

## Commit 1 — DATA (headless; no visible change, tests green)

### New constant
`src/data/definitionIds.ts` (import-free by design, so policy modules can read it):
add `LIBRARY_ROOT_ID = 'library_root'`.

### `src/kinds/configElements.ts`
- **`serializeConfig` stops being sparse.** Today `if (value === undefined) continue`
  means an unset knob has no Element — no row, nothing to tap. Emit a child for *every*
  schema entry, with `value: null` when unset.
- **Prepend the kind child**: `configChildId(defId, 'kind')`, `kind: 'enum-kv'`,
  `name: 'Kind'`, `value: <the defined kind>`, `siblingOrder: 0`. The signature already
  takes `kind`, so no call site changes.
- **Add `readDefinedKind(defId, getChild)`** — the bootstrap read `buildDefinitionView`
  needs before it knows which schema applies.
- **`assembleConfig` must skip `value: null` children**, so the assembled `config` object
  stays sparse and byte-identical to today's. This is what protects every downstream
  consumer.

### `src/data/storage/IDBAdapter.ts`
Five edits, all small:
- `listDefinitions()` — `e.definitionId === e.id` replaces `e.parentId === null`; the
  config-child map (`:87`) uses `e.definitionId === null` in place of `e.parentId !== null`.
  **This inverse is the one that breaks first**, since Definitions now have a parent.
- `getDefinition(id)` — gate on `def.definitionId === def.id`, not `parentId !== null`.
- `buildDefinitionView` — `kind` comes from `readDefinedKind(...) ?? def.kind`. Everything
  else about the returned view is unchanged.
- `createDefinition` — writes `kind: 'node'`, `parentId: LIBRARY_ROOT_ID`,
  `definitionId: input.id`. The `CREATE_DEFINITION` payload already carries the defined
  kind, so no command-type change.
- `listRootElements()` — admit `treeType === 'business'` **or** a `library` root, so the
  Library Node appears at ROOT. `DEFINITION_WRITTEN` emit (`:495`) switches to the
  self-reference test. Leave `nextSiblingOrder(null)` business-only — the Library Node is
  seeded at a fixed order and never minted through it.

### `src/data/services/seedDefinitions.ts`
- Bump `SEED_VERSION` to `9`.
- Write the Library Node first: `kind: 'node'`, `name: 'Field Library'`,
  `parentId: null`, `treeType: 'library'`, `siblingOrder: -1` — the `-1` is the pin, so
  no view-level sorting is needed.
- Each seed: `kind: 'node'`, `parentId: LIBRARY_ROOT_ID`, `definitionId: seed.id`.
  `SeedRow.kind` keeps meaning the *defined* kind and flows into `serializeConfig`.

### `src/data/storage/db.ts`
**Version 12**, same stores as v11, clear-on-upgrade — the v10/v11 pattern.
(Note: ISSUES Architecture #20 currently says "Dexie v11"; the schema is *already* at
v11, so that line needs correcting to v12.)

### Retire `compound`
- `src/kinds/configSchema.ts` — replace the single `thresholds` entry with four
  `number-kv` entries (`Threshold LL / L / H / HH`), dropping `members`, `pack`, `unpack`
  and `validate` on it.
- `src/components/DataField/numberKvState.ts` — flatten `NumberKvConfig`'s `thresholds`
  object into four top-level numbers; `packThresholds` goes away, `validateThresholds`
  and `computeNumberKvState` read the flat keys. This is what makes the retirement real
  rather than cosmetic.
- Delete `src/kinds/compound.manifest.ts` and its registry / capability / placement /
  `mintVia` / `KindValueMap` entries, plus `CompoundField` in `ConfigValueFields.tsx`.
- `src/components/ConfigRows/ConfigRows.tsx` — remove the `members` expansion branch; the
  four thresholds are now four ordinary schema entries, which is what it already drew.

*If the kind deletion fights, land the schema + `numberKvState` half and leave the dead
manifest for a follow-up — the doc claim is about the config shape, which is the half
that matters.*

### Tests to update
`seedDefinitions.test.ts` (its `libraryDefs` helper filters on `parentId === null`),
`libraryFixtures.ts`, `fullCollectionSync.test.ts`, `nodeIndexSubscriber.test.ts` and
`provisionBackfill.test.ts` fixtures (both use `kind: 'logbook', parentId: null` rows),
and `numberKvState.test.ts` for the flattened thresholds.

---

## Commit 2 — UI (the Library becomes visible and editable)

### `src/components/views/RootView.tsx`
Likely **no change**: `listRootElements` now returns the Library Node, it sorts first on
`siblingOrder: -1`, and `isReRoot('node')` passes the filter. Verify rather than assume.

### `src/components/views/BranchView.tsx`
- Suppress `CreateNodeButton` when the parent is the Library Node — a bare `node` created
  there would be a Definition with no self-reference and no config.
- Project the subtitle: a Definition row shows its id
  (`child.definitionId === child.id ? child.id : child.subtitle ?? ''`). **Projected at
  render, never stored** — storing it would put it in the sync stream and leak into
  business contexts.

### `src/components/TreeNode/TreeNodeDisplay.tsx`
- Add `definitionId?: string | null` to the props (both views already have the Element).
- Suppress the **Delete Asset** button for the Library Node and for Definitions — delete
  is admin-only per SPEC.
- Pass `isDefinition` through to `FieldList`.

### `src/components/FieldList/FieldList.tsx`
The one genuinely new mechanism. When the node is a Definition:
- Resolve its defined kind via `getDefinitionQueries().getDefinitionById(nodeId)` (same
  `createResource` pattern the kv renderers already use).
- Build a `Map<childId, ConfigSubField>` by walking `CONFIG_SCHEMAS[definedKind]` and
  constructing ids **forward** with `configChildId` — no id parsing, per
  `configElements.ts`'s own contract.
- Pass each config row its schema entry's `options` / `dynamicOptions` down as `config`,
  and `readOnly` for the `kind` row.

**Why this is required, not polish:** `DataField` passes only `definitionId` to the
Renderer, and a config child's `definitionId` is `null`. Without this, every `enum-kv`
config row (`Affix position`, `Display format`, `Nominal mode`, and the new `Kind`)
renders an empty dropdown.

### `src/components/DataField/DataField.tsx`
Add optional `config?: DefinitionConfig` and `readOnly?: boolean`; forward both to the
`<Dynamic>` Renderer. The renderers already accept `props.config` — nothing passes it today.

### `src/components/DataField/ConfigValueFields.tsx` → real editors
`FlagField` and `StringListField` are currently one-line read-only formatters. They become
editable renderers on the standard path (`commitWithUndo` + `UPDATE_ELEMENT_VALUE`), and
gain the `FieldRendererProps` shape (they take only `value` today):
- `FlagField` — a toggle; no edit mode to enter, it commits outright.
- `StringListField` — a chips list (add / edit / remove one entry).

### `src/hooks/useFieldEdit.ts`
Thread `readOnly` so the write-once `Kind` row does not open an editor on double-tap.

### Required-config enforcement on write
In the `UPDATE_ELEMENT_VALUE` path: when the target is a config child of a Definition,
reassemble that Definition's config and run the kind's validator, rejecting on failure.
`validateNumberKvConfig` already exists and is unit-tested. One call site — the point is
that a Definition is editable forever, so the old pre-Create gate is no longer enough.

---

## Commit 3 — LIVE (edits reach mounted instances)

Downstream propagation is the reason the Library exists, and it does **not** happen for
free: the kv renderers read config through a `createResource` keyed on `props.definitionId`,
which does not change when the Definition's config does.

- **Emit `DEFINITION_WRITTEN`** from the IDBAdapter write path when the written Element is
  a config child of a Definition (the event and its remote-pull emit already exist).
- **Extract `useDefinitionConfig(definitionId)`** — one hook owning the resource plus a
  `DEFINITION_WRITTEN` subscription, replacing the near-identical `createResource` blocks
  in `TextKvField`, `NumberKvField`, `EnumKvField` and `DataFieldDetails`. The
  subscribe-before-first-fetch ordering in `FieldComposer.tsx:82-86` is the pattern to copy.
- **`useLensPolicy` gains the same subscription** — `IMPLEMENTATION.md:191` explicitly
  notes it has none *because* Definitions were fork-not-mutate, a premise this work retires.

---

## Explicitly out of scope

- **Config Fields as instances** (the "(b)" end state) — LATER.
- **The reconciler** (repair-after-delete, schema evolution). Materialize-at-create plus
  clear-and-reseed covers the alpha; config rows simply do not offer delete.
- **`disposition` wiring** and any gating/notification on propagation — the arbiter's job.
- **Definition rename propagating to instances** (ISSUES #24) — no rename UI exists to
  trigger it.
- Grouping the Library by kind or into folders, the reorder gesture, Library search.

---

## Verification

**Automated** — `npm run typecheck`, `npm run lint`, `npm run test` after each commit.
Commit 1 must be green with no UI change at all.

**By hand** (`npm run dev`, then reload to let v12 clear):
1. ROOT shows **Field Library** pinned above the assets.
2. Tap it → the nine seeded Definitions, sorted by name, each with its id on the subtitle
   line. `fd_logbook_policy` reads legibly; authored ones will be UUIDs.
3. Expand **Weight** → all thirteen `number-kv` config rows, including the unset ones
   showing `Unset` (this is the materialize-at-create change; today you would see four).
4. `Kind` is the first row, reads `number-kv`, and does **not** open an editor.
5. Edit `Decimals` to `0`; expand that row's History band and confirm the entry.
6. Toggle `Multiline` on **Description** (the `flag` editor) and edit `Status`'s options
   (the `string-list` editor).
7. Clear `Units symbol` on Weight → the write is rejected.
8. **Propagation (commit 3):** with a Weight field on some asset showing `12.34`, change
   the Definition's `Decimals` to `0` in the Library, navigate back, confirm `12`.
9. No **Delete Asset** button on the Library Node or on any Definition.

**Sync** — run `npm run wipe:fielddefs` before exercising the emulator. Old library docs
carry `parentId: null` and would pull down as orphans that fail the new identity test.

**Cypress** — `add-surface.cy.ts` (authoring a Definition, picking one from the Kind band)
must still pass; it exercises `createDefinition` and the mint path end to end.
`core-loop.cy.ts` already fails on a stale selector (Tech Debt #13) — not a regression.

---

## Project Context Management

After you confirm the implementation works:

1. **docs/ISSUES.md** — delete Features #14/#15 and Architecture #20/#21/#22/#23/#25 as
   they land. Correct #20's "Dexie v11" to **v12**. Leave #24 (rename propagation) open.
2. **docs/IMPLEMENTATION.md** — record what a future reader will ask "why?" about: that
   `buildDefinitionView` is the seam absorbing kind-as-a-Field, why `serializeConfig`
   stopped being sparse, and the `-1` siblingOrder pin. Also remove the two 2026-08-17
   annotations once the code they flag is fixed.
3. **docs/LATER.md** — file anything deferred during the build; check whether the
   *Standalone-row UX for the config-only kinds* entry can now be deleted outright.
