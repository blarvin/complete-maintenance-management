# ISSUES.md — Active Work Queue

Live queue of open work, ordered by priority within each section. Completion lives in git history, not here.

**House rules:**

- **Only open items.** When done, **delete** — don't check off. The code is the record.
- **One-line outcomes**, not task breakdowns. "Delete with undo" beats five bullets about dialogs + snackbars + cascades.
- **One screen.** If this file gets long, prune to LATER.md or delete stale items.
- **Order = priority.** No labels, no statuses. Top of a section = do next.
- **Bugs first**, then Features, then Tech Debt.
- For deferred ideas see LATER.md. For product scope see SPECIFICATION.md.

---

## Bugs

1.) **Only-child node gets a non-zero `siblingOrder`** — a freshly created node that is its parent's sole child is minted with e.g. `siblingOrder: 5` instead of `0`. Mint should seed the first child from `max(existing child order) + 1` (−1 → 0 when there are none); something is over-counting the base order.

2.) **`initStorage`/`SyncLifecycle` re-initialize repeatedly** — the `useInitStorage` `useVisibleTask$` (`src/hooks/useInitStorage.ts`) fires many times per session (observed 8+ init cycles, including 3 within one second), restarting sync each time. Suspected cause of the intermittent **"Field Failed to Sync"** toast: an in-flight push is interrupted by a re-init while a later cycle still lands the value in Firestore — so the data is correct and the warning is a false alarm. Also resets UI state mid-interaction (made browser smoke-testing flaky). Spotted during the `KIND_REGISTRY` widening; unrelated to it.


## Features

2.) **Node metadata in TreeNodeDetails** — Show `createdAt`, last `updatedAt`, last `updatedBy`.

3.) **Inline rename of NodeTitle and NodeSubtitle** — Decide UX (double-tap like DataFields? edit button?), then wire up. Currently nodes are rename-less after creation.

4.) **DataField restoration UI** — Surface soft-deleted fields somewhere (recycle bin? details view?) and allow setting `deletedAt` back to null. Data model supports it; UI doesn't.


## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite.

1.) **Typed trees (`treeType`) — per-viewer overlays** — the full four-value axis (`business`/`library`/`config`/`view-state`), per-tree sync/history routing (`treePolicy.ts`), and the `effectiveChildren` read chokepoint all landed as a seam (2026-06-28, IMPLEMENTATION.md). Remaining is the **per-viewer overlay merge** in `effectiveChildren` (config/view-state, incl. personal `siblingOrder`) — blocked on viewer/auth + the cascade arbiter (#4), so deferred to LATER.md.

2.) **Chrome entailment** — factor hardcoded shell drawing into a renderer reading the manifest (`re-root`→Up, `open`→Add, meta-fields→Details/Settings, grouping-tag→section).

3.) **The lens + node-like kinds, on the capability seam** — the capability vocabulary (six descriptors + node descriptors + `coherence`) landed as a component-free seam (2026-06-28, IMPLEMENTATION.md → *Capability descriptors (the seam)*); this item builds its first consumers. Start with the **minimal kind set** (code-work-map §6b — `intrinsic-node-scalar`, `org`, `job`, `jobs`, `asset-doc`: one per capability axis, stub renderers) on the engine (the `SourceSpec {relation, reach}` traversal + the lens gather/`ProvisionSpec` + the `Edges` resolver); then the rest of the catalogue (`logbook`/`log-entry`, `other-end`/`approval`/`part-supplier-link`, `asset-gallery`, `person`, `logical-container`). #5 (chrome entailment) is gated behind this set having several re-root kinds to vary on.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned copy-at-mint / delegated live-read / pinned), reading `ancestors/transitive`. The disposition vocabulary is already encoded on the schema (Config-as-Elements); this wires it.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.


## Tech Debt

1.) **pendingMode` boilerplate across DataField Components** — TextKv/EnumKv/NumberKv/SingleImage each repeat near-identical `pendingMode` wiring into `useFieldEdit` (and Enum has its own click-away path). Don't abstract until a 5th component lands and the pattern is clear — premature now would obscure more than it shares.

2.) **useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Works fine, every consumer destructures the same way, no obvious seam. Revisit only if a future Component genuinely needs a different edit lifecycle (e.g. multi-step upload flow).

3.) **Cypress: construction commit captures last keystroke** — `commitPendingDraft` reads the localStorage draft, so the composer's write-through (`setPendingValue$`) must flush before the node's Create click. A unit test can't reproduce the input→click timing; needs a Cypress spec that types a field value and immediately clicks Create, then asserts the field persisted with that value (not "Empty").

4.) `coerceTimestamps` only handles `updatedAt`/`deletedAt`** — fine today, but a silent trap for any future timestamp column (`createdAt` in Features above, ELEMENT-MODEL.md `approval` pins). A "coerce all `*At` keys" rule would be self-maintaining.

5.) **History revisions collide across clients.** `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally from local history. Two offline clients editing the same element will mint the same `${id}:${rev}`, and the sync upsert (`applyRemoteElementHistory` / `setDoc`) silently overwrites one client's audit row with the other's. For an *append-only audit log*, that's a real integrity hole once multi-device becomes real. Phase-2 fix candidates: random history ids ordered by `(elementId, updatedAt)`, or client-scoped rev (`${elementId}:${clientId}:${rev}`). Worth a LATER.md entry now so the eventual fix is a column-add, not a migration.

