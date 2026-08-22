# ISSUES.md — Active Work Queue

Live queue of open work, ordered by priority within each section. Completion lives in git history, not here.

**House rules:**

- **Only open items.** When done, **delete** — don't check off. The code is the record.
- **One-line outcomes**, not task breakdowns. "Delete with undo" beats five bullets about dialogs + snackbars + cascades. Say where it came from — "surfaced in the Phase IV hand-test", "same in the Qwik original". An item with no provenance is a guess.
- **One screen where it counts.** Bugs and Features stay scannable — prune to LATER.md or delete. The themed sections and Tech Debt are long tails; sweep them when they stop being read.
- **Sections group; position is a hint, not a queue.** Work is picked by what's worth doing, not by order. No statuses. Section membership is a label, not part of an item's identity — moving one between sections changes nothing about it.
- **Agents append to the bottom** of a section, taking the next unused number *in the file*, and only file what they observed. Reordering is the dev's.
- **Bugs first**, then Features, then Tech Debt.
- For deferred ideas see LATER.md. For product scope see SPECIFICATION.md.

**No tags.** The file carried a per-pass `[tag]` convention for a while; the last
one (`[Fields UI]`) drifted until it marked four items none of which matched its
own definition, so it was retired along with the convention on 2026-08-22. A
dependency between items belongs in the item's prose, where it can say *why*.

`[auto]` is the one exception, and it is a permission, not a topic: it marks
items the agent may take end-to-end without checking in — each self-contained and
verifiable by typecheck/lint/test. One commit per item, which also deletes the
item from here. Agreed 2026-08-11; `git push` stays manual. **Nine carry it as of
2026-08-22: #3, #7, #17, #34, #39, #40, #42, #43, #44.** Five of those needed a
decision first; each records it inline, so the tag stays honest.

The bar is *no decision left in the item*, not *small*. An item that names a
product or UX choice — even an easy one — is not `[auto]`, because picking it is
the dev's call and a commit is the wrong place to discover the pick was wrong.

**Item numbers are stable ids, unique across the whole file.** One sequence runs
through every section; deletions leave gaps and nothing ever renumbers. A new
item takes the next unused number in the file, not in its section, so a section
reads with jumps in it — that is expected and carries no meaning.

Set 2026-08-22, replacing per-section numbers that restarted at 1 and a rule that
renumbered on every delete. Two things forced it. **`#12` used to be ambiguous
across five sections**, so every citation had to carry a section name, and when
one didn't it broke — a bare "see #14" inside a Tech Debt item meant an item in
the same section that had since moved. **And an item could not change sections
without changing its number**, which is the same rot the stable-id rule exists to
prevent; reclassification is common here, so per-section ids were only
half-stable. A global id survives both.

So **citing `ISSUES #40` from a code comment is legitimate**, and the section name
is optional garnish. But it is legitimate *rarely*, and the sweep that repointed
the eleven pre-existing citations on 2026-08-22 is why: **every one of them
described work that had already landed** — the sync purge, the delta cursor, the
history-id collision — so none belonged in a queue of open work at all, whatever
its numbering. A code comment almost always explains what the code *does*, and
that is IMPLEMENTATION.md's job (`IMPLEMENTATION.md → *Retention over
reconciliation*`); a phrase also says what it means without a lookup. Cite an
ISSUES number only when the comment genuinely points at work still queued —
a known gap the reader might otherwise "fix" by accident — and expect to delete
the comment when the item goes.

---

## Bugs

1.) **number-kv accepts radix literals** — `parseNumber` (numberKvState.ts) uses `Number`, which parses `0x1A` as 26, `0b101` as 5, `0o17` as 15 (verified at a node prompt). Harmless in practice — nobody types hex into a temperature field — and strictly better than the `parseFloat` it replaced, which read `0x1A` as 0. Rejecting them needs a full-string decimal/scientific regex. Left in deliberately when the `parseFloat` bug was fixed; raise only if it ever bites.

2.) **Internal Link does not admit value edit.** - Decide UX: Name of link should be fixed at mint-time, only editable through the library? (Or maybe Settings with back-propagation to the Library??) But either way, the actual kv value should be editable.

3.) `[auto]` **Create surfaces are live before the command bus exists** — `RootView`'s guard is `isLoading() && nodes().length === 0`, and `useElementChildren` only sets `isLoading` *after* `await initializeStorage()` (`useElementChildren.ts:51-52`), so first paint renders the whole view, `CreateNodeButton` included, while init is still in flight. `start()` is harmless (no bus), but the Create it opens calls `getCommandBus()` (`useNodeCreation.ts:101`) inside an un-awaited `complete()` — so a fast click on a slow boot is an uncaught rejection and a silently lost node. Read from the code 2026-08-21. **Decided 2026-08-22: disable the Create affordance while `isLoading()`, don't gate the view.** The tree keeps painting immediately — no empty first frame — and only `CreateNodeButton` carries a disabled state until init resolves. Await `complete()` as well so any surviving rejection reaches the error snackbar instead of the console.


## UI, styling, layout

4.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

5.) **Text entry in Add Field/Name longer than current column width widens the columnn across the app**

6.) **Field Value no longer aligns with current value's metadata string.**


## Features

7.) `[auto]` **Node metadata in TreeNodeDetails/Config** — show `createdAt`, last `updatedAt`, last `updatedBy`, 'id', 'version', and description/byline. It already shows "from <libraryField>". **Presentation decided 2026-08-22: a compact block, not one row per fact** — pair them up (`id` + `version` on one line, the two dates on another) reusing the existing Details/Config row styling, no new component and no new tokens. The Config band is already deeply nested (#38), so row count is the thing to spend sparingly.

8.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

9.) **DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't. This feature belongs to the NodeDetails section.

10.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

11.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

12.) **Active link to FieldLibrary from Config section of a Field** — now has a destination to point at (the Definition's entry in the Library lens, built 2026-08-20), and the reveal machinery landed (`useRevealOnArrival`), so the shape is reveal-the-Definition rather than re-root-to-the-Library. Also wanted by LATER → *Editing a picked Definition's config from the Add Surface*, which asks for the same link from the Add Surface's Config band. One affordance, several callers — and read-only at the far end: the lens writes nothing.

13.) **Decide Field "re-configure" UX** — **re-opened 2026-08-20**: the 2026-08-17 edit-in-place answer died with the rejected place-design (SUPERSEDED). Under fork-never-mutate (SPEC → *Edit / Delete Semantics*), "re-configure" means minting a successor Definition and rebinding the instance — the affordance for that is undecided. A Field's Config band still wants a live link to its Definition (same want as Features → *Active link to FieldLibrary from Config section of a Field*); the Library lens gives it a read-only destination.

14.) **Should TreeNodeDetails/History always be expanded default?** - Or a config of the Field? One of [always, toggleable]. Or A/B test to determine the best UX. 1+2 or flat 3, or something else?

15.) **Should TreeNodeDetails' subsections be reorderable?** - It could easily be part of the authoring config. But should it?

16.) **Change TreeNodeDetails/Config to /"Settings"?** - Decide what, if anything, can be edited from there. If nothing, then why show it? Even though it shows info from config, user-facing idea is "settings".

17.) `[auto]` **A Definition row in the Kind band shows nothing but its label** — the old picker let you expand a Definition to peek at its config before picking; the Kind band drops that, because picking now loads the config into the Config band read-only. Cheaper to compare two same-named Definitions if the row itself carried id, version, createdAt, createdBy, description/byline. Reframed 2026-08-15 when the peek went away (was "Add Field Picker / Option / Expand Chevron should show metadata…"). **Presentation decided 2026-08-22, same answer as #7: a compact paired block**, not one row per fact, reusing existing row styling.

18.) **Single Image Field / History is just the history of the caption.** - Decide composite Field structure and layout. 






## Architecture

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

19.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#22). Detail parked in LATER.md → typed trees.

20.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

21.) **The rest of the catalogue (SPEC §6c)** — the `Edges` family (`other-end` / `approval`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md. The fourth Edges member landed separately as `external-link` (2026-08-12); these three still wait on the overlay (#19) or on `ElementHistory` reads.

22.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive` — the traversal itself is built (`gatherAncestors`, nearest-first), so what remains is the arbitration. The disposition vocabulary is already encoded on the schema; this wires it. Blocked on identity as much as on the arbitration: an app→org→role→user cascade needs a user, and `getCurrentUserId()` (`src/context/userContext.ts`) is still the constant `localUser` — see LATER → *typed trees* → **Identity as a resolver seam**.

23.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites. The nested-job half is gone (sub-jobs decided against 2026-08-12, ELEMENT-MODEL §job); what remains is one deep job appearing in every ancestor above it.

24.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

25.) **`NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted. **The Library lens was the first surface to want one and decided against it** (2026-08-20): its previews are *live but write-free* — the real Renderer in `pendingMode` over preview-local state, with no Element behind the row — which reads better than inertness and needs no new render path. The truly-inert variant still has no caller.

26.) **`internal-link` real target picker** — the target is still a raw element-id paste. Editing a saved link landed 2026-08-16; the picker is the remaining half, and it needs the address (nearest ancestor + name) in its result rows for the same disambiguation reason the value cell does. Whether it should be *constrained* by `TargetSpec.allowedKinds` is a spec decision first — LATER → *§6b minimal kind set*.

27.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

28.) **`resolveEdge` cannot tell a deleted target from a live one** — `getElementById` is a bare `db.elements.get(id)` (`IDBAdapter.getElement`), unlike `listChildElements` directly beside it, so a soft-deleted `internal-link` target keeps resolving: the row renders its address and still offers `→`, which reveals into a card whose filtered child list no longer contains it. Soft delete not cascading (SPEC → *Soft Deletion*) adds a second case no per-row check catches — a target beneath a deleted ancestor carries `deletedAt: null` and looks healthy while being unreachable. Widen `resolveEdge` to a status (`live | deleted | unreachable | missing`) and render the four distinctly, keeping the last-known name on a tombstone rather than collapsing to a bare id. **`missing` must never read as deleted** — an unresolvable id may simply not have synced down yet, the same reasoning as IMPLEMENTATION.md → *Retention over reconciliation*. This is also the seam `ValiditySpec` plugs into when `approval` lands. Read from the code 2026-08-16; the docstring in `InternalLinkField.tsx` asserted the opposite and was corrected in the same pass.

29.) **Renaming an Element has no caller, and for a Field no decided semantics** — `UPDATE_ELEMENT_NAME` is registered in `handlers.ts` and exercised only by `elementCommands.test.ts`; `diffElementChanges` already writes `property: 'name'` history. So the storage half is built and nothing in the UI dispatches it, which is why `internal-link`'s live pin (whose whole visible payoff is following a target's rename) has never been exercised. Node rename is the easy half (Features → *Inline rename of NodeTitle and NodeSubtitle*). The Field half needs a decision the repo asks in three places already — here, Features → *Decide Field re-configure UX*, and Bugs → *Internal Link does not admit value edit*: a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so renaming an instance is purely local, while renaming the Definition **forks it** by SPEC → *The cascade* ("a Definition is forked, never mutated") and reaches no existing instance. "Rename here and propagate everywhere" is therefore a deliberate departure from the fork rule, not an implementation detail — and it needs an affordance that says how many instances are affected before it runs. Observed 2026-08-16 tracing the internal-link resolver.

30.) **`listRootElements` hardcodes an implicit population gather** — `treeType === 'business'` at `IDBAdapter.ts:218` *is* the ROOT view's definition, and the Library lens adds a second population read (`library`-tree roots) beside it. `SourceSpec.relation` only speaks `children | ancestors | edges`, so "every root of a typed tree" has no explicit form; a population relation would let ROOT and the Library ride one primitive instead of two hardcoded filters. Fine as an implicit default for now. Surfaced in the Library-As-Lens-Tree design discussion, 2026-08-20.

31.) **The Library's two lens children are seeded; they could be provisioned** — v1 seeds all three Library chrome Elements (the `library` root plus `definitions` and `kinds`) as constant-id idempotent seed writes, because a boot-time singleton is exactly the seeder's job. The other way: the two children declare `provision` capabilities and ride the existing `KIND_CAPABILITIES`-derived schedule (`${parentId}::definitions`, the `jobs` pattern), triggered by the `library` root's creation — no new machinery, but nothing needs it while the trio is fixed. Decided seed-for-now in the Library-As-Lens-Tree design discussion, 2026-08-20.

32.) **`.previewGrid` duplicates `FieldList`'s named grid tracks** — `DataField`'s `.datafieldWrapper` is `grid-template-columns: subgrid`, so a row mounted outside a `FieldList` collapses its columns (label overlapping value) unless its container restates the six named tracks. `LibraryViews.module.css` restates them verbatim for the Library previews, so the contract now lives in two places and a third caller would copy it again. Extract to a shared class when that third caller appears. Observed building the Library lens, 2026-08-20.

33.) **`per-user` config sync is declared but collapses to shared** — `treeSyncMode('config')` returns `'per-user'` (`treePolicy.ts:35`), and the only consumer is `shouldSyncTreeType`, which asks "does it sync at all" and gets `true`. Nothing scopes the push, so the first `config`-tree row would ride the same shared lane as business content — a user's private prefs pushed to everyone, which is the one failure mode the typed-trees seam exists to prevent. Inert today only because Phase 1 has no `config` producer (the module docblock says so), which means **the first config producer is also the first test of this routing**: land those rows local-only and turn sync on deliberately rather than discovering the guard and the feature at once. Read from `treePolicy.ts` while scoping the per-population bootstrap, 2026-08-21.

## Tech Debt

34.) `[auto]` **Extract the repeated `pendingMode` wiring out of the DataField renderers** — near-identical `pendingMode` plumbing into `useFieldEdit`, repeated per renderer. **The deferral has expired**: the original item said "don't abstract until a 5th component lands", and there are now seven carriers — `TextKvField`, `EnumKvField`, `NumberKvField`, `SingleImageField`, `InternalLinkField`, `ExternalLinkField` and `ConfigValueFields`. The two link kinds arrived with the Edges family and `ConfigValueFields` with config-as-Elements, so the growth is structural, not incidental, and the Library's archetype previews (`KindsIndex`) now drive the same path from outside `FieldList` entirely.

**Absorbed the former `useFieldEdit` size item 2026-08-22** — they were one seam described from two ends. That item recorded a fat hook (272 lines now, up from the "200+" it was written against) with a 21-prop return, and a 2026-08-15 verdict of "no change wanted", reasoning that the Add Surface's value slot uses the existing lifecycle exactly as intended (SPEC → The Add Surface → The row). That verdict stands on its own terms — nothing needs a *different* edit lifecycle — but it answered the wrong question: the return surface is wide because seven callers each rebuild the same wiring from its parts, so **extracting the wiring is the change that shrinks the hook**, and doing it from the caller side is the better call than refactoring `useFieldEdit` for its own sake.

One constraint on the work: the dormant composer stack (`FieldComposer/`, `CreateDataField/`, `usePendingForms` — unreachable since the Add Surface took over, kept deliberately and not filed as an issue) rides this same path, so the refactor either keeps it compiling or forces the decision to delete it. **Decided 2026-08-22: keep it compiling** — the composer is not being purged, so the extraction must leave `FieldComposer/`, `CreateDataField/` and `usePendingForms` building and the suite green. **Scope decided too: one pass, all seven renderers.** A half-migrated tree is worse than an unmigrated one, because it leaves two ways to write a renderer; typecheck, lint and the 571-test suite are real verification for a diff this wide.

35.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

36.) **SPEC promises a deferred delete-history write that isn't built** — SPECIFICATION.md → Undo semantics §233 says a DataField delete's history entry is written via `onExpire`, "only after the undo window elapses without undo — so that undone deletes leave no audit trace". Neither half holds: `onExpire` has no caller (it briefly had one — the Add Surface's pick-runs, gone since 2026-08-15; see #41), and `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline (`IDBAdapter.ts:402`). So an **undone delete leaves a delete history row today**, the opposite of the promise. Decide which side is right — building the deferral means `commitWithUndo` passing an `onExpire` and the adapter splitting the write, so it is a decision, not a mop-up. Observed 2026-08-14 while implementing coalescing.

37.) **Four `ConfigForm`s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with the composer stack rather than separately — retiring them alone would break its restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

38.) **Config nesting depth, at phone width** — a `number-kv` goes band → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card already indented under a node. Re-checked 2026-08-15 after the rework, at a 638px card (≈ `--container-max`): it reads comfortably, and the retired picker's `border-left` plus its `space-4 + space-2` indent are gone, so a level came off. **Actual phone width is still unverified** — Chrome would not shrink below ~674px inner width, so this stayed a hand-test on a real device. Cheapest fixes if it ever bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it.

39.) `[auto]` **Cypress reaches the Add Surface's click path but not its keyboard model** — `add-surface.cy.ts` (added 2026-08-15) covers authoring a Definition and minting from it, picking a seeded Definition out of the Kind band, and a draft surviving collapse. Untested: Cancel, the enum options → value-slot preview (the highest-value case, hand-tested only), kind change mid-draft, and Undo on the "Field added" toast. **The keyboard model is untested by explicit decision**, not omission — SPEC puts it out of scope for this pass, and there is no keyboard model in the surface yet to test. Unit tests structurally cannot reach any of this: `vitest.config.ts` has no Solid transform, and nothing test-reachable may import a `.tsx`. **Decided 2026-08-22: write the four missing specs and run them to green** against a live emulator + dev server, rather than committing specs that have never been seen to pass. The keyboard model stays out of scope — there is still no keyboard model to test.

40.) `[auto]` **`core-loop.cy.ts` looks for a history chevron that no longer exists** — it fails at `[aria-label="Open field history"]`, which is present nowhere in `src/`: the chevron went away when History became an always-open band, and the spec was never updated. Confirmed pre-existing by stashing the Add Surface work and re-running against HEAD — identical failure, so it is not a regression from that branch. `lens-loop`, `offline-sync` and `retention` pass. Fix is to drop the click and assert the entries directly (they render already-expanded). Observed 2026-08-15.

41.) **`Snackbar.coalesceKey` and `onExpire` have no production caller** — both existed for the retired pick-runs (a coalesced "N fields added" toast whose Undo reversed the whole run). Create is one action with one inverse now, so it routes through `commitWithUndo` and neither is passed anywhere outside `snackbar/` and its own tests. The mechanism is sound and tested; the call is whether an unused seam earns its keep, and note #36 wants `onExpire` for the deferred delete-history write. Observed 2026-08-15.

42.) `[auto]` **A failed Cypress run leaves `cypress/screenshots/` untracked in the working tree** — it is not in `.gitignore`, so a red spec turns into an untracked directory that shows up in the next `git status` and is easy to stage by accident. Surfaced running the seed-coupled specs for Field-Packs, 2026-08-21.

43.) `[auto]` **The dev gate cannot be opened on the deployed app without also moving the sync target** — `DEV_TOOLS_ENABLED = import.meta.env.DEV || isEmulatorTarget` (`devMode.ts:24`), and the only hatch into `isEmulatorTarget` is `?emulator=true` / `localStorage.USE_FIRESTORE_EMULATOR`, which *also* renames the Dexie database (`-emulator` suffix, `db.ts:20`) and repoints sync at :8080. So on Netlify there are no `window.__*` helpers at all, and the emulator flag is not a workaround — it opens the gate onto the wrong database and a server that isn't running. Split the gate: a `?devtools=true` / `localStorage.DEV_TOOLS` flag that opens `DEV_TOOLS_ENABLED` on its own, leaving `isEmulatorTarget` to mean only *which remote*. `DEVELOPING.md`'s run-mode table and Resets table both want the third axis when it lands. Surfaced resetting production after the Field-Packs deploy, 2026-08-22: `__wipeLocal()` had to be hand-typed as `indexedDB.deleteDatabase('complete-maintenance-management')` (which worked — the new pack re-seeded and the demo tree came back down from Firestore), and `__mintDemoTree()` had no hand equivalent at all, since it is bundled module code with no console handle in a minified build.

44.) `[auto]` **`cardOrder` survives in the live ordering path, not just the composer's** — the column has been `siblingOrder` since the Element refactor, but `FieldList.tsx:51` still names its memo `maxPersistedCardOrder` while reading `f.siblingOrder`, and `pendingDraft.ts:137,146` computes `const cardOrder = baseOrder + i + 1` only to assign it to `siblingOrder`. `pendingDraft` is on the **live** construction path via `useNodeCreation`, so this is not dormant-stack vocabulary that leaves with the composer — the earlier item said it was, and was wrong. The dormant props (`currentMaxCardOrder` into `FieldComposerSlot` / `CreateDataField`) do go with the composer; these two do not. Beware: `db.ts` also names `cardOrder` in frozen historical schema versions, which must **not** change. Extracted from the composer monolith 2026-08-22 and re-checked against the code, which is what corrected it.

45.) **Construction threads its defaults into a surface that never mounts** — `TreeNodeConstruction.tsx:110` passes `constructionDefaults()` as `initialDefinitionIds` to `FieldList`, which forwards it (`FieldList.tsx:112`) only to `FieldComposerSlot` — dormant. The defaults still arrive, by a different route entirely: `useNodeCreation` seeds and commits the pending draft itself once the node exists. So construction mounts a `FieldList` that renders nothing (its own docblock says so) and feeds a prop chain that terminates in unreachable code, while the feature works elsewhere. Two live components carry composer-shaped plumbing for no current effect. Read from the code 2026-08-22.

46.) **The Add Surface loses its whole draft on reload** — `AddFieldSurface.tsx` has no persistence of any kind: no `localStorage`, no `beforeunload`, no `visibilitychange` (verified by search, 2026-08-22). The composer it replaced persisted ticked rows to `pendingFields:<nodeId>`, so this is a capability the tree-native surface did not inherit — and the loss is larger than the old composer bug, which dropped only uncommitted keystrokes while keeping the ticked rows. Whether that matters is a product decision: a draft is cheap to re-make, and #39 records that surviving *collapse* is covered and passing, which may be the only continuity that was ever wanted. Decide before building anything; if drafts should survive reload, that is new work on the live surface, not a restoration of the composer's mechanism.

