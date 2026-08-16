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


## Features

1.) **Build the Add Surface as a Field row** — SPEC → *The Add Surface* is rewritten and settled (2026-08-15): shared row shell with a `field` / `adder` role, `＋` in the chevron column, chrome-less name input in the label track sizing to content, the draft kind's real Renderer in the value slot via `pendingMode`, and bands **Config · Kind · Tools** replacing History · Config · Tools. Create/Cancel in Tools; collapse keeps the draft; construction tint whenever a draft is held. Retires `LibraryPicker` and `DefinitionAuthoring` as separate surfaces. Keyboard is explicitly out of scope for this pass (SPEC → Keyboard & Accessibility).

2.) **Group the Library by kind under the Kind band** — one row per admitted kind, expanding to that kind's Definitions. A view over the `library` tree, no re-parenting, so the `parentId === null` identity test is untouched. Search in the name slot is the deferred follow-up (LATER → *FieldDefinition Library*).

3.) **Node metadata in TreeNodeDetails/Config** — show `createdAt`, last `updatedAt`, last `updatedBy`, 'id', 'version', and description/byline. It already shows "from <libraryField>".

4.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

5.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't. This feature belongs to the NodeDetails section.

6.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

7.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

8.) **Active link to FieldLibrary from Config section of a Field** - 

9.) **Decide Field "re-configure" UX** - Propogate to all similar Fields accross the app? Create new (fork) libraryField? Do nothing and WARN? Divert user to the library so they can edit the source?

10.) **Should TreeNodeDetails/History always be expanded default?** - Or a config of the Field? One of [always, toggleable]. Or A/B test to determine the best UX. 1+2 or flat 3, or something else?

11.) **Should TreeNodeDetails' subsections be reorderable?** - It could easily be part of the authoring config. But should it?

12.) **Change TreeNodeDetails/Config to /"Settings"?** - Decide what, if anything, can be edited from there. If nothing, then why show it? Even though it shows info from config, user-facing idea is "settings".

11.) **A Definition row in the Kind band shows nothing but its label** — the old picker let you expand a Definition to peek at its config before picking; the Kind band drops that, because picking now loads the config into the Config band read-only. Cheaper to compare two same-named Definitions if the row itself carried id, version, createdAt, createdBy, description/byline. Reframed 2026-08-15 when the peek went away (was "Add Field Picker / Option / Expand Chevron should show metadata…").

13.) **Single Image Field / History is just the history of the caption.** - Decide composite Field structure and layout. 





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

14.) **`Snackbar.coalesceKey` and `onExpire` have no production caller** — both existed for the retired pick-runs (a coalesced "N fields added" toast whose Undo reversed the whole run). Create is one action with one inverse now, so it routes through `commitWithUndo` and neither is passed anywhere outside `snackbar/` and its own tests. The mechanism is sound and tested; the call is whether an unused seam earns its keep, and note Tech Debt #8 wants `onExpire` for the deferred delete-history write. Observed 2026-08-15.

