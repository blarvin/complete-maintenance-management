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
item from here. Agreed 2026-08-11; `git push` stays manual. An earlier nine —
#3, #7, #17, #34, #39, #40, #42, #43, #44 — were taken in one pass on 2026-08-22
and are gone, one commit each, so their numbers are permanent gaps like any
other.

**Eight carry it now, set the same day: #5, #8, #9, #12, #32, #36, #46, #50.**
Every one of them names its decision inline, in a paragraph that says *Decided
2026-08-22* and what was rejected — which is what makes the tag honest rather
than a shortcut. A tenth was tagged with no decision attached, which is the one
case where that is honest: it named a plainly wrong fact, and correcting it was
not a choice anyone had to make. Four items were closed outright in the same
round (#6, #14, #41, #45) — the decision there was that the current behaviour is
right, which is completion, so they went.

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
**deleting the highest-numbered item leaves its bare number behind**: if `#48`
goes, a lone `48.)` stays, at the foot of the file below the last section —
it belongs to the sequence, not to a section. No date and no note; completion
lives in git history, and `git log -S "48.)" -- docs/ISSUES.md` says when and
why. Gaps in the *middle* get no marker at all — `45, 46, 48` already says 47
existed, and a column of dead numbers would cost Bugs and Features the one screen
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

50.) `[auto]` **On mobile (Chrome, DDG, PWA) cannot persist Field value.** - OSK 'enter' exits and jumps focus instead.

**Diagnosed 2026-08-22, and it is not the keyboard.** `useFieldEdit.inputBlur` branches: a `pendingMode` row calls `save()`, a *persisted* row calls `stopFieldEdit()` and resets the buffer — **blur discards the edit**. On a desktop the only way to blur is to click away, so that reads as "cancel" and nobody noticed. On a phone the OSK action key *is* a blur, so there is no reachable way to commit at all. `onDocumentPointerDown` (outside-click) carries the same two-branch shape for the same reason.

Proven with a throwaway Cypress spec at the config's 375×667, five cases, deleted after: **A** Enter commits ✅ · **D** the *same* blur on a draft row keeps the value ✅ (that is the other branch) · **E** tapping outside the row still cancels ✅ · **B** blur alone loses it ❌ · **C** an OSK-shaped `keydown` (`key: 'Unidentified'`, `keyCode: 229`) then blur loses it ❌. **B is red with no keydown at all**, which rules out the obvious theory — key-code handling is not the hole, so do not go chasing `keyCode 229` or `compositionend`. `BLUR_SUPPRESS_WINDOW_MS` (220ms, armed only by `inputPointerDown`) is not implicated either.

Hits the five text-buffer kinds — `text-kv`, `number-kv`, `single-image`, `internal-link`, `external-link` — i.e. everything through `useValueSlot`. **Not** `enum-kv`, which commits on the option tap and never holds an edit buffer, and not the Config band, whose `LeafRow` already commits on native `change` (blur or Enter) — the band was right all along.

**Decided 2026-08-22: blur saves, plus `enterkeyhint="done"`.** The persisted arm of `inputBlur` calls `save()`, exactly as the `pendingMode` arm already does; the no-op gate means an unchanged value still dispatches nothing. `enterkeyhint="done"` goes on the edit inputs so the action key reads Done and dismisses rather than advancing, which answers the *jumps focus* half of the report (`NumberKvField` already sets `inputMode`, so keyboard hints have precedent here).

Two things the fix must not disturb, both already pinned by the cases above. **Outside-click must keep cancelling** — it survives because `pointerdown` lands before `blur`, so the document listener closes the FSM and blur's own `editingElementId` guard then fails; case E is the guard, and it must stay green. And **Enter must not double-save** for the same reason. Rebuild A–E as the regression spec and land it green rather than committing it red (the rule #39 set). Leave the textarea's Enter-saves-instead-of-newline behaviour alone — that is deliberate, and `TextKvField`'s docblock says why the textarea exists at all.

## UI, styling, layout

4.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

5.) `[auto]` **Typing a long field name resizes the card's whole label column, live, per keystroke** — `.nameInput` carries `field-sizing: content`, and the `label` track is `minmax(var(--label-width), auto)`, so every character shoves every other row's value across. Already better than it was: the reflow used to reach past the card, and is now confined to the Fields of the node being edited. Still jarring.

Measured 2026-08-22, at `--text-sm: 11px`. Both spaces and `M`s cap at **50** characters (`maxlength="50"` on the input, and `setLabel` slices to `LABEL_MAX`); typing 60 of either returns 50. What differs is width, which is what reads as "unlimited": 50 `M`s renders a 458px box, 50 spaces 153px, 40 characters of realistic mixed text 216px. So the character limit and the column width are two separate numbers and must not be set to the same one — 40 characters is ≈245px in `ch`, and a 375px phone gives the whole row only ~282px.

**Decided 2026-08-22: fix the column and cap the name, at different numbers.** The `label` track becomes a fixed `var(--label-width)` rather than a `minmax(…, auto)`, and the token goes to **120px** (~20 characters) — wider than the ~93px the auto track currently picks for `Filter Part Number:`, which also answers the complaint that the value column sits too far left. Labels longer than the track **ellipsize**. The name limit drops from 50 to **40** characters (`NAME_MAX` in `AddFieldSurface.tsx`, `LABEL_MAX` in `useDefinitionDraft.ts`). The track then never moves — not while typing, not when a long field is created, not between cards — which is the whole point. Leaves ~160px of value run on a 375px phone. Note this retires the "sizes to the widest label rather than truncating" intent written into `FieldList.module.css`; that comment wants updating, not preserving.

## Features

8.) `[auto]` **Inline rename of NodeTitle and NodeSubtitle** — nodes are rename-less after creation. **Decided 2026-08-22: double-tap the title, exactly as a DataField value works.** The constraint that settles it is that the node header is *already* a navigation target — a tap re-roots — so a single tap cannot also mean edit, and `useDoubleTap`'s accidental-brush guard is precisely what that conflict needs. No new chrome, and no coupling to another region's state (the rejected third option gated edit on the details panel being open, which is the coupling #25 and `ExternalLinkField` both argued against). Subtitle takes the same treatment.

This is also **the first production caller of `UPDATE_ELEMENT_NAME`** (#29: registered in `handlers.ts`, exercised only by `elementCommands.test.ts`), so it is the first time `internal-link`'s live pin has anything to follow — a link's rendered name should track the rename without a remount, and that is worth watching once. Node rename only: renaming a *Field* is the half that still needs a decision, and #29 is where it lives.

9.) `[auto]` **DataField restoration UI** — soft-deleted fields are invisible once the Snackbar's undo window has passed. The data model supports restoring and so does the command bus: `RESTORE_ELEMENT` is registered and already exercised by every delete's Undo, so this is UI over an existing command, not new storage work. **Decided 2026-08-22: it goes in the node's details panel**, where the item always said it belonged and where #7's metadata block has now given the panel a shape to hang things on — a *Deleted fields* list with a Restore per row, rendered only when there are any, so a node with nothing deleted looks exactly as it does today. Rejected: a collapsed band on every Data Card, which would sit empty on almost every card forever.

The read is the piece that does not exist yet: `listChildElements` filters deleted rows out, so this needs a deliberate deleted-only query rather than a filter flip.

10.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

11.) **Decide namespace collision scheme for libraryFields with same display name to coexist** — when two libraryFields have the same display name, they will need to coexist in the library. We need to decide how to handle this. They each already have a unique id and version, but that is not UX friendly. They may need byline or description like a subtitle (displayed in Tools section).

12.) `[auto]` **Active link to FieldLibrary from Config section of a Field** — now has a destination to point at (the Definition's entry in the Library lens, built 2026-08-20), and the reveal machinery landed (`useRevealOnArrival`), so the shape is reveal-the-Definition rather than re-root-to-the-Library. Read-only at the far end: the lens writes nothing.

**Decided 2026-08-22: no new row anywhere — the existing provenance line becomes the link.** `ConfigSummary` already renders `from Weight` (its `source` prop), and it is the *same component* mounted by both callers: a persisted Field's Config band, and the Add Surface's band when a Definition has been picked. Making that line the affordance therefore satisfies this item and LATER → *Editing a picked Definition's config from the Add Surface* in one change, with nothing added to a Config band that #38 already flags as deeply nested. `revealElement({ elementId: definitionId, branchId: … })` is the transition, the same one `InternalLinkField`'s `→` uses — a button, not a URL.

13.) **Decide Field "re-configure" UX** — **re-opened 2026-08-20**: the 2026-08-17 edit-in-place answer died with the rejected place-design (SUPERSEDED). Under fork-never-mutate (SPEC → *Edit / Delete Semantics*), "re-configure" means minting a successor Definition and rebinding the instance — the affordance for that is undecided. A Field's Config band still wants a live link to its Definition (same want as Features → *Active link to FieldLibrary from Config section of a Field*); the Library lens gives it a read-only destination.

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

29.) **Renaming an Element has no caller, and for a Field no decided semantics** — `UPDATE_ELEMENT_NAME` is registered in `handlers.ts` and exercised only by `elementCommands.test.ts`; `diffElementChanges` already writes `property: 'name'` history. So the storage half is built and nothing in the UI dispatches it, which is why `internal-link`'s live pin (whose whole visible payoff is following a target's rename) has never been exercised. Node rename is the easy half (Features → *Inline rename of NodeTitle and NodeSubtitle*). The Field half needs a decision the repo asks in three places already — here, Features → *Decide Field re-configure UX*, and Bugs → *Internal Link does not admit value edit*: a Field's `name` is snapshotted from `def.label` at mint (`handlers.ts`), so renaming an instance is purely local, while renaming the Definition **forks it** by SPEC → *The cascade* ("a Definition is forked, never mutated") and reaches no existing instance. "Rename here and propagate everywhere" is therefore a deliberate departure from the fork rule, not an implementation detail — and it needs an affordance that says how many instances are affected before it runs. Observed 2026-08-16 tracing the internal-link resolver.

30.) `listRootElements` **hardcodes an implicit population gather** — `treeType === 'business'` at `IDBAdapter.ts:218` *is* the ROOT view's definition, and the Library lens adds a second population read (`library`-tree roots) beside it. `SourceSpec.relation` only speaks `children | ancestors | edges`, so "every root of a typed tree" has no explicit form; a population relation would let ROOT and the Library ride one primitive instead of two hardcoded filters. Fine as an implicit default for now. Surfaced in the Library-As-Lens-Tree design discussion, 2026-08-20.

31.) **The Library's two lens children are seeded; they could be provisioned** — v1 seeds all three Library chrome Elements (the `library` root plus `definitions` and `kinds`) as constant-id idempotent seed writes, because a boot-time singleton is exactly the seeder's job. The other way: the two children declare `provision` capabilities and ride the existing `KIND_CAPABILITIES`-derived schedule (`${parentId}::definitions`, the `jobs` pattern), triggered by the `library` root's creation — no new machinery, but nothing needs it while the trio is fixed. Decided seed-for-now in the Library-As-Lens-Tree design discussion, 2026-08-20.

32.) `[auto]` `.previewGrid` **duplicates** `FieldList`**'s named grid tracks** — `DataField`'s `.datafieldWrapper` is `grid-template-columns: subgrid`, so a row mounted outside a `FieldList` collapses its columns (label overlapping value) unless its container restates the six named tracks. Observed building the Library lens, 2026-08-20.

**The trigger has fired**: re-counted 2026-08-22 and the six tracks are restated in **three** files, not two — `FieldList.module.css` (`.fieldList`), `LibraryViews.module.css` (`.previewGrid`), and `FieldComposer.module.css` (`.rows`, dormant but compiling, and kept that way by #34's decision).

**Decided 2026-08-22: extract now, as a token.** `--field-grid-tracks` in `tokens.css` holds the whole track list, named lines included, and all three write `grid-template-columns: var(--field-grid-tracks)`. Chosen over `composes:` from a shared CSS module because it needs no CSS-modules composition, reaches the dormant copy for free, and makes a fourth caller one line. Named grid lines do survive a custom property — check that first, it is the one thing that could sink this. Note #5 changes the `label` track in the same region, so land them in an order that does not leave two definitions disagreeing.

33.) `per-user` **config sync is declared but collapses to shared** — `treeSyncMode('config')` returns `'per-user'` (`treePolicy.ts:35`), and the only consumer is `shouldSyncTreeType`, which asks "does it sync at all" and gets `true`. Nothing scopes the push, so the first `config`-tree row would ride the same shared lane as business content — a user's private prefs pushed to everyone, which is the one failure mode the typed-trees seam exists to prevent. Inert today only because Phase 1 has no `config` producer (the module docblock says so), which means **the first config producer is also the first test of this routing**: land those rows local-only and turn sync on deliberately rather than discovering the guard and the feature at once. Read from `treePolicy.ts` while scoping the per-population bootstrap, 2026-08-21.

## Tech Debt

35.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

36.) `[auto]` **SPEC promises a deferred delete-history write that isn't built** — SPECIFICATION.md → Undo semantics §233 says a DataField delete's history entry is written via `onExpire`, "only after the undo window elapses without undo — so that undone deletes leave no audit trace". Neither half holds: `onExpire` has no caller (it briefly had one — the Add Surface's pick-runs, gone since 2026-08-15), and `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline (`IDBAdapter.ts:402`). So an **undone delete leaves a delete history row today**, the opposite of the promise. Observed 2026-08-14 while implementing coalescing.

**Decided 2026-08-22: build the deferral, SPEC wins.** `commitWithUndo` passes an `onExpire`; `softDeleteElement` splits the tombstone from its history write, and the history row lands from the expiry callback. The reasoning: an undo inside a snackbar window is a slip, not an event — logging it makes the log noisier without making it truer. The rejected alternative (rewrite SPEC, keep the inline write, on the grounds that history is append-only everywhere else) was real enough to record, and would have cost a SUPERSEDED.md entry.

**Absorbs #41 (`Snackbar.coalesceKey` and `onExpire` have no production caller), 2026-08-22.** That item asked whether an unused seam earns its keep; this decision answers it for `onExpire` by giving it exactly the caller it was built for. `coalesceKey` stays unused and stays anyway — it is tested, it costs nothing, and the pick-runs shape it served could return. Nothing further to do for it, so the item goes rather than lingering as half a question.

37.) **Four** `ConfigForm`**s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with the composer stack rather than separately — retiring them alone would break its restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

38.) **Config nesting depth, at phone width** — a `number-kv` goes band → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card already indented under a node. Re-checked 2026-08-15 after the rework, at a 638px card (≈ `--container-max`): it reads comfortably, and the retired picker's `border-left` plus its `space-4 + space-2` indent are gone, so a level came off. **Actual phone width is still unverified** — Chrome would not shrink below ~674px inner width, so this stayed a hand-test on a real device. Cheapest fixes if it ever bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it.

46.) `[auto]` **The Add Surface loses its whole draft on reload** — `AddFieldSurface.tsx` has no persistence of any kind: no `localStorage`, no `beforeunload`, no `visibilitychange` (verified by search, 2026-08-22). The composer it replaced persisted ticked rows to `pendingFields:<nodeId>`, so this is a capability the tree-native surface did not inherit — and the loss is larger than the old composer bug, which dropped only uncommitted keystrokes while keeping the ticked rows.

**Decided 2026-08-22: persist the whole draft, keyed by node.** Name, kind, config and value — not a subset — because the thing actually worth losing sleep over is an authored `number-kv` config set knob by knob, and a half-persisted draft raises a question a full one does not (what a stored config means once the kind changed under it). Cleared on Create and on Cancel, the two places `useDefinitionDraft.reset()` already runs. `pendingDraft.ts` is the model to follow and is still live for node construction, so the shape is known — but this is a *new* store for the tree-native surface, not a restoration of the composer's, and it must not resurrect `pendingFields:<nodeId>`. The surviving-collapse case is already covered by `add-surface.cy.ts`; a reload case wants a spec beside it.
