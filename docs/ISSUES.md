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

---

## Bugs

1.) **[Fields UI] Composer draft loses the uncommitted keystrokes** — a ticked row survives reload (localStorage `pendingFields:<nodeId>`), but text still sitting in its editor does not: the value only reaches `setPendingValue` when the renderer commits (Enter / blur / outside-click via `pendingMode`), and a reload commits nothing. Falls short of the intended "tick + type, reload, rows restored". Flush the edit buffer on `beforeunload`/`visibilitychange`, or write through per keystroke in `pendingMode`. Pre-existing (same commit-on-blur structure in the Qwik original); surfaced in the Phase IV hand-test.

2.) **number-kv accepts radix literals** — `parseNumber` (numberKvState.ts) uses `Number`, which parses `0x1A` as 26, `0b101` as 5, `0o17` as 15 (verified at a node prompt). Harmless in practice — nobody types hex into a temperature field — and strictly better than the `parseFloat` it replaced, which read `0x1A` as 0. Rejecting them needs a full-string decimal/scientific regex. Left in deliberately when Bugs #1 was fixed; raise only if it ever bites.

## Features

1.) **Node metadata in TreeNodeDetails** — show `createdAt`, last `updatedAt`, last `updatedBy`.

2.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

3.) **[Fields UI] DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't.

## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

1.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#4). Detail parked in LATER.md → typed trees.

2.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

3.) **The rest of the catalogue (#6c)** — the `Edges` family (`other-end` / `approval` / `part-supplier-link`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive`. The disposition vocabulary is already encoded on the schema; this wires it.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

6.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites (couples to the job-subtype question, #13).

7.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

8.) **[Fields UI] `NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted.

9.) **Provisioned-lens lifecycle (jobs + logbook)** — provisioning is create-time only (`ensureProvisionedLenses`), leaving three gaps, generic across `PROVISIONED_LENSES`: backfill onto pre-existing nodes, de-provision/GC when the last target below is removed, and hiding an empty lens.

10.) **`capabilityEngine` `ancestors`/`edges` traversal** — only `children` is built; `ancestors` (feeds the cascade, #4) and `edges` (the Edges family, #3) currently throw in `capabilityEngine.ts`.

11.) **[Fields UI] `asset-doc` real target picker + editing** — the target is a raw element-id paste; wants a picker constrained by an allowed-target-kind config, plus editing a saved link.

12.) **[Fields UI] Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

13.) **`job` admits `job` children (sub-tasks)?** — `job.allowedKinds` includes `job` but no picker mints a sub-job. Decide nested-jobs vs job-subtypes (Task/Work-Order/Project) — a `capabilities.ts` allowlist call, coupled to #3.

14.) **`node.allowedKinds` real allow-policy** — a provisional literal dodging a `registry`→`capabilities` cycle; derive the honest "child nodes + field kinds" policy.

15.) **[auto] Enforce manifest key === manifest `kind`** — nothing checks a manifest registered under `'text-kv'` declares `kind: 'text-kv'`; a typed-key helper would make a mismatch a compile error.

16.) **Per-kind `coherence` overrides** — the `coherence?(caps)` hook on `ManifestIdentity` is unused; add per-kind rules only when a kind needs one beyond the global set.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

## Tech Debt

1.) **[Fields UI] `pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **[Fields UI] `useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle — the tree-native picker is likely to be exactly that, so the shape is worth settling there rather than now.

3.) **[Fields UI] Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **[auto] `coerceTimestamps` only handles `updatedAt`/`deletedAt`** — a silent trap for any future timestamp column; a "coerce all `*At` keys" rule would be self-maintaining.

5.) **History revisions collide across clients** — `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally, so two offline clients editing the same element mint the same id and sync silently overwrites one audit row. Fix candidates: random ids ordered by `(elementId, updatedAt)`, or client-scoped rev.

6.) **[auto] Debug logging ships to production un-gated** — `syncManager.ts` and `SyncPusher.ts` log every cycle, and `useElementChildren.ts:61` logs on every child load; none are `import.meta.env.DEV`-gated, so the built PWA narrates itself to the console. All pre-existing (verbatim from the Qwik original), but the migration was the moment to gate them and didn't. Gate or drop.

7.) **[auto] `NavigableRow` chevron `aria-label` is generic** — "Expand"/"Collapse" with no row context; "Expand {name}" would be friendlier. Trivial.

8.) **[auto] Dead `currentValue` prop on `DataFieldDetails`** — computed and passed by `DataField.tsx` but never read. Drop it, or wire it into the metadata display.

9.) **IMPLEMENTATION.md CQRS section names pre-Element APIs** — its read/write-path examples use `getNodeQueries()`, `getFieldQueries()`, `listRootNodes()`, `DELETE_NODE`, all of which have zero hits in `src/`. Rewrite against the element-shaped API (`getElementQueries()` / `getDefinitionQueries()`, element command types); the section carries an inline warning meanwhile.

10.) **Element-vocabulary leaf-prop name polish** — `NodeTitle`/`NodeSubtitle` take `nodeName`/`nodeSubtitle`; the composer's `currentMaxCardOrder` keeps the `cardOrder` name (that half is `[Fields UI]`). Pure renames; do only if they bother someone.

11.) **[auto] `vite.config.ts` `preview.headers` is dead config** — the `Cache-Control` block applies to `vite preview` (`npm run preview`), but the PWA is exercised via `preview:pwa` (`npx serve dist`), which never reads it. Either drop it or move the header tuning onto the `serve` invocation.

12.) **Single 605 kB bundle, precached atomically** — one chunk (168 kB gzip, Firebase-dominated) trips Rollup's size warning, and the SW precaches via `cache.addAll`, which is all-or-nothing: one failed fetch on a cold install caches nothing. Fine at prototype scale; split the vendor chunk if offline install ever proves flaky.