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
Second batch tagged 2026-08-12 — Architecture #9, #10, #13–#16, #18, #19, each
carrying the decision it was blocked on.

---

## Bugs

1.) **[Fields UI] Composer draft loses the uncommitted keystrokes** — a ticked row survives reload (localStorage `pendingFields:<nodeId>`), but text still sitting in its editor does not: the value only reaches `setPendingValue` when the renderer commits (Enter / blur / outside-click via `pendingMode`), and a reload commits nothing. Falls short of the intended "tick + type, reload, rows restored". Flush the edit buffer on `beforeunload`/`visibilitychange`, or write through per keystroke in `pendingMode`. Pre-existing (same commit-on-blur structure in the Qwik original); surfaced in the Phase IV hand-test.

2.) **number-kv accepts radix literals** — `parseNumber` (numberKvState.ts) uses `Number`, which parses `0x1A` as 26, `0b101` as 5, `0o17` as 15 (verified at a node prompt). Harmless in practice — nobody types hex into a temperature field — and strictly better than the `parseFloat` it replaced, which read `0x1A` as 0. Rejecting them needs a full-string decimal/scientific regex. Left in deliberately when Bugs #1 was fixed; raise only if it ever bites.

## Features

1.) **Node metadata in TreeNodeDetails** — show `createdAt`, last `updatedAt`, last `updatedBy`.

2.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like

3.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

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

4.) **History revisions collide across clients** — `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally, so two offline clients editing the same element mint the same id and sync silently overwrites one audit row. Fix candidates: random ids ordered by `(elementId, updatedAt)`, or client-scoped rev.

5.) **IMPLEMENTATION.md CQRS section names pre-Element APIs** — its read/write-path examples use `getNodeQueries()`, `getFieldQueries()`, `listRootNodes()`, `DELETE_NODE`, all of which have zero hits in `src/`. Rewrite against the element-shaped API (`getElementQueries()` / `getDefinitionQueries()`, element command types); the section carries an inline warning meanwhile.

6.) **Element-vocabulary leaf-prop name polish** — `NodeTitle`/`NodeSubtitle` take `nodeName`/`nodeSubtitle`; the composer's `currentMaxCardOrder` keeps the `cardOrder` name (that half is `[Fields UI]`). Pure renames; do only if they bother someone.

7.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky. DataFields? edit button?), then wire up. Nodes are rename-less after creation.

8.) [auto] **IMPLEMENTATION.md cites a Cypress spec that doesn't exist** — the under-construction-key note names `cypress/e2e/repro-create-node.cy.ts` as its regression spec; `cypress/e2e/` holds only core-loop, lens-loop, offline-sync and retention. Either the spec was dropped in the SolidJS port and the guarantee is now untested, or the note should point at core-loop. Read during the 2026-08-13 hard-delete session.

10.) **Dev seeds are scaffolding but boot like product** — `seedDefinitions` calls itself "dev-seeded" and `__wipeDefinitions` calls restoring them a "factory-default reset", yet three of the seven (Type Of, Description, Tags) are the construction defaults every new node gets, so seeding cannot simply move behind the dev gate without changing what a production node is born with. Decide whether those three are product content (and rename away from "dev seed") or whether construction defaults should come from somewhere else. Surfaced 2026-08-13 when the `appDeveloper` author id stopped serving sync policy — it now marks authorship only.