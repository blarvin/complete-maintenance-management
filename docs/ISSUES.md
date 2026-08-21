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
mounts. Whether they are fixed or deleted follows Tech Debt #7, not this tag.
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

4.) **A failed storage init reports success** — the catch in `doInitializeStorage` (`initStorage.ts:139-143`) logs and sets `state.initialized = true`, so `isStorageInitialized()` says booted after a boot that got no further than `db.open()`. Everything past the throw is skipped, including `seedDefinitions()` **and** `initializeCommandBus`/`initializeQueries`, so the app runs with no Library and every write throws "CommandBus not initialized". This is the real *never boot packless* hole (LATER → *Definition Packs*): bundling the pack closed the load side, nothing closes the seed side. Wants a boot state the UI can read (`ok | degraded`), not one boolean covering both. Read from the code 2026-08-21 while planning the pack reseed.

5.) **A lens minted with `definitionId: null` is never re-stamped** — `ensureProvisionedLenses` skips any lens that already exists (`provisionLenses.ts:39-40`) and the backfill only *creates* missing ones, so a lens minted while its policy Definition was unresolvable (unseeded DB, or the window `__wipeDefinitions` opens — Tech Debt #15) keeps `definitionId: null` forever and lives out its life on the `pickerLabel` fallback. Stamp-if-resolvable degrades permanently, not transiently; the fix is a re-stamp pass over existing lenses whose null now resolves. Read from the code 2026-08-21.

6.) **Unresolvable construction defaults are dropped, then the draft is cleared** — `seedPendingDraft` silently skips any id `getDefinitionById` misses (`pendingDraft.ts:89-91`, no else branch), and `complete()` immediately runs `commitPendingDraft`, which clears the draft. On a boot where the seed didn't land, a new node is therefore born field-less with nothing recorded and no retry — fields lost, not deferred. Read from the code 2026-08-21.

7.) **Create surfaces are live before the command bus exists** — `RootView`'s guard is `isLoading() && nodes().length === 0`, and `useElementChildren` only sets `isLoading` *after* `await initializeStorage()` (`useElementChildren.ts:51-52`), so first paint renders the whole view, `CreateNodeButton` included, while init is still in flight. `start()` is harmless (no bus), but the Create it opens calls `getCommandBus()` (`useNodeCreation.ts:101`) inside an un-awaited `complete()` — so a fast click on a slow boot is an uncaught rejection and a silently lost node. Read from the code 2026-08-21.


## UI, styling, layout

1.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

2.) **Text entry in Add Field/Name longer than current column width widens the columnn across the app**

3.) **Field Value no longer aligns with current value's metadata string.**


## Features

1.) **Build the Add Surface as a Field row** — SPEC → *The Add Surface* is rewritten and settled (2026-08-15): shared row shell with a `field` / `adder` role, `＋` in the chevron column, chrome-less name input in the label track sizing to content, the draft kind's real Renderer in the value slot via `pendingMode`, and bands **Config · Kind · Tools** replacing History · Config · Tools. Create/Cancel in Tools; collapse keeps the draft; construction tint whenever a draft is held. Retires `LibraryPicker` and `DefinitionAuthoring` as separate surfaces. Keyboard is explicitly out of scope for this pass (SPEC → Keyboard & Accessibility).

2.) **Group the Library by kind under the Kind band** — one row per admitted kind, expanding to that kind's Definitions. A view, no re-parenting: it reads each Definition's `kind` column, and should share its gather with the `definitions` lens (built 2026-08-20) rather than growing a second. Search in the name slot is the deferred follow-up (LATER → *FieldDefinition Library*).

3.) **Node metadata in TreeNodeDetails/Config** — show `createdAt`, last `updatedAt`, last `updatedBy`, 'id', 'version', and description/byline. It already shows "from <libraryField>".

4.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

5.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't. This feature belongs to the NodeDetails section.

6.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

7.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

8.) **Active link to FieldLibrary from Config section of a Field** — now has a destination to point at (the Definition's entry in the Library lens, built 2026-08-20), and the reveal machinery landed (`useRevealOnArrival`), so the shape is reveal-the-Definition rather than re-root-to-the-Library. Also wanted by LATER → *Editing a picked Definition's config from the Add Surface*, which asks for the same link from the Add Surface's Config band. One affordance, several callers — and read-only at the far end: the lens writes nothing.

9.) **Decide Field "re-configure" UX** — **re-opened 2026-08-20**: the 2026-08-17 edit-in-place answer died with the rejected place-design (SUPERSEDED). Under fork-never-mutate (SPEC → *Edit / Delete Semantics*), "re-configure" means minting a successor Definition and rebinding the instance — the affordance for that is undecided. A Field's Config band still wants a live link to its Definition (same want as Features #8); the Library lens gives it a read-only destination.

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

8.) **[Fields UI] `NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted. **The Library lens was the first surface to want one and decided against it** (2026-08-20): its previews are *live but write-free* — the real Renderer in `pendingMode` over preview-local state, with no Element behind the row — which reads better than inertness and needs no new render path. The truly-inert variant still has no caller.

11.) **[Fields UI] `internal-link` real target picker** — the target is still a raw element-id paste. Editing a saved link landed 2026-08-16; the picker is the remaining half, and it needs the address (nearest ancestor + name) in its result rows for the same disambiguation reason the value cell does. Whether it should be *constrained* by `TargetSpec.allowedKinds` is a spec decision first — LATER → *§6b minimal kind set*.

12.) **[Fields UI] Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

18.) **`resolveEdge` cannot tell a deleted target from a live one** — `getElementById` is a bare `db.elements.get(id)` (`IDBAdapter.getElement`), unlike `listChildElements` directly beside it, so a soft-deleted `internal-link` target keeps resolving: the row renders its address and still offers `→`, which reveals into a card whose filtered child list no longer contains it. Soft delete not cascading (SPEC → *Soft Deletion*) adds a second case no per-row check catches — a target beneath a deleted ancestor carries `deletedAt: null` and looks healthy while being unreachable. Widen `resolveEdge` to a status (`live | deleted | unreachable | missing`) and render the four distinctly, keeping the last-known name on a tombstone rather than collapsing to a bare id. **`missing` must never read as deleted** — an unresolvable id may simply not have synced down yet, the same reasoning as IMPLEMENTATION.md → *Retention over reconciliation*. This is also the seam `ValiditySpec` plugs into when `approval` lands. Read from the code 2026-08-16; the docstring in `InternalLinkField.tsx` asserted the opposite and was corrected in the same pass.

19.) **Renaming an Element has no caller, and for a Field no decided semantics** — `UPDATE_ELEMENT_NAME` is registered in `handlers.ts` and exercised only by `elementCommands.test.ts`; `diffElementChanges` already writes `property: 'name'` history. So the storage half is built and nothing in the UI dispatches it, which is why `internal-link`'s live pin (whose whole visible payoff is following a target's rename) has never been exercised. Node rename is the easy half (Features → *Inline rename of NodeTitle and NodeSubtitle*). The Field half needs a decision the repo asks in three places already — here, Features → *Decide Field re-configure UX*, and Bugs → *Internal Link does not admit value edit*: a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so renaming an instance is purely local, while renaming the Definition **forks it** by SPEC → *The cascade* ("a Definition is forked, never mutated") and reaches no existing instance. "Rename here and propagate everywhere" is therefore a deliberate departure from the fork rule, not an implementation detail — and it needs an affordance that says how many instances are affected before it runs. Observed 2026-08-16 tracing the internal-link resolver.

26.) **`listRootElements` hardcodes an implicit population gather** — `treeType === 'business'` at `IDBAdapter.ts:218` *is* the ROOT view's definition, and the Library lens adds a second population read (`library`-tree roots) beside it. `SourceSpec.relation` only speaks `children | ancestors | edges`, so "every root of a typed tree" has no explicit form; a population relation would let ROOT and the Library ride one primitive instead of two hardcoded filters. Fine as an implicit default for now. Surfaced in the Library-As-Lens-Tree design discussion, 2026-08-20.

27.) **The Library's two lens children are seeded; they could be provisioned** — v1 seeds all three Library chrome Elements (the `library` root plus `definitions` and `kinds`) as constant-id idempotent seed writes, because a boot-time singleton is exactly the seeder's job. The other way: the two children declare `provision` capabilities and ride the existing `KIND_CAPABILITIES`-derived schedule (`${parentId}::definitions`, the `jobs` pattern), triggered by the `library` root's creation — no new machinery, but nothing needs it while the trio is fixed. Decided seed-for-now in the Library-As-Lens-Tree design discussion, 2026-08-20.

28.) **`.previewGrid` duplicates `FieldList`'s named grid tracks** — `DataField`'s `.datafieldWrapper` is `grid-template-columns: subgrid`, so a row mounted outside a `FieldList` collapses its columns (label overlapping value) unless its container restates the six named tracks. `LibraryViews.module.css` restates them verbatim for the Library previews, so the contract now lives in two places and a third caller would copy it again. Extract to a shared class when that third caller appears. Observed building the Library lens, 2026-08-20.

## Tech Debt

1.) **[Fields UI] `pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **[Fields UI] `useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle. The Add Surface turned out **not** to be that: its value slot is the kind's real Renderer in `pendingMode`, which is the existing lifecycle used as intended (SPEC → The Add Surface → The row). Settled 2026-08-15 — no change wanted here.

3.) **[Fields UI] Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **[Fields UI] `cardOrder` vocabulary survives in the composer props** — `currentMaxCardOrder` threads through `FieldList`, `FieldComposerSlot`, `FieldComposer`, `CreateDataField` and `usePendingForms`, though the column has been `siblingOrder` since the Element refactor. The tree-native surface took the honest name (`baseOrder`) when it landed 2026-08-15, so what is left is the dormant composer path only — it renames with #7's decision rather than separately. Beware: `db.ts` also names `cardOrder` in frozen historical schema versions, which must not change. (The `NodeTitle`/`NodeSubtitle` half of this item was done 2026-08-14.)

5.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

6.) **SPEC promises a deferred delete-history write that isn't built** — SPECIFICATION.md → Undo semantics §233 says a DataField delete's history entry is written via `onExpire`, "only after the undo window elapses without undo — so that undone deletes leave no audit trace". Neither half holds: `onExpire` has no caller (it briefly had one — the Add Surface's pick-runs, gone since 2026-08-15; see #14), and `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline (`IDBAdapter.ts:402`). So an **undone delete leaves a delete history row today**, the opposite of the promise. Decide which side is right — building the deferral means `commitWithUndo` passing an `onExpire` and the adapter splitting the write, so it is a decision, not a mop-up. Observed 2026-08-14 while implementing coalescing.

7.) **The composer stack is dormant, and retiring it is a decision — not a scheduled mop-up** — the Add Surface landed 2026-08-14 and `ENABLED_ADD_FIELD_SURFACES` now runs it alone, so `FieldComposer/`, `CreateDataField/`, `usePendingForms`, the `pendingFields:` localStorage and `pendingMode` across the four kv renderers are unreachable but intact. **Restoring either id brings its surface back verbatim**, which is the point: they stay until deleting them is deliberately chosen, and nothing about the current state obliges it. Costs of keeping them: they are indexed and typechecked, so a search for "how does adding a field work" returns more than one answer, and `pendingMode` has to keep compiling through any `useFieldEdit` change. If retirement is ever chosen, **tag the parent commit** so the composer stays reachable by name rather than by hash. Reframed 2026-08-14. Amended 2026-08-15: retirement no longer takes `pendingMode` or the four kv renderers' pending wiring with it — the Add Surface's value slot uses exactly that path (SPEC → The Add Surface → The row), so `pendingMode` is load-bearing again and only `FieldComposer/`, `CreateDataField/` and `usePendingForms` are candidates. Tech Debt #2 no longer resolves here.

8.) **Four `ConfigForm`s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with #7 rather than separately — retiring them alone would break the composer's restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

9.) **Config nesting depth, at phone width** — a `number-kv` goes band → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card already indented under a node. Re-checked 2026-08-15 after the rework, at a 638px card (≈ `--container-max`): it reads comfortably, and the retired picker's `border-left` plus its `space-4 + space-2` indent are gone, so a level came off. **Actual phone width is still unverified** — Chrome would not shrink below ~674px inner width, so this stayed a hand-test on a real device. Cheapest fixes if it ever bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it.

10.) **Cypress reaches the Add Surface's click path but not its keyboard model** — `add-surface.cy.ts` (added 2026-08-15) covers authoring a Definition and minting from it, picking a seeded Definition out of the Kind band, and a draft surviving collapse. Untested: Cancel, the enum options → value-slot preview (the highest-value case, hand-tested only), kind change mid-draft, and Undo on the "Field added" toast. **The keyboard model is untested by explicit decision**, not omission — SPEC puts it out of scope for this pass, and there is no keyboard model in the surface yet to test. Unit tests structurally cannot reach any of this: `vitest.config.ts` has no Solid transform, and nothing test-reachable may import a `.tsx`.

11.) **`core-loop.cy.ts` looks for a history chevron that no longer exists** — it fails at `[aria-label="Open field history"]`, which is present nowhere in `src/`: the chevron went away when History became an always-open band, and the spec was never updated. Confirmed pre-existing by stashing the Add Surface work and re-running against HEAD — identical failure, so it is not a regression from that branch. `lens-loop`, `offline-sync` and `retention` pass. Fix is to drop the click and assert the entries directly (they render already-expanded). Observed 2026-08-15.

12.) **`Snackbar.coalesceKey` and `onExpire` have no production caller** — both existed for the retired pick-runs (a coalesced "N fields added" toast whose Undo reversed the whole run). Create is one action with one inverse now, so it routes through `commitWithUndo` and neither is passed anywhere outside `snackbar/` and its own tests. The mechanism is sound and tested; the call is whether an unused seam earns its keep, and note Tech Debt #6 wants `onExpire` for the deferred delete-history write. Observed 2026-08-15.

13.) **Seeding upserts but never prunes, so a retired seed id lingers forever** — a dev profile carried `library_root` ("Field Library", kind `node`), the pre-`lib_root` chrome row, still passing `isDefinitionRow` and so counting as a 31st Definition in a 30-row pack. Nothing deletes a row the pack stopped shipping, and the Library's Definitions index will list it. Read out of IndexedDB during the Field-Packs hand-test, 2026-08-21; a fresh profile is clean, so this only bites profiles that predate a rename.

14.) **A failed Cypress run leaves `cypress/screenshots/` untracked in the working tree** — it is not in `.gitignore`, so a red spec turns into an untracked directory that shows up in the next `git status` and is easy to stage by accident. Surfaced running the seed-coupled specs for Field-Packs, 2026-08-21.

15.) **`__wipeDefinitions()` doesn't reload, unlike `__wipeLocal()`** — it clears the `library` tree and resets `SEED_KEY` (`devTools.ts:64`), then leaves the running app pointed at a Library that no longer exists and tells the user to reload; `__wipeLocal()` reloads for them, for exactly this reason. Anything minted in that window stamps `definitionId: null` on its lenses — permanently, per Bugs #5 — and loses its construction defaults (Bugs #6). Either reload too, or say in the docblock why the un-reloaded window is wanted. Read from the code 2026-08-21.

