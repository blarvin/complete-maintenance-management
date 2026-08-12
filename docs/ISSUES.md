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

3.) **Delta-sync cursor is the local clock, compared against server-stamped rows** — `syncDelta()` sets the cursor with `now()` while every row's `updatedAt` comes from `serverTimestamp()`, so a fast client's cursor can jump past rows it never pulled (elements and history share the one cursor). Heals on the next app start, which runs `syncFull()` — a staleness window, not lost history. High-water mark (cursor = `max(updatedAt)` over the rows actually received) is the probable solution. Read in the 2026-08-12 delta-sync session; not observed in the wild.

## Features

1.) **Node metadata in TreeNodeDetails** — show `createdAt`, last `updatedAt`, last `updatedBy`.

2.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

3.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't.

## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

1.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#4). Detail parked in LATER.md → typed trees.

2.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

3.) **The rest of the catalogue (#6c)** — the `Edges` family (`other-end` / `approval`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md. `part-supplier-link`, the fourth Edges member, is split out as #18 — it is the one with no blocker.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive` (built in #10). The disposition vocabulary is already encoded on the schema; this wires it.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

6.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites. The nested-job half is gone (sub-jobs decided against 2026-08-12, ELEMENT-MODEL §job); what remains is one deep job appearing in every ancestor above it.

7.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

8.) **[Fields UI] `NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted.

9.) **[auto] Provisioned-lens backfill onto pre-existing nodes** — provisioning is create-time only (`ensureProvisionedLenses` runs inside `CREATE_ELEMENT`), so a node that predates a lens kind never grows one; `logbook` landing after `jobs` is the case that already happened and will recur. Reconcile idempotently over existing re-root elements, generic across `PROVISIONED_LENSES`. Decided 2026-08-12: an empty lens **stays visible** — the only door to creating the first job is inside its own box — which also closes the other two gaps of this item as filed (no de-provision/GC, no hide-when-empty).

10.) **[auto] `capabilityEngine` `ancestors` traversal** — only `children` is built; `ancestors/direct` (the parent) and `ancestors/transitive` (nearest-first walk to the root) throw in `capabilityEngine.ts`. Build both on `getElementById`, unit-tested against a mock `IElementQueries` — this is what the cascade (#4) reads, and `inherit-unless-override` after it. `edges` stays throwing until the Edges family (#3) has a consumer.

11.) **[Fields UI] `asset-doc` real target picker + editing** — the target is a raw element-id paste; wants a picker constrained by an allowed-target-kind config, plus editing a saved link.

12.) **[Fields UI] Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

14.) **[auto] Derive the child-kind allowlists instead of hand-listing them** — `node`/`org`/`job`/`log-entry` each repeat a literal kind list in `capabilities.ts` (provisional literals dodging a `registry`→`capabilities` cycle), so a new kind has to be added to four lists by hand and a miss is silent. Derive the base — creatable node kinds + composer field kinds — from component-free data; that needs a `mintVia` mirror alongside `KIND_PLACEMENT`, the same accepted cross-boundary duplication, which #15's boot check then guards. Decided 2026-08-12: the current asymmetry is deliberate and survives the rewrite — `node`/`org` may hold other containers, `job`/`log-entry` may not hold an `org` — expressed once as a named exclusion rather than four times as an omission.

15.) **[auto] Enforce manifest key === manifest `kind`** — nothing checks a manifest registered under `'text-kv'` declares `kind: 'text-kv'`. Not the small typed-key helper it looks like: `Kind` is `keyof typeof KIND_REGISTRY` and `ManifestIdentity.kind` is `Kind`, so *any* compile-time key/kind comparison must resolve a manifest's type, which re-enters `Kind`, which needs the registry. Three shapes tried, all circular (TS2456/TS7022): a generic `keyedByOwnKind` wrapper, per-manifest `satisfies KindManifest` to preserve the literal, and a post-hoc mapped-type assertion over `typeof KIND_REGISTRY`. Attempted and reverted in the 2026-08-11 autonomous pass. Decided 2026-08-12: stop chasing the type and catch it at **boot in dev** — an `import.meta.env.DEV` loop in `registry.ts` that throws on any key/`kind` disagreement, absent from the prod bundle, failing on the first `npm run dev` rather than in CI. The same loop covers the mirrors that today say in prose they cannot be checked: `KIND_PLACEMENT[k]` vs the manifest's `placement`, and `provisionPolicy`'s `LENS_NAMES[k]` vs its `pickerLabel`.

16.) **[auto] Per-kind `coherence` hook can never fire where it lives** — it is declared on `ManifestIdentity`, but the one caller that would run it is the registry coherence test, which reads the component-free `KIND_CAPABILITIES` and may not import a manifest (no Solid JSX transform in `vitest.config.ts`); the running app never calls it either. So a kind that declared a rule today would be silently unchecked. Decided 2026-08-12: move per-kind rules to the pure-data side so the existing test picks them up. No kind needs a rule yet — this lands the wire, not a rule.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

18.) **[auto] `part-supplier-link`** — the fourth `Edges` member and the only kind exercising `TargetSpec.scope: 'external'` (`asset-doc` covers `internal`, so the descriptor's other half has never been run). Value is `{ url }`, opens in a new tab; no resolver, no config sub-fields. Fully specced in ELEMENT-MODEL §part-supplier-link; split out of #3 because the rest of that family waits on the overlay (#1) or on `ElementHistory` reads. Note: the renderer is a `.tsx`, so typecheck/lint plus a unit test over the value handling is all the automated cover there is — the row itself wants a hand-look.

19.) **[auto] Both lens consumers bypass the `derivation` descriptor** — `useLensGather` and `KindAdornment` each call `gatherDescendants` directly and then filter by kind in the component, so the manifest's `derivation.source` is never actually read (both hardcode `children/transitive`) and `targetKind` is applied twice, in two places, one of which also hand-excludes provisioned lenses. Give the engine a `gatherByDerivation(rootId, derivation, q)` honouring both halves and have the two consumers read it; the descriptor stops being decoration. Pure and unit-testable, no UI change. Read in the 2026-08-12 architecture pass.

## Tech Debt

1.) **[Fields UI] `pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **[Fields UI] `useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle — the tree-native picker is likely to be exactly that, so the shape is worth settling there rather than now.

3.) **[Fields UI] Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **History revisions collide across clients** — `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally, so two offline clients editing the same element mint the same id and sync silently overwrites one audit row. Fix candidates: random ids ordered by `(elementId, updatedAt)`, or client-scoped rev.

5.) **IMPLEMENTATION.md CQRS section names pre-Element APIs** — its read/write-path examples use `getNodeQueries()`, `getFieldQueries()`, `listRootNodes()`, `DELETE_NODE`, all of which have zero hits in `src/`. Rewrite against the element-shaped API (`getElementQueries()` / `getDefinitionQueries()`, element command types); the section carries an inline warning meanwhile.

6.) **Element-vocabulary leaf-prop name polish** — `NodeTitle`/`NodeSubtitle` take `nodeName`/`nodeSubtitle`; the composer's `currentMaxCardOrder` keeps the `cardOrder` name (that half is `[Fields UI]`). Pure renames; do only if they bother someone.

7.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky.