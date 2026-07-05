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

## Features

1.) ~~Decide the fate of~~ `job` ~~children materialized under a node~~ — ✅ **resolved (2026-06-30): the** `Jobs` **container is the creation surface.** A `job` is authored from inside its node's `Jobs` container (parented to the owning node, context-aware) and is hidden from that node's normal child list (`isLensSurfaced`), so it no longer double-renders as a loose sibling *plus* a rollup row. The `Jobs` container is a **hybrid** — it owns its own DataFields *and* rolls up jobs — and renders each job field-like: a compact `NavigableRow` under a node, a Node-like CHILD card when re-rooted into. See IMPLEMENTATION.md → *#5 container half*.

2.) **Node metadata in TreeNodeDetails** — Show `createdAt`, last `updatedAt`, last `updatedBy`.

3.) **Inline rename of NodeTitle and NodeSubtitle** — Decide UX (double-tap like DataFields? edit button?), then wire up. Currently nodes are rename-less after creation.

4.) **DataField restoration UI** — Surface soft-deleted fields somewhere (recycle bin? details view?) and allow setting `deletedAt` back to null. Data model supports it; UI doesn't.

## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite.

1.) **Typed trees (**`treeType`**) — per-viewer overlays** — the full four-value axis (`business`/`library`/`config`/`view-state`), per-tree sync/history routing (`treePolicy.ts`), and the `effectiveChildren` read chokepoint all landed as a seam (2026-06-28, IMPLEMENTATION.md). Remaining is the **per-viewer overlay merge** in `effectiveChildren` (config/view-state, incl. personal `siblingOrder`) — blocked on viewer/auth + the cascade arbiter (#4), so deferred to LATER.md.

2.) **Chrome entailment** — *slices 1–2 done* (2026-06-29): slice 1 — the create surface + lens-aware shell read the parent's `childrenSpec` (`childrenPolicy.ts` → `allowedChildKinds`/`canHaveChildren`; `registry.ts` → `reRootCreateKindsFor`), so the node-create picker offers only admitted kinds (`job`→node/job, not org), a content-free lens offers no "Add", and the shell drops the DataCard/chevron for content-free kinds (IMPLEMENTATION.md → *#5 slice 1*). Slice 2 — the lens rollup now renders each gathered child as a generic `NavigableRow` (name re-roots, chevron expands its `FieldList` peek), retiring the dead-text list and giving render-location-inline + navigability its first consumer (IMPLEMENTATION.md → *#5 slice 2*). **Container half done (2026-06-30):** the `jobs` container is a **hybrid** (owns its own DataFields + rolls up jobs); each job renders field-like — a compact `NavigableRow` under a node, a Node-like CHILD card when re-rooted — authored inline via `LensCreate`, with `isLensSurfaced` the one predicate for hide-from-tree + trim-picker + provision-guard (IMPLEMENTATION.md → *#5 container half*). **Value-shape done (2026-07-05):** kinds pick a shape, never layout — `ownValue.shape` (`scalar | block | composite`) authored in `capabilities.ts`, the arrangement laws in the one `DataField` dispatcher, `hideLabel`/`blockValueLayout` retired (IMPLEMENTATION.md → *#5 value-shape*). Remaining: **rich lens rows** (per-job priority/owner/status — the "primary line", waits on `Action`); and the fuller manifest-driven shell regions (meta-fields→Details/Settings, grouping-tag→section).

3.) **The rest of the catalogue (#6c)** — the minimal kind set (`org`/`job`/`jobs`/`asset-doc`) + the rudimentary engine (`capabilityEngine.ts`) + `placement.ts` landed 2026-06-28; `logbook`**/**`log-entry` **landed 2026-07-01** — the lens's second target kind, which proved the lens generalizes by kind and converted the hardcoded per-node provisioner into a spec-driven one (`provisionPolicy.ts` + `ensureProvisionedLenses`, reading each manifest's `ProvisionSpec`); reused the generic lens surfaces unchanged (IMPLEMENTATION.md → *#6c logbook*). **Logbook's authored-in policy Definition landed 2026-07-01** via the Definition-binding seam (`fieldDefinitionId → definitionId` full type-family rename + placement-agnostic authoring contract + stamp-at-mint; IMPLEMENTATION.md → *Definition-binding seam*). Remaining: the fuller `Edges` family (`other-end`/`approval`/`part-supplier-link`), `asset-gallery`, `person`, `logical-container`.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned copy-at-mint / delegated live-read / pinned), reading `ancestors/transitive`. The disposition vocabulary is already encoded on the schema (Config-as-Elements); this wires it.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

6.) **Cross-*ancestor* rollup duplication (by design)** — the Jobs container gathers *transitively* (`gatherDescendants(owner)` filtered to `kind === 'job'`), so a single job appears in the Jobs rollup of *every* ancestor node — N live, navigable copies. The §5-container-half compounding is **gone**: raw `job` children no longer double-render (hidden from the tree via `isLensSurfaced`), and a `job` no longer owns its own `::jobs` lens (`ensureJobsLens` skips lens-surfaced kinds). What remains is the inherent cross-ancestor overlap — not a bug (rollup-at-every-level is by design); revisit with depth-scoping / de-dup if it bites (couples to the job-subtype question, #6c).

7.) `KindAdornment` **re-gathers the whole subtree on every write** — its `useVisibleTask$` runs a BFS over `el.parentId`'s entire subtree on each `storageEventBus` emit (50ms-debounced), and every expanded `NavigableRow` mounts a `FieldList` with its own subscription — O(subtree) per write. Fine at prototype scale; revisit if it gets sluggish. (The `initializeStorage()` call inside the regather is harmless — memoized — and could be dropped since data hooks already gate on init.)

8.) `NavigableRow` **"peek" is read-only for *adding* but not *editing*** — `hideAddSurfaces` suppresses the composer/legacy add-field surfaces, but existing field values in the expanded `FieldList` stay double-tap-editable. Intentional and documented, but a slight tension with the "peek" framing; revisit if a truly inert preview is ever wanted.

9.) **Provisioned-lens lifecycle (jobs + logbook)** — provisioning is create-time only (`ensureProvisionedLenses` on `CREATE_ELEMENT`), so three gaps remain, now generic across all `PROVISIONED_LENSES` (one fix covers both lenses): (a) **backfill** — nodes created before a lens kind existed carry no lens (today: reseed/wipe at prototype scale); (b) **de-provision/GC** when the last entry below is removed; (c) **hide an empty lens**. The canonical upward ancestor-walk provisioning (ELEMENT-MODEL §lens) is superseded by the per-node v1 — revisit only if the per-node rollup proves insufficient. *(Moved from LATER — a leftover of in-flight lens work, not a whole deferred feature.)*

10.) `capabilityEngine` ****`ancestors`**/**`edges` **traversal** — only `children` (direct/transitive) is built; `ancestors` (inheritance, feeds the cascade #4) and `edges` (curated membership, the Edges family #3) currently *throw* in `capabilityEngine.ts`.

11.) `asset-doc` **real target picker + editing** — the target is a raw element-id paste with no config; wants a picker constrained by an allowed-target-kind config, plus editing a saved link.

12.) **Field-composer restriction by** `childrenSpec` — the re-root create surface restricts by the parent's allowlist, but the field composer still offers all `FIELD_KINDS`. No-op today (every container admits every field kind); wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields.

13.) `job` **admits** `job` **children (sub-tasks)?** — `job.allowedKinds` still includes `job`, but no picker mints a sub-job (trimmed by `isLensSurfaced`) and a `job` gets no `::jobs` lens. Decide nested-jobs vs job-subtypes (Task/Work-Order/Project) — a `capabilities.ts` allowlist call, coupled to the job-subtype question (#3).

14.) `node.allowedKinds` **real allow-policy** — currently a provisional literal (`['node','text-kv',…]` + `TODO(#6)`) dodging a `registry`→`capabilities` cycle; derive the honest "child nodes + field kinds" policy.

15.) **Enforce manifest key === manifest** `kind` — nothing checks a manifest registered under `'text-kv'` actually declares `kind: 'text-kv'`; a typed-key helper would make a mismatch a compile error. Low value until kinds multiply.

16.) **Per-kind** `coherence` **overrides** — the `coherence?(caps)` hook on `ManifestIdentity` is available but unused (global rules live in `checkCoherence`); add per-kind rules only when a kind needs one beyond the global set.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but has no distinct arrangement law yet (the SPEC's own rule: a shape must carry one); joins `ValueShape` with its first consumer (e.g. a logbook feed). `block` already ships its law (tall + label + top chevron); its first consumer is `image` (map #8).

## Tech Debt

1.) **pendingMode`boilerplate across DataField Components** — TextKv/EnumKv/NumberKv/SingleImage each repeat near-identical`pendingMode`wiring into`useFieldEdit` (and Enum has its own click-away path). Don't abstract until a 5th component lands and the pattern is clear — premature now would obscure more than it shares.

2.) **useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Works fine, every consumer destructures the same way, no obvious seam. Revisit only if a future Component genuinely needs a different edit lifecycle (e.g. multi-step upload flow).

3.) **Cypress: construction commit captures last keystroke** — `commitPendingDraft` reads the localStorage draft, so the composer's write-through (`setPendingValue$`) must flush before the node's Create click. A unit test can't reproduce the input→click timing; needs a Cypress spec that types a field value and immediately clicks Create, then asserts the field persisted with that value (not "Empty").

4.) `coerceTimestamps` only handles `updatedAt`/`deletedAt`** — fine today, but a silent trap for any future timestamp column (`createdAt` in Features above, ELEMENT-MODEL.md `approval` pins). A "coerce all `*At` keys" rule would be self-maintaining.

5.) **History revisions collide across clients.** `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally from local history. Two offline clients editing the same element will mint the same `${id}:${rev}`, and the sync upsert (`applyRemoteElementHistory` / `setDoc`) silently overwrites one client's audit row with the other's. For an *append-only audit log*, that's a real integrity hole once multi-device becomes real. Phase-2 fix candidates: random history ids ordered by `(elementId, updatedAt)`, or client-scoped rev (`${elementId}:${clientId}:${rev}`). Worth a LATER.md entry now so the eventual fix is a column-add, not a migration.

6.) `NavigableRow` **chevron** `aria-label` **is generic** — reads "Expand"/"Collapse" with no row context; "Expand {name}" would be friendlier to screen readers. Trivial.

7.) **Dead** `currentValue` **prop on** `DataFieldDetails` — `DataField.tsx` computes `currentDisplayValue` via `displayPreview` and passes it, but `DataFieldDetails` never reads it. Drop the prop + computation, or wire it into the metadata display.

8.) **Element-vocabulary leaf-prop name polish** — `NodeTitle`/`NodeSubtitle` still take `nodeName`/`nodeSubtitle`; the composer param `currentMaxCardOrder` derives from `siblingOrder` but keeps the `cardOrder` name. Pure internal renames; do only if they bother someone.