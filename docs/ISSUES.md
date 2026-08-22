# ISSUES.md — Active Work Queue

Live queue of open work, ordered by priority within each section. Completion lives in git history, not here.

**House rules:**

- **Only open items.** When done, **delete** — don't check off. The code is the record.
- **One-line outcomes**, not task breakdowns. "Delete with undo" beats five bullets about dialogs + snackbars + cascades. Say where it came from — "surfaced in the Phase IV hand-test", "same in the Qwik original". An item with no provenance is a guess.
- **One screen where it counts.** Bugs and Features stay scannable — prune to LATER.md or delete. The themed sections and Tech Debt are long tails; sweep them when they stop being read.
- **Sections group; position is a hint, not a queue.** Work is picked by what's worth doing, not by order. No statuses. Section membership is a label, not part of an item's identity — moving one between sections changes nothing about it.
- **Agents append to the bottom** of a section, taking one past the highest number ever issued (see *Item numbers* below), and only file what they observed. Reordering is the dev's.
- **Bugs first**, then Features, then Tech Debt.
- For deferred ideas see LATER.md. For product scope see SPECIFICATION.md.

**No tags.** The file carried a per-pass `[tag]` convention for a while; the last
one (`[Fields UI]`) drifted until it marked four items none of which matched its
own definition, so it was retired along with the convention on 2026-08-22. A
dependency between items belongs in the item's prose, where it can say *why*.

`[auto]` is the one exception, and it is a permission, not a topic: it marks
items the agent may take end-to-end without checking in — each self-contained and
verifiable by typecheck/lint/test. One commit per item, which also deletes the
item from here. Agreed 2026-08-11; `git push` stays manual.

**Nothing carries it right now.** Two rounds have been run and both are spent:
nine items on 2026-08-22 (#3, #7, #17, #34, #39, #40, #42, #43, #44) and ten
more the same day (#1, #5, #8, #9, #12, #32, #36, #46, #48, #50). Their numbers
are permanent gaps like any other, and git log is where they went. Four items
were closed outright alongside the second round (#6, #14, #41, #45) — the
decision there was that the current behaviour is right, which is completion.

What made those tags honest is worth keeping for the next round. Every item but
one named its decision inline, in a paragraph saying *Decided 2026-08-22* and
what was rejected. The exception carried no decision because there was none to
make — it named a plainly wrong fact, and correcting it was not a choice anyone
had to make, which is the one case where a bare tag is honest.

The bar is *no decision left in the item*, not *small*. An item that names a
product or UX choice — even an easy one — is not `[auto]`, because picking it is
the dev's call and a commit is the wrong place to discover the pick was wrong.

**Item numbers are stable ids, unique across the whole file.** One sequence runs
through every section; deletions leave gaps and nothing ever renumbers. A new
item takes **one past the highest number ever issued** — never the lowest unused
one. Gaps are permanent on purpose: refilling `#7` would silently repoint every
citation the old `#7` ever earned, which is the rot stable ids exist to prevent.
The number comes from the file rather than from the section, so a section reads
with jumps in it — expected, and carrying no meaning.

**The high-water mark.** *Highest ever issued* is normally just the highest
number present, and stops being that the moment the top item is resolved. So
**deleting the highest-numbered item leaves its bare number behind**: if `#51`
goes while it is still the top item, a lone `51.)` stays, at the foot of the file
below the last section — it belongs to the sequence, not to a section. No date
and no note; completion lives in git history, and `git log -S "51.)" --
docs/ISSUES.md` says when and why. Gaps in the *middle* get no marker at all —
`47, 49, 51` already says 48 and 50 existed, and a column of dead numbers would
cost Bugs and Features the one screen
they are held to. Nor can a mark accumulate: **any** new item clears it, because
the new number lands above it and a live item carries the ceiling again.

Set 2026-08-22, replacing per-section numbers that restarted at 1 and a rule that
renumbered on every delete. Two things forced it. `#12` **used to be ambiguous
across five sections**, so every citation had to carry a section name, and when
one didn't it broke — a bare "see #14" inside a Tech Debt item meant an item in
the same section that had since moved. **And an item could not change sections
without changing its number**, which is the same rot the stable-id rule exists to
prevent; reclassification is common here, so per-section ids were only
half-stable. A global id survives both.

So **citing** `ISSUES #33` **from a code comment is legitimate**, and the section name
is optional garnish. But it is legitimate *rarely*, and the sweep that repointed
the eleven pre-existing citations on 2026-08-22 is why: **every one of them
described work that had already landed** — the sync purge, the delta cursor, the
history-id collision — so none belonged in a queue of open work at all, whatever
its numbering. A code comment almost always explains what the code *does*, and
that is IMPLEMENTATION.md's job (`IMPLEMENTATION.md → *Retention over reconciliation*`); a phrase also says what it means without a lookup. Cite an
ISSUES number only when the comment genuinely points at work still queued —
a known gap the reader might otherwise "fix" by accident — and expect to delete
the comment when the item goes.

---

## Bugs

2.) **Internal Link does not admit value edit.** - Decide UX: Name of link should be fixed at mint-time, only editable through the library? (Or maybe Settings with back-propagation to the Library??) But either way, the actual kv value should be editable.

49.) **On DuckDuckGo browser: right edge is smashed against the window edge.**

## UI, styling, layout

4.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

## Features

10.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

11.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

13.) **Decide Field "re-configure" UX** — **re-opened 2026-08-20**: the 2026-08-17 edit-in-place answer died with the rejected place-design (SUPERSEDED). Under fork-never-mutate (SPEC → *Edit / Delete Semantics*), "re-configure" means minting a successor Definition and rebinding the instance — the affordance for that is undecided. The *link* half is no longer part of this: the Config band's provenance line reveals the Definition in the Library lens as of 2026-08-22, so what is left here is purely the fork.

15.) **Should TreeNodeDetails' subsections be reorderable?** - It could easily be part of the authoring config. But should it?

16.) **Change TreeNodeDetails/Config to /"Settings"?** - Decide what, if anything, can be edited from there. If nothing, then why show it? Even though it shows info from config, user-facing idea is "settings".

18.) **Single Image Field / History is just the history of the caption.** - Decide composite Field structure and layout. 

47.) **A** `Definition` **carries no version and no description, so two of the five facts #17 asked a Kind-band row to show could not be shown** — the row now carries `id`, `updatedAt` and `authorId` (rendered *Coined when by who*, correct because a Definition is written once — fork-never-mutate, SPEC → *The cascade*). The other two have no home: there is no `version` column, and under forking there is nothing for one to count — a successor is a new Definition with a new id, which is why the id is doing the disambiguating. `description`/`byline` is the same want as #11, which is where it should be decided; adding either is a data-model change, not presentation. Read from `models.ts` while implementing #17, 2026-08-22.

## Architecture

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

19.) **Per-viewer overlay merge in** `effectiveChildren` — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#22). Detail parked in LATER.md → typed trees.

20.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

21.) **The rest of the catalogue (SPEC §6c)** — the `Edges` family (`other-end` / `approval`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md. The fourth Edges member landed separately as `external-link` (2026-08-12); these three still wait on the overlay (#19) or on `ElementHistory` reads.

22.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive` — the traversal itself is built (`gatherAncestors`, nearest-first), so what remains is the arbitration. The disposition vocabulary is already encoded on the schema; this wires it. Blocked on identity as much as on the arbitration: an app→org→role→user cascade needs a user, and `getCurrentUserId()` (`src/context/userContext.ts`) is still the constant `localUser` — see LATER → *typed trees* → **Identity as a resolver seam**.

23.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites. The nested-job half is gone (sub-jobs decided against 2026-08-12, ELEMENT-MODEL §job); what remains is one deep job appearing in every ancestor above it.

24.) `KindAdornment` **re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

25.) `NavigableRow` **"peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted. **The Library lens was the first surface to want one and decided against it** (2026-08-20): its previews are *live but write-free* — the real Renderer in `pendingMode` over preview-local state, with no Element behind the row — which reads better than inertness and needs no new render path. The truly-inert variant still has no caller.

26.) `internal-link` **real target picker** — the target is still a raw element-id paste. Editing a saved link landed 2026-08-16; the picker is the remaining half, and it needs the address (nearest ancestor + name) in its result rows for the same disambiguation reason the value cell does. Whether it should be *constrained* by `TargetSpec.allowedKinds` is a spec decision first — LATER → *§6b minimal kind set*.

27.) `stream` **shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

28.) `resolveEdge` **cannot tell a deleted target from a live one** — `getElementById` is a bare `db.elements.get(id)` (`IDBAdapter.getElement`), unlike `listChildElements` directly beside it, so a soft-deleted `internal-link` target keeps resolving: the row renders its address and still offers `→`, which reveals into a card whose filtered child list no longer contains it. Soft delete not cascading (SPEC → *Soft Deletion*) adds a second case no per-row check catches — a target beneath a deleted ancestor carries `deletedAt: null` and looks healthy while being unreachable. Widen `resolveEdge` to a status (`live | deleted | unreachable | missing`) and render the four distinctly, keeping the last-known name on a tombstone rather than collapsing to a bare id. `missing` **must never read as deleted** — an unresolvable id may simply not have synced down yet, the same reasoning as IMPLEMENTATION.md → *Retention over reconciliation*. This is also the seam `ValiditySpec` plugs into when `approval` lands. Read from the code 2026-08-16; the docstring in `InternalLinkField.tsx` asserted the opposite and was corrected in the same pass.

29.) **Renaming a *Field* has no decided semantics** — the node half landed 2026-08-22 (double-tap the PARENT card's title), which gave `UPDATE_ELEMENT_NAME` its first production caller and exercised `internal-link`'s live pin at last: a link's rendered address follows its target's rename. The Field half needs a decision the repo asks in two other places — Features → *Decide Field re-configure UX*, and Bugs → *Internal Link does not admit value edit*: a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so renaming an instance is purely local, while renaming the Definition **forks it** by SPEC → *The cascade* ("a Definition is forked, never mutated") and reaches no existing instance. "Rename here and propagate everywhere" is therefore a deliberate departure from the fork rule, not an implementation detail — and it needs an affordance that says how many instances are affected before it runs. Observed 2026-08-16 tracing the internal-link resolver.

**A child card cannot be renamed, by construction.** Rename is offered only where the tap is not already spoken for — on a clickable card the *first* tap of the double-tap re-roots, so there is no gesture left. Getting to a node's PARENT card costs the one tap that was in the way, so this is a shape, not a gap; it becomes a gap only if a card ever needs renaming without being entered. Landed with the node half, 2026-08-22.

**A node with no subtitle has nothing to double-tap.** `NodeSubtitle` renders an empty div, so an absent subtitle cannot be added in place — only replaced once it exists. The fix is a placeholder in the empty case (the shape `DataField` uses for an unfilled value), which is chrome the rename decision deliberately declined; worth doing if adding a subtitle after the fact is ever wanted. Observed while building the node half, 2026-08-22.

30.) `listRootElements` **hardcodes an implicit population gather** — `treeType === 'business'` at `IDBAdapter.ts:218` *is* the ROOT view's definition, and the Library lens adds a second population read (`library`-tree roots) beside it. `SourceSpec.relation` only speaks `children | ancestors | edges`, so "every root of a typed tree" has no explicit form; a population relation would let ROOT and the Library ride one primitive instead of two hardcoded filters. Fine as an implicit default for now. Surfaced in the Library-As-Lens-Tree design discussion, 2026-08-20.

31.) **The Library's two lens children are seeded; they could be provisioned** — v1 seeds all three Library chrome Elements (the `library` root plus `definitions` and `kinds`) as constant-id idempotent seed writes, because a boot-time singleton is exactly the seeder's job. The other way: the two children declare `provision` capabilities and ride the existing `KIND_CAPABILITIES`-derived schedule (`${parentId}::definitions`, the `jobs` pattern), triggered by the `library` root's creation — no new machinery, but nothing needs it while the trio is fixed. Decided seed-for-now in the Library-As-Lens-Tree design discussion, 2026-08-20.

33.) `per-user` **config sync is declared but collapses to shared** — `treeSyncMode('config')` returns `'per-user'` (`treePolicy.ts:35`), and the only consumer is `shouldSyncTreeType`, which asks "does it sync at all" and gets `true`. Nothing scopes the push, so the first `config`-tree row would ride the same shared lane as business content — a user's private prefs pushed to everyone, which is the one failure mode the typed-trees seam exists to prevent. Inert today only because Phase 1 has no `config` producer (the module docblock says so), which means **the first config producer is also the first test of this routing**: land those rows local-only and turn sync on deliberately rather than discovering the guard and the feature at once. Read from `treePolicy.ts` while scoping the per-population bootstrap, 2026-08-21.

## Tech Debt

35.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

37.) **Four** `ConfigForm`**s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with the composer stack rather than separately — retiring them alone would break its restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

38.) **Config nesting depth, at phone width** — a `number-kv` goes band → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card already indented under a node. Re-checked 2026-08-15 after the rework, at a 638px card (≈ `--container-max`): it reads comfortably, and the retired picker's `border-left` plus its `space-4 + space-2` indent are gone, so a level came off. **Actual phone width is still unverified** — Chrome would not shrink below ~674px inner width, so this stayed a hand-test on a real device. Cheapest fixes if it ever bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it.

51.) **SPEC and the Snackbar disagree about `onExpire` on replacement, and the delete-history deferral now rides on it** — SPECIFICATION.md → Snackbar & Undo §300 says a `show()` over a visible toast "immediately runs the prior toast's `onExpire`". The service does the opposite: `snackbar/index.ts` drops it, saying *does NOT fire on replace (per spec)* in a comment, and `snackbarService.test.ts` pins that behaviour in two tests (*replacement drops prior toast without running its onExpire*, and the same for `dismiss()`). One of the three is wrong and they cite each other. **The consequence is now real**: with the deferral built, a delete's audit row lands only from `onExpire`, so deleting a field and then doing anything else that toasts — or pressing Esc — loses that row permanently, while the tombstone stays. The undone-delete case the deferral was built for works; the interrupted-delete case silently doesn't. Deciding this is a spec call, not an implementation detail: either replacement/dismiss flush the tail (SPEC's reading) or the tail needs a home that isn't the toast. Read from all three while implementing the deferral, 2026-08-22.
