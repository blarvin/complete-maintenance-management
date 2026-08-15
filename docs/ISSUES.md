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

**This pass's tag:** `[Fields UI]` marks work bound to the *current* Field
authoring/picking surfaces — the composer (`FieldComposer/`, `pendingMode`,
`pendingFields:` drafts) and the legacy "+ Add Field" (`CreateDataField`). The
next branch replaces both with a tree-native inline picker, so tagged items are
parked until it lands rather than fixed twice.

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

3.) **Text caret is nor showing in New Field Definition / Internal Link / Field Name entry field** - And others.

4.) **Internal Link does not admit value edit.** - Decide UX: Name of link should be fixed at mint-time, only editable through the library? (Or maybe Settings with back-propagation to the Library??) But either way, the actual kv value should be editable.

5.) **text-kv ("Description") changes flow when toggling Field Details of an urelated Field** - Causing a very annoying jump or lurch. Yhis is an older bug, present in the Qwik original and the current deployed production version on Netlify as well as dev. Tru for multiline and single line text-kv. Also noticed that the active entry field for the string is only about half the width (maybe constrained to a column?) while entering a value, which may be related.

## UI, styling, layout

1.) **Left or Right chevrons??** - A/B testing is the only real way to know. Earlier iterations attempted to follow the informational tiers... but who knows?

## Features

1.) **Field Adding and Authoring is still not quite "full preview"** - True WYSIWYG in-situ UI is a significant change and the next step. 

2.) **Field list in picker must be organised into colapsed groups by category.** - This will not be trivial; HOW should they be categorised? 

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

13.) **Decide Field value entry at mint-time UX** - Can it not conflict with instant mint? Instant mint means all fileds are minted naked and require one more step. For enum-kv it would be fairly easy. 

14.) **Add Field Picker / Option / Expand Chevron should show metadata like id, version, createdAt, createdBy, description/byline.** - Right now it shows the configured configs with their values, which is great. But it could say more.

15.) **New Field Definition / Config / Booleans should have checkbox instead of "--".** - 

16.) **Single Image Field / History is just the history of the caption.** - Decide composite Field structure and layout. 





## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

1.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#4). Detail parked in LATER.md → typed trees.

2.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

3.) **The rest of the catalogue (#6c)** — the `Edges` family (`other-end` / `approval`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md. The fourth Edges member landed separately as `external-link` (2026-08-12); these three still wait on the overlay (#1) or on `ElementHistory` reads.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive` — the traversal itself is built (`gatherAncestors`, nearest-first), so what remains is the arbitration. The disposition vocabulary is already encoded on the schema; this wires it.

6.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites. The nested-job half is gone (sub-jobs decided against 2026-08-12, ELEMENT-MODEL §job); what remains is one deep job appearing in every ancestor above it.

7.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

8.) **[Fields UI] `NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted.

11.) **[Fields UI] `internal-link` real target picker + editing** — the target is a raw element-id paste; wants a picker constrained by an allowed-target-kind config, plus editing a saved link.

12.) **[Fields UI] Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

## Tech Debt

1.) **[Fields UI] `pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **[Fields UI] `useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle — the tree-native picker is likely to be exactly that, so the shape is worth settling there rather than now.

3.) **[Fields UI] Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **[Fields UI] `cardOrder` vocabulary survives in the composer props** — `currentMaxCardOrder` threads through `FieldList`, `FieldComposerSlot`, `FieldComposer`, `CreateDataField` and `usePendingForms`, though the column has been `siblingOrder` since the Element refactor. All five are surfaces the tree-native picker replaces, so this rides that branch rather than being renamed twice. Beware: `db.ts` also names `cardOrder` in frozen historical schema versions, which must not change. (The `NodeTitle`/`NodeSubtitle` half of this item was done 2026-08-14.)

5.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. Untouched deliberately — code-splitting is a real decision, not a mop-up nicety: this is a route-less FSM app, so the natural seams are the kind renderers and the Firebase SDK. (Consolidated 2026-08-14 from a duplicate LATER entry under *PWA & Build*.)

6.) **Seed naming describes scaffolding, but the set is the app's default pack** — `seedDefinitions` says "dev-seeded" and `__wipeDefinitions` calls restoring them a "factory-default reset"; both read as throwaway, while the set is what every production node is born with. The underlying question ("are these product content?") was answered in discussion 2026-08-14 — neither, the *bindings* are the load-bearing part (LATER → *Definition Packs*). What's left here is comments plus the `__wipeDefinitions` console message; no behaviour change.

7.) **SPEC starter-Library table has drifted from `SEEDS`** — SPECIFICATION.md §456 lists 14 starter Definitions, `seedDefinitions.ts` ships 9, and neither is a subset of the other (spec-only: Location, Serial Number, Part Number, Manufacturer, Model, Installed Date, Note; code-only: Linked Doc, Logbook Policy). Reconcile when the default pack is authored — the specced 14 is the better demo set. Observed 2026-08-14.

8.) **SPEC promises a deferred delete-history write that isn't built** — SPECIFICATION.md → Undo semantics §233 says a DataField delete's history entry is written via `onExpire`, "only after the undo window elapses without undo — so that undone deletes leave no audit trace". Neither half holds: `onExpire` had no callers at all until the Add Surface used it for something else, and `IDBAdapter.softDeleteElement` writes the `action: 'delete'` row inline (`IDBAdapter.ts:402`). So an **undone delete leaves a delete history row today**, the opposite of the promise. Decide which side is right — building the deferral means `commitWithUndo` passing an `onExpire` and the adapter splitting the write, so it is a decision, not a mop-up. Observed 2026-08-14 while implementing coalescing.

9.) **The composer stack is dormant, and retiring it is a decision — not a scheduled mop-up** — the Add Surface landed 2026-08-14 and `ENABLED_ADD_FIELD_SURFACES` now runs it alone, so `FieldComposer/`, `CreateDataField/`, `usePendingForms`, the `pendingFields:` localStorage and `pendingMode` across the four kv renderers are unreachable but intact. **Restoring either id brings its surface back verbatim**, which is the point: they stay until deleting them is deliberately chosen, and nothing about the current state obliges it. Costs of keeping them: they are indexed and typechecked, so a search for "how does adding a field work" returns more than one answer, and `pendingMode` has to keep compiling through any `useFieldEdit` change. If retirement is ever chosen, it is one commit — the renderer cleanup and `useFieldEdit`'s pending lifecycle (Tech Debt #2) resolve in it, not before — and **tag the parent commit** so the composer stays reachable by name rather than by hash. Reframed 2026-08-14.

10.) **Four `ConfigForm`s are now unread by any live surface** — `TextKv`/`EnumKv`/`NumberKv`/`SingleImage` config forms, plus `LogbookConfigForm` and the required `ConfigForm` field on `InlineManifest`. Definition authoring is tree rows driven by `configSchema`, and cross-field invariants moved to `CONFIG_VALIDATORS`, so nothing reads them except the dormant composer's `DefinitionAuthoringForm`. They live and die with #9 rather than separately — retiring them alone would break the composer's restorability, which is the whole reason it is kept. Observed 2026-08-15 finishing Phase II.

11.) **Authoring nests four levels deep inside an already-indented card** — a `number-kv` goes picker → kind → group → compound → member, each indent one `--chevron-col-width`, inside a Data Card that is itself indented under a node. Untested on a phone at `--container-max` 650px; the failure mode is the value column squeezing to nothing rather than anything breaking. Cheapest fixes if it bites: drop the indent for the innermost level, or let a group row's children align with the group label rather than past it. Surfaced 2026-08-15 while building it; no hand-test evidence yet either way.

12.) **No Cypress coverage of the Add Surface at all** — the whole tree-native surface (pick, multi-pick coalescing, config peek, Definition authoring, roving focus) is verified only by hand. `core-loop.cy.ts` runs on `Description`, a construction default, so it never touches an add surface and stayed green through every commit of Phases I and II — it is **not** a canary for any of this. The keyboard model is the part that most wants a spec: unit tests structurally cannot reach it (`vitest.config.ts` has no Solid transform, and nothing test-reachable may import a `.tsx`), and it is where three separate focus bugs already hid. Observed 2026-08-15 finishing Phase II.

