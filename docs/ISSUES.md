# ISSUES.md — Active Work Queue

Live queue of open work, ordered by priority within each section. Completion lives in git history, not here.

**House rules:**

- **Only open items.** When done, **delete** — don't check off. The code is the record.
- **One-line outcomes**, not task breakdowns. "Delete with undo" beats five bullets about dialogs + snackbars + cascades. Say where it came from — "surfaced in the Phase IV hand-test", "same in the Qwik original". An item with no provenance is a guess.
- **One screen where it counts.** Bugs and Features stay scannable — prune to LATER.md or delete. The themed sections and Tech Debt are long tails; sweep them when they stop being read.
- **Sections group; position is a hint, not a queue.** Work is picked by what's worth doing, not by order. No statuses. A bracketed `[tag]` may appear anywhere in an item, meaning whatever it needed to mean that day — ad-hoc, never a vocabulary.
- **Agents append to the bottom** of a section, and only file what they observed. Reordering is the dev's.
- **Bugs first**, then Features, then Tech Debt.
- For deferred ideas see LATER.md. For product scope see SPECIFICATION.md.

**This pass's tag:** `[Fields UI]` marks work bound to the composer
(`FieldComposer/`, `pendingFields:` drafts) and the legacy "+ Add Field"
(`CreateDataField`). Both are now **dormant** — the tree-native Add Surface
landed 2026-08-15 and runs alone — so tagged items describe surfaces nothing
mounts. Whether they are fixed or deleted follows Tech Debt #9, not this tag.
(`pendingMode` is no longer in that set: the Add Surface's value slot uses it.)

`[auto]` marks items the agent may take end-to-end without checking in — each is
self-contained and verifiable by typecheck/lint/test. One commit per item, which
also deletes the item from here. Agreed 2026-08-11; `git push` stays manual.
Nothing carries the tag right now.

**Don't cite item numbers from outside this file.** Items are deleted when done
and the rest renumber, so an ordinal in a code comment or another doc rots the
moment the work lands. Cite the stable bolded phrase in IMPLEMENTATION.md
instead (`IMPLEMENTATION.md → *Retention over reconciliation*`), or the plain
mechanism. Swept across `src/` 2026-08-14, when all 24 in-code pointers had gone
stale or dangling.

---

## Bugs

1.) **[Fields UI] Composer draft loses the uncommitted keystrokes** — a ticked row survives reload (localStorage `pendingFields:<nodeId>`), but text still sitting in its editor does not: the value only reaches `setPendingValue` when the renderer commits (Enter / blur / outside-click via `pendingMode`), and a reload commits nothing. Falls short of the intended "tick + type, reload, rows restored". Flush the edit buffer on `beforeunload`/`visibilitychange`, or write through per keystroke in `pendingMode`. Pre-existing (same commit-on-blur structure in the Qwik original); surfaced in the Phase IV hand-test.

2.) **number-kv accepts radix literals** — `parseNumber` (numberKvState.ts) uses `Number`, which parses `0x1A` as 26, `0b101` as 5, `0o17` as 15 (verified at a node prompt). Harmless in practice — nobody types hex into a temperature field — and strictly better than the `parseFloat` it replaced, which read `0x1A` as 0. Rejecting them needs a full-string decimal/scientific regex. Left in deliberately when Bugs #1 was fixed; raise only if it ever bites.

3.) **Internal Link does not admit value edit.** - Decide UX: Name of link should be fixed at mint-time, only editable through the library? (Or maybe Settings with back-propagation to the Library??) But either way, the actual kv value should be editable.


## UI, styling, layout

1.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

2.) **Text entry in Add Field/Name longer than current column width widens the columnn across the app**

3.) **Field Value no longer aligns with current value's metadata string.**

4.) **Number config rows in the Library render with 2 decimals** — `Decimals: 2.00`, `Staleness (seconds): 604,800.00`, `Max words: 2.00`. A config row is a real `number-kv` Field now, and `FieldList` hands it `{}` as config, so `formatNumber`'s `decimals ?? 2` default applies. Passing `{ decimals: 0 }` instead would be wrong for `Tolerance: 0.5`, so the fix is a "plain number, no fixed precision" path in `formatNumber` rather than a different default. Surfaced in the 2026-08-18 Library hand-test.

5.) **A materialized-but-unset config row reads `Empty`, not `Unset`** — the two words are a real distinction (`ConfigValueFields`: unset means the kind's own default applies; empty means nobody has recorded the fact yet), but only the `flag`/`string-list` read-only path still says `Unset`. A `text-kv` or `number-kv` config row goes through that kind's ordinary renderer, which says `Empty`. Now that every knob is materialized, this is the common case. Surfaced in the 2026-08-18 Library hand-test.

6.) **`visibleWhen` is not applied on a Definition's card** — Weight shows `Nominal min`/`Nominal max` *and* `Nominal value`/`Tolerance`, which is exactly the contradictory pair the Add Surface's `ConfigRows` uses `visibleWhen` to prevent. Materialization writes every knob (correctly — the row has to exist to be set later), so the reveal rule has to move to render time on this surface too, reading the assembled config. Surfaced in the 2026-08-18 Library hand-test.


## Features

1.) **Build the Add Surface as a Field row** — SPEC → *The Add Surface* is rewritten and settled (2026-08-15): shared row shell with a `field` / `adder` role, `＋` in the chevron column, chrome-less name input in the label track sizing to content, the draft kind's real Renderer in the value slot via `pendingMode`, and bands **Config · Kind · Tools** replacing History · Config · Tools. Create/Cancel in Tools; collapse keeps the draft; construction tint whenever a draft is held. Retires `LibraryPicker` and `DefinitionAuthoring` as separate surfaces. Keyboard is explicitly out of scope for this pass (SPEC → Keyboard & Accessibility).

2.) **Group the Library by kind under the Kind band** — one row per admitted kind, expanding to that kind's Definitions. A view, no re-parenting. Now reads a Definition's `kind` config Field rather than its `kind` column (Architecture #21), and should share one grouping function with the Library Node's children rather than growing a second. Search in the name slot is the deferred follow-up (LATER → *FieldDefinition Library*).

3.) **Node metadata in TreeNodeDetails/Config** — show `createdAt`, last `updatedAt`, last `updatedBy`, 'id', 'version', and description/byline. It already shows "from <libraryField>".

4.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

5.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't. This feature belongs to the NodeDetails section.

6.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

7.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

8.) **Active link to FieldLibrary from Config section of a Field** — now has a destination to point at (Features #14), and the reveal machinery landed on this branch (`useRevealOnArrival`), so the shape is reveal-the-Definition rather than re-root-to-the-Library. Also the answer to Features #9 and to LATER → *Editing a picked Definition's config from the Add Surface*, which wants the same link from the Add Surface's Config band. One affordance, three callers.

9.) **Decide Field "re-configure" UX** — **decided 2026-08-17** (SPEC → *Edit / Delete Semantics*): divert to the Library, edit there, and it propagates to all bound instances. Not a fork, and never upstream from an instance. What is left here is the affordance — a Field's Config band needs a live link to its Definition's Node (same want as Features #8), and eventually a "N instances affected" statement before the write lands.

10.) **Should TreeNodeDetails/History always be expanded default?** - Or a config of the Field? One of [always, toggleable]. Or A/B test to determine the best UX. 1+2 or flat 3, or something else?

11.) **Should TreeNodeDetails' subsections be reorderable?** - It could easily be part of the authoring config. But should it?

12.) **Change TreeNodeDetails/Config to /"Settings"?** - Decide what, if anything, can be edited from there. If nothing, then why show it? Even though it shows info from config, user-facing idea is "settings".

11.) **A Definition row in the Kind band shows nothing but its label** — the old picker let you expand a Definition to peek at its config before picking; the Kind band drops that, because picking now loads the config into the Config band read-only. Cheaper to compare two same-named Definitions if the row itself carried id, version, createdAt, createdBy, description/byline. Reframed 2026-08-15 when the peek went away (was "Add Field Picker / Option / Expand Chevron should show metadata…").

13.) **Single Image Field / History is just the history of the caption.** - Decide composite Field structure and layout. 

14.) **Build the Library as a place in the tree** — SPEC → *The Library* is written and settled (2026-08-17): a `Field Library` Node pinned at the top of ROOT, Definitions as its child Nodes (`kind: node`), each Definition's config as ordinary editable Fields on its Data Card. No switcher, no new view layer — an ordinary `BRANCH` reached by re-rooting. Subtitle carries the Definition's id for now (the placeholder answer to Features → *namespace collision scheme*); `ElementIdRow` already renders a copyable id. Sort children by `name` — every Definition is minted at `siblingOrder: 0`, so the adapter's sort is effectively insertion order.

15.) **Editable renderers for `flag` and `string-list`** — both are read-only one-liners today (`ConfigValueFields.tsx` formats the value to text and stops), which was fine while config was never surfaced as rows. The Library makes config editable, so they need a real toggle and a real chips list. LATER predicted this exact moment; it is no longer deferred. Blocks Features #14.





## Architecture

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

1.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#4). Detail parked in LATER.md → typed trees.

2.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

3.) **The rest of the catalogue (#6c)** — the `Edges` family (`other-end` / `approval`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md. The fourth Edges member landed separately as `external-link` (2026-08-12); these three still wait on the overlay (#1) or on `ElementHistory` reads.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive` — the traversal itself is built (`gatherAncestors`, nearest-first), so what remains is the arbitration. The disposition vocabulary is already encoded on the schema; this wires it.

6.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites. The nested-job half is gone (sub-jobs decided against 2026-08-12, ELEMENT-MODEL §job); what remains is one deep job appearing in every ancestor above it.

7.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

8.) **[Fields UI] `NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted.

11.) **[Fields UI] `internal-link` real target picker** — the target is still a raw element-id paste. Editing a saved link landed 2026-08-16; the picker is the remaining half, and it needs the address (nearest ancestor + name) in its result rows for the same disambiguation reason the value cell does. Whether it should be *constrained* by `TargetSpec.allowedKinds` is a spec decision first — LATER → *§6b minimal kind set*.

12.) **[Fields UI] Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

18.) **`resolveEdge` cannot tell a deleted target from a live one** — `getElementById` is a bare `db.elements.get(id)` (`IDBAdapter.getElement`), unlike `listChildElements` directly beside it, so a soft-deleted `internal-link` target keeps resolving: the row renders its address and still offers `→`, which reveals into a card whose filtered child list no longer contains it. Soft delete not cascading (SPEC → *Soft Deletion*) adds a second case no per-row check catches — a target beneath a deleted ancestor carries `deletedAt: null` and looks healthy while being unreachable. Widen `resolveEdge` to a status (`live | deleted | unreachable | missing`) and render the four distinctly, keeping the last-known name on a tombstone rather than collapsing to a bare id. **`missing` must never read as deleted** — an unresolvable id may simply not have synced down yet, the same reasoning as IMPLEMENTATION.md → *Retention over reconciliation*. This is also the seam `ValiditySpec` plugs into when `approval` lands. Read from the code 2026-08-16; the docstring in `InternalLinkField.tsx` asserted the opposite and was corrected in the same pass.

19.) **Renaming an Element has no caller, and for a Field no decided semantics** — `UPDATE_ELEMENT_NAME` is registered in `handlers.ts` and exercised only by `elementCommands.test.ts`; `diffElementChanges` already writes `property: 'name'` history. So the storage half is built and nothing in the UI dispatches it, which is why `internal-link`'s live pin (whose whole visible payoff is following a target's rename) has never been exercised. Node rename is the easy half (Features → *Inline rename of NodeTitle and NodeSubtitle*). The Field half needs a decision the repo asks in three places already — here, Features → *Decide Field re-configure UX*, and Bugs → *Internal Link does not admit value edit*: a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so renaming an instance is purely local, while renaming the Definition **forks it** by SPEC → *The cascade* ("a Definition is forked, never mutated") and reaches no existing instance. "Rename here and propagate everywhere" is therefore a deliberate departure from the fork rule, not an implementation detail — and it needs an affordance that says how many instances are affected before it runs. Observed 2026-08-16 tracing the internal-link resolver.

20.) **Definition identity moves to `definitionId === id`** — `parentId === null` was the test only while Definitions were tree roots, and it dies the moment they hang under the Library Node. Four production sites: `IDBAdapter.listDefinitions` (`:81`), its config-child inverse (`:87` — `parentId !== null` currently *means* "config sub-field", which becomes wrong first), the `DEFINITION_WRITTEN` remote-pull emit (`:495`), and `devTools.__wipeDefinitions`'s count. Plus two write sites, `libraryFixtures`/`seedDefinitions.test`, and a stale doc-comment in `AddFieldSurface.tsx:318`. Carries a Dexie **v11 clear-on-upgrade** (the v10 pattern) and a remote sweep via the existing `scripts/wipe-field-definitions.ts`. Read from the code 2026-08-17 while speccing SPEC → *What identifies a Definition*.

21.) **A Definition becomes `kind: node`, and its defined kind becomes a config Field** — `${defId}::cfg::kind`, write-once at mint, read first because it selects the schema the rest are provisioned from. This is what makes every Definition render, sort and navigate alike. It also dissolves the two rendering blockers found while speccing: `isReRoot('node')` is true so Definitions list in the children gutter, and `canHaveChildren('node')` is true so the card renders — neither needs a contextual-placement law. Touches the mint path (an instance's `kind` now comes from that Field, not the Definition's column) and the Kind band's grouping (a value read, not a column read).

22.) **Config sub-fields get a reconciling ProvisionSpec** — `serializeConfig` is already schema-driven with deterministic ids (`${defId}::cfg::${key}`, the twin of `${nodeId}::jobs`); what it lacks is re-running. Three jobs, per SPEC → *Config Fields are provisioned*: materialize every schema knob (today `serializeConfig` skips `undefined`, so an unset knob has **no Element, no row, and nothing to tap** — the Library would only show config somebody had already set), repair a deleted config Field before it silently removes a knob from every instance, and grow existing Definitions into a widened schema without a migration runner. Blocks Features #14.

23.) **Required-config enforcement moves from a pre-Create gate to a per-write check** — `CONFIG_VALIDATORS` runs once, before Create, in the Add Surface. A Definition is editable for its whole life now, so each config Field write must reassemble that Definition's config, validate and reject. Stronger than what it replaces (unbypassable), but it lands in the command/adapter layer rather than a form.

24.) **Renaming a Definition must reach its instances** — a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so a rename reaches nothing. Under downstream propagation it must reach every bound instance. This is the Field half of #19, now decided rather than open: the answer is propagate, and #19's "how many instances are affected before it runs" question becomes the affordance that propagation needs rather than an argument against it.

25.) **Retire `compound`; thresholds become four `number-kv` sub-fields** — SPEC and ELEMENT-MODEL are updated (2026-08-17). `ConfigRows` already drew them as four flat rows, so presentation stops lying about storage, each threshold gains its own history and edit, and the `LL ≤ … ≤ HH` chain stays a cross-field validator. Atomicity is given up knowingly: a torn merge is now possible and caught by validation rather than prevented by the value shape.

## Tech Debt

1.) **[Fields UI] `pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **[Fields UI] `useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle. The Add Surface turned out **not** to be that: its value slot is the kind's real Renderer in `pendingMode`, which is the existing lifecycle used as intended (SPEC → The Add Surface → The row). Settled 2026-08-15 — no change wanted here.

3.) **[Fields UI] Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **[Fields UI] `cardOrder` vocabulary survives in the composer props** — `currentMaxCardOrder` threads through `FieldList`, `FieldComposerSlot`, `FieldComposer`, `CreateDataField` and `usePendingForms`, though the column has been `siblingOrder` since the Element refactor. The tree-native surface took the honest name (`baseOrder`) when it landed 2026-08-15, so what is left is the dormant composer path only — it renames with #9's decision rather than separately. Beware: `db.ts` also names `cardOrder` in frozen historical schema versions, which must not change. (The `NodeTitle`/`NodeSubtitle` half of this item was done 2026-08-14.)

5.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

6.) **Seed naming describes scaffolding, but the set is the app's default pack** — `seedDefinitions` says "dev-seeded" and `__wipeDefinitions` calls restoring them a "factory-default reset"; both read as throwaway, while the set is what every production node is born with. The underlying question ("are these product content?") was answered in discussion 2026-08-14 — neither, the *bindings* are the load-bearing part (LATER → *Definition Packs*). What's left here is comments plus the `__wipeDefinitions` console message; no behaviour change.

7.) **SPEC starter-Library table has drifted from `SEEDS`** — SPECIFICATION.md §456 lists 14 starter Definitions, `seedDefinitions.ts` ships 9, and neither is a subset of the other (spec-only: Location, Serial Number, Part Number, Manufacturer, Model, Installed Date, Note; code-only: Linked Doc, Logbook Policy). Reconcile when the default pack is authored — the specced 14 is the better demo set. Observed 2026-08-14.

8.) **SPEC promises a deferred delete-history write that isn't built** — SPECIFICATION.md → Undo semantics §233 says a DataField delete's history entry is written via `onExpire`, "only after the undo window elapses without undo — so that undone deletes leave no audit trace". Neither half holds: `onExpire` has no caller (it briefly had one — the Add Surface's pick-runs, gone since 2026-08-15; see #14), and `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline (`IDBAdapter.ts:402`). So an **undone delete leaves a delete history row today**, the opposite of the promise. Decide which side is right — building the deferral means `commitWithUndo` passing an `onExpire` and the adapter splitting the write, so it is a decision, not a mop-up. Observed 2026-08-14 while implementing coalescing.

9.) **The composer stack is dormant, and retiring it is a decision — not a scheduled mop-up** — the Add Surface landed 2026-08-14 and `ENABLED_ADD_FIELD_SURFACES` now runs it alone, so `FieldComposer/`, `CreateDataField/`, `usePendingForms`, the `pendingFields:` localStorage and `pendingMode` across the four kv renderers are unreachable but intact. **Restoring either id brings its surface back verbatim**, which is the point: they stay until deleting them is deliberately chosen, and nothing about the current state obliges it. Costs of keeping them: they are indexed and typechecked, so a search for "how does adding a field work" returns more than one answer, and `pendingMode` has to keep compiling through any `useFieldEdit` change. If retirement is ever chosen, **tag the parent commit** so the composer stays reachable by name rather than by hash. Reframed 2026-08-14. Amended 2026-08-15: retirement no longer takes `pendingMode` or the four kv renderers' pending wiring with it — the Add Surface's value slot uses exactly that path (SPEC → The Add Surface → The row), so `pendingMode` is load-bearing again and only `FieldComposer/`, `CreateDataField/` and `usePendingForms` are candidates. Tech Debt #2 no longer resolves here.

10.) **Four `ConfigForm`s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with #9 rather than separately — retiring them alone would break the composer's restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

11.) **Config nesting depth, at phone width** — a `number-kv` goes band → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card already indented under a node. Re-checked 2026-08-15 after the rework, at a 638px card (≈ `--container-max`): it reads comfortably, and the retired picker's `border-left` plus its `space-4 + space-2` indent are gone, so a level came off. **Actual phone width is still unverified** — Chrome would not shrink below ~674px inner width, so this stayed a hand-test on a real device. Cheapest fixes if it ever bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it.

12.) **Cypress reaches the Add Surface's click path but not its keyboard model** — `add-surface.cy.ts` (added 2026-08-15) covers authoring a Definition and minting from it, picking a seeded Definition out of the Kind band, and a draft surviving collapse. Untested: Cancel, the enum options → value-slot preview (the highest-value case, hand-tested only), kind change mid-draft, and Undo on the "Field added" toast. **The keyboard model is untested by explicit decision**, not omission — SPEC puts it out of scope for this pass, and there is no keyboard model in the surface yet to test. Unit tests structurally cannot reach any of this: `vitest.config.ts` has no Solid transform, and nothing test-reachable may import a `.tsx`.

13.) **`core-loop.cy.ts` looks for a history chevron that no longer exists** — it fails at `[aria-label="Open field history"]`, which is present nowhere in `src/`: the chevron went away when History became an always-open band, and the spec was never updated. Confirmed pre-existing by stashing the Add Surface work and re-running against HEAD — identical failure, so it is not a regression from that branch. `lens-loop`, `offline-sync` and `retention` pass. Fix is to drop the click and assert the entries directly (they render already-expanded). Observed 2026-08-15.

14.) **A rejected config write reports "Please check the inputs and try again."** — the per-write required-config check works (removing an option from `Status` down to one is refused and the row rolls back), but `describeForUser` maps every `validation` StorageError to that one sentence, discarding the validator's own message ("Needs at least two options"). The specific reason is the only part that tells the user what to do. Widening `describeForUser` to return `err.message` for `validation` touches every validation site, so it is a decision rather than a tweak. Observed in the 2026-08-18 Library hand-test.

15.) **`Snackbar.coalesceKey` and `onExpire` have no production caller** — both existed for the retired pick-runs (a coalesced "N fields added" toast whose Undo reversed the whole run). Create is one action with one inverse now, so it routes through `commitWithUndo` and neither is passed anywhere outside `snackbar/` and its own tests. The mechanism is sound and tested; the call is whether an unused seam earns its keep, and note Tech Debt #8 wants `onExpire` for the deferred delete-history write. Observed 2026-08-15.

