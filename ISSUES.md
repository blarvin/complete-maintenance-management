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

1.) **number-kv accepts trailing garbage on save** — editing `1200.00` to `120nnnnn` saves `120` instead of raising the parse error: `parseNumber` (NumberKvField.tsx) uses `parseFloat`, which parses the numeric prefix and ignores the rest. Reject non-numeric trailing input (`Number(trimmed)` or a full-string check). Pre-existing (same in the Qwik original); surfaced in the Phase III hand-test.

2.) **One IndexedDB, two remotes — mode flips wipe data** — the plain page syncs against production Firestore while `?emulator=true` syncs against the emulator, but both share the same Dexie DB; each full-collection pull deletes local elements missing from *its* remote, so switching modes wipes the other mode's data (observed: flipping to the emulator blanked the seeded tree). Scope the Dexie DB name by sync target, or gate full-pull deletion behind a same-remote check.

## Features

1.) **Node metadata in TreeNodeDetails** — show `createdAt`, last `updatedAt`, last `updatedBy`.

2.) **Inline rename of NodeTitle and NodeSubtitle** — decide UX (double-tap like DataFields? edit button?), then wire up. Nodes are rename-less after creation.

3.) **DataField restoration UI** — surface soft-deleted fields (recycle bin? details view?) and allow clearing `deletedAt`. Data model supports it; UI doesn't.

## Architecture Migration (ELEMENT-MODEL → code)

The registry/manifest model is decided (SPECIFICATION.md → Data Model; per-kind specs in ELEMENT-MODEL.md). Each item below is a widening, not a rewrite. What already landed is recorded in IMPLEMENTATION.md, not here.

1.) **Per-viewer overlay merge in `effectiveChildren`** — the typed-trees seam is in; the remaining config/view-state overlay merge (incl. personal `siblingOrder`) is blocked on viewer/auth + the arbiter (#4). Detail parked in LATER.md → typed trees.

2.) **Chrome entailment — remaining regions** — rich lens rows (the per-job status/priority/owner "primary line"; waits on `Action`) and the manifest-driven shell regions (meta-field children → Details/Settings, grouping-tag → section header).

3.) **The rest of the catalogue (#6c)** — the `Edges` family (`other-end` / `approval` / `part-supplier-link`), `asset-gallery`, `person`, `logical-container`. Specs in ELEMENT-MODEL.md.

4.) **The cascade / arbiter** — `inherit-unless-override` honoring the config-sub-field `disposition` (owned / delegated / pinned), reading `ancestors/transitive`. The disposition vocabulary is already encoded on the schema; this wires it.

5.) **Copy-As-Template** — node-details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

6.) **Cross-ancestor rollup duplication (by design)** — the transitive gather shows one job in every ancestor's Jobs rollup. Not a bug; revisit with depth-scoping / de-dup if it bites (couples to the job-subtype question, #13).

7.) **`KindAdornment` re-gathers the whole subtree on every write** — a BFS over the parent's subtree per (debounced) `storageEventBus` emit, plus a `FieldList` subscription per expanded `NavigableRow` — O(subtree) per write. Fine at prototype scale; revisit if sluggish.

8.) **`NavigableRow` "peek" is read-only for adding but not editing** — `hideAddSurfaces` hides the add surfaces, but fields in the expanded `FieldList` stay double-tap-editable. Intentional; revisit if a truly inert preview is ever wanted.

9.) **Provisioned-lens lifecycle (jobs + logbook)** — provisioning is create-time only (`ensureProvisionedLenses`), leaving three gaps, generic across `PROVISIONED_LENSES`: backfill onto pre-existing nodes, de-provision/GC when the last target below is removed, and hiding an empty lens.

10.) **`capabilityEngine` `ancestors`/`edges` traversal** — only `children` is built; `ancestors` (feeds the cascade, #4) and `edges` (the Edges family, #3) currently throw in `capabilityEngine.ts`.

11.) **`asset-doc` real target picker + editing** — the target is a raw element-id paste; wants a picker constrained by an allowed-target-kind config, plus editing a saved link.

12.) **Field-composer restriction by `childrenSpec`** — the composer still offers all `FIELD_KINDS`; wire `allowedChildKinds ∩ FIELD_KINDS` if a kind ever narrows admitted fields. No-op today.

13.) **`job` admits `job` children (sub-tasks)?** — `job.allowedKinds` includes `job` but no picker mints a sub-job. Decide nested-jobs vs job-subtypes (Task/Work-Order/Project) — a `capabilities.ts` allowlist call, coupled to #3.

14.) **`node.allowedKinds` real allow-policy** — a provisional literal dodging a `registry`→`capabilities` cycle; derive the honest "child nodes + field kinds" policy.

15.) **Enforce manifest key === manifest `kind`** — nothing checks a manifest registered under `'text-kv'` declares `kind: 'text-kv'`; a typed-key helper would make a mismatch a compile error.

16.) **Per-kind `coherence` overrides** — the `coherence?(caps)` hook on `ManifestIdentity` is unused; add per-kind rules only when a kind needs one beyond the global set.

17.) **`stream` shape member + arrangement law** — named in the SPEC value-shape vocabulary but carries no arrangement law yet; joins `ValueShape` with its first consumer (e.g. a logbook feed).

## Tech Debt

1.) **`pendingMode` boilerplate across DataField components** — TextKv/EnumKv/NumberKv/SingleImage repeat near-identical `pendingMode` wiring into `useFieldEdit`. Don't abstract until a 5th component lands.

2.) **`useFieldEdit` size + 21-prop return** — 200+ lines, fat return surface. Revisit only if a component genuinely needs a different edit lifecycle.

3.) **Cypress: construction commit captures last keystroke** — needs a spec that types a field value, immediately clicks Create, and asserts the value persisted (the write-through flush timing can't be reproduced in a unit test).

4.) **`coerceTimestamps` only handles `updatedAt`/`deletedAt`** — a silent trap for any future timestamp column; a "coerce all `*At` keys" rule would be self-maintaining.

5.) **History revisions collide across clients** — `ElementHistory.id = ${elementId}:${rev}` with `rev` minted locally, so two offline clients editing the same element mint the same id and sync silently overwrites one audit row. Fix candidates: random ids ordered by `(elementId, updatedAt)`, or client-scoped rev.

6.) **`NavigableRow` chevron `aria-label` is generic** — "Expand"/"Collapse" with no row context; "Expand {name}" would be friendlier. Trivial.

7.) **Dead `currentValue` prop on `DataFieldDetails`** — computed and passed by `DataField.tsx` but never read. Drop it, or wire it into the metadata display.

8.) **Element-vocabulary leaf-prop name polish** — `NodeTitle`/`NodeSubtitle` take `nodeName`/`nodeSubtitle`; the composer's `currentMaxCardOrder` keeps the `cardOrder` name. Pure renames; do only if they bother someone.
