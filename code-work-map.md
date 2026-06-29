Here's the code work the docs now imply, grouped and roughly in dependency order. This is a map, not a plan — each cluster is probably its own plan later.

## 1. Collapse `componentType` → `kind` (the foundational rename)
> **✅ Done** (commit 8fc15ed).
- Flatten the two-tier `Kind = "node" | ComponentType` into a single registry-derived `Kind` union; rename `componentType` → `kind` across `registry.ts`, the four `*.manifest.ts`, the `KindManifest` type, `FieldDefinition`, and the `DataField` dispatcher.
- Derive the `Kind` and `Value` unions **from** `KIND_REGISTRY` (so a missing/mistyped kind is a compile error).
- Mostly mechanical 1:1 rename — nothing reuses a componentType across kinds; each manifest already owns its component code. Do this first; everything else sits on it.

## 2. Widen the registry to all kinds (incl. `node`)
> **◐ Seam done** (2026-06-27, *structural seam only* scope): `node` registered (`node.manifest.ts`); `KindManifest` is now a `placement`-discriminated union (`InlineManifest | ReRootManifest`); `mintVia` + `placement` added; `Kind` collapsed to `keyof typeof KIND_REGISTRY`; `getKindManifest`'s cast dropped; `getInlineManifest` seam for the field-only consumers; `FIELD_KINDS` derived by placement.
> **Capability seam done** (2026-06-28): the **six capability descriptors** (`ownValue`/`children`/`edges`/`derivation`/`action`/`reads`), the node descriptors (`provision`/`container` + `SourceSpec`/`TargetSpec`/`ProvisionSpec`), and `coherence(caps)` now exist as types on a shared `CapabilitySet` (intersected into `ManifestIdentity`), populated per kind via the **component-free** `KIND_CAPABILITIES` map (`src/kinds/capabilities.ts`) that each manifest spreads, with `checkCoherence` (`coherence.ts`) given teeth by a registry-wide test (`kindCoherence.test.ts`). **Structural seam only** — no consumer reads a capability yet (the lens / node-like kinds #6 are the first readers; the cascade arbiter #7 the second). `ActionSpec`/`ArbiterSpec`/`ValiditySpec` are minimal placeholders pending #6/#7. **Still deferred:** the `RendererProps` generalization — lands with #5, where the node view Renderer consumes it.
- Widen `KIND_REGISTRY` to `Record<Kind, KindManifest>`; admit `node` and the node-like kinds. `node` stops being framework-rendered-outside-the-registry.
- Add manifest fields: `placement: "inline" | "re-root"`, `mintVia`, the six capability descriptors (`ownValue`/`children`/`edges`/`derivation`/`action`/`reads`), and node descriptors (`provision`, `container`, `SourceSpec {relation, reach}`).
- Generalize `FieldRendererProps` → placement-keyed `RendererProps`.
- Add `coherence(caps)` per manifest (reject incoherent capability subsets).

## 3. Config-as-Elements (retire the config blob)
- Retire `FieldDefinition.config`; a Definition becomes a **`library`-tree Element** whose config is its child sub-field subtree.
- The four `ConfigForm`s become Definition-authoring over config sub-field kinds (kept only as cross-field-invariant / progressive-disclosure overrides, e.g. `number-kv`).
- Move `validateNumberKvConfig` onto the threshold **compound** sub-field's `validate`.
- `seedFieldDefinitions` writes Definition subtrees with stable deterministic sub-field ids; give `FIELD_DEFINITION_IDS` a manifest/Definition home.
- Implement the **disposition** logic (owned-at-mint copy vs delegated live-read) + `pin`, honored by the cascade arbiter.
- Renderer reads sub-fields as reactive signals (no persisted derived config snapshot).

## 4. Typed trees (`treeType`)
- Introduce the `treeType` axis (`business` / `library` / `config` / `view-state`) on the Element; index by it.
- Route sync / history / visibility by tree (`view-state` never syncs; `config` shared-or-per-user).
- Add the `effectiveChildren(node, viewer)` read-time chokepoint for per-viewer `config`/`view-state` overlays (incl. personal `siblingOrder`).
- This subsumes the old "Tree Partitioning / treeID" plan — each tree is just rooted at its own `parentId: null` Element.

## 5. Chrome entailment
> **◐ Slices 1–2 done** (2026-06-29): slice 1 — the create surface + shell read `childrenSpec` (`childrenPolicy.ts` `allowedChildKinds`/`canHaveChildren` + `reRootCreateKindsFor` in registry); the node-create picker offers only admitted kinds (`job`→node/job, lens→none) and the lens-aware shell drops the DataCard/chevron for content-free kinds (IMPLEMENTATION.md → *#5 slice 1*). **Slice 2** — the lens rollup renders each gathered child as a generic `NavigableRow` (name re-roots via `navigateToNode$`, chevron expands a `FieldList` peek with `hideAddSurfaces`), retiring the dead-text list; render-location-inline + navigability gets its first consumer, generic so `logbook` (#6c) inherits it (IMPLEMENTATION.md → *#5 slice 2*). **Remaining:** the *container half* of the render-location decouple (inline Data-Card-row jobs still re-rootable, driven by `childrenSpec`) + the value-shape vocabulary below.
- Factor the hardcoded shell drawing into a renderer that reads the manifest: `re-root` → Up button, `open` → Add surface, meta-field children → Details/Settings region, grouping-tag → section header.
- Add the value-shape vocabulary (`scalar | block | stream | composite`) driving layout, so kinds pick a shape, never declare layout.
- **Decouple placement's two axes.** Today `placement: inline | re-root` conflates *render-location* (Data-Card row vs re-rooted view) with *navigability*. Three halves: the create-surface half (restrict/hide by `childrenSpec`) shipped in **slice 1**; the rollup render-location-inline + navigability half shipped in **slice 2** (the `NavigableRow` rows). **Remaining — the container half:** each `job` an inline Data-Card row of the `jobs` container that is *still* re-rootable, render-location driven by the container's `childrenSpec`, independent of navigability. Forced next by the `jobs`-as-container / "create a job *inside* Jobs" ask (ISSUES Features #1).
- **✅ Slice 2 — jobs-as-navigable-field-rows: the render-location decoupling's first real consumer (done 2026-06-29).** Shipped as a generic `NavigableRow` (`src/components/NavigableRow/`) the lens hands its gathered children: name re-roots via `navigateToNode$`, chevron expands the child's `FieldList` peek (`hideAddSurfaces`); wired in `KindAdornment`'s `isLens && isParent` branch with no `kind === 'job'` check, so `logbook` (#6c) inherits it. `render-location: inline + navigability: yes` made concrete by pure recomposition (borrow the field-row skin, not the value-editing-welded `DataField`). See IMPLEMENTATION.md → *#5 slice 2*. Deferred: a job row's *primary* line/history (the status/lifecycle line once `Action` lands).

## 6. The capability engine + node-like kinds

The capability vocabulary now exists (cluster #2) but has **no consumers**. This cluster gives it the first ones: build the engine machinery once, then instantiate the **smallest set of kinds that each light up a distinct capability** — so the engine gets exercised and #5 inherits several *different* re-root shells to vary on (a manifest-driven shell is indistinguishable from the current hardcode while `node` is the only re-root kind). Each minimal kind ships a **stub renderer + rudimentary re-root UI** — enough to navigate into and see the capability working, not the finished UX.

### 6a. Capability engine (build-once machinery)
- Implement the `SourceSpec {relation, reach}` traversal once (children / ancestors / edges × direct / transitive) — the single gather every Derivation/Edges kind reads.
- Build the **lens** once (`Derivation(children/transitive)` gather + upward `ProvisionSpec` with deterministic id, so concurrent creates converge), instantiable by target kind.
- Build the **`Edges` resolver** behind the `TargetSpec` axes (scope internal/external × pin live/revision × appearance citation/portal) — start with internal/live.
- Surface node-kind choice in the "New Asset" / `usePendingForms` under-construction flow; keep `typeOf` → suggested-fields as one generic service.

### 6b. The minimal kind set (one per capability axis — already have OwnValue = fields, Children(open) = node)
> **✅ Built** (2026-06-28, stub-grade): the four kinds + the rudimentary §6a engine (`src/data/services/capabilityEngine.ts` — `gatherDescendants`/`gatherBySource`/`resolveEdge`, children-relation only) + `placement.ts` (component-free `isReRoot`/`isInline`, retiring the five hardcoded `kind === 'node'` checks). Re-root kinds reuse the node shell; `KindAdornment` (in the node-header subtitle slot) is the first consumer that *draws* from a capability.
- **`org`** — `Children(open) + Derivation(children/transitive)`. re-root. First consumer of the descendant traversal — a descendant-node count, no Provision. ✅
- **`job`** — `Children(open)`. re-root. A layered task node; status/priority/owner/due-dates are ordinary **Fields**, not an OwnValue (so no `Children+OwnValue` flag). It earns its kind as the **trigger** the `jobs` lens provisions against — behaviour keyed on the kind (the §584-585 boundary call). First-class lifecycle waits on `Action` (built last). ✅
- **`jobs`** — `Derivation(children/transitive → job) + ProvisionSpec` (the lens). re-root. **v1 = a `jobs` lens child on every node** (deterministic `${id}::jobs`, each gathering its own subtree) — a **pure rollup**, not the canonical upward ancestor-walk. **Decision (2026-06-28): pure rollup for now**; `logbook` will be both lens+container, and job-subtypes (Task/Work Order/Project) may later need both — deferred (LATER.md). ✅
- **`asset-doc`** — `Edges(internal, live) + Reads.resolver`. inline. A live-resolved link to another Element (value = target id, resolved to its name). ✅

This set covers Derivation/transitive, Provision, Edges(internal/live), and Reads.resolver — leaving `Action`/lifecycle (built last), the flagged `Children+OwnValue` co-occurrence (`intrinsic-node-scalar`, parked), and the **inline-yet-navigable placement** (jobs/job as Data-Card rows you can still re-root into — see #5) untouched. It hands #5 four distinct re-root shells (`node` / `org` / `job` / `jobs`).

### 6c. The rest of the catalogue (after the minimal set proves the engine)
- `logbook` + `log-entry` — the lens's second instance (`Derivation(children/transitive → log-entry) + Provision`), proving it generalizes by target kind. Also the **first re-root kind that's both rollup *and* container** with authored-in config → it forces the `fieldDefinitionId` → `definitionId` rename + Definition-seam decoupling (see #7).
- The fuller **`Edges` family**: `other-end` (internal/virtual = the `virtualParents` overlay), `approval` (internal/revision + `ValiditySpec`), `part-supplier-link` (external). `asset-gallery` reuses `org`'s `children/transitive` traversal (Derivation, not Edges).
- `person`, curated `logical-container` (`Edges(members, multi)`), `saved view` (view-state overlay).

## 7. The cascade / arbiter
- Implement `inherit-unless-override` (one arbiter, three jobs: business-value inheritance, Definition specificity, app→org→user config) reading `ancestors/transitive`.
- Definition lifecycle: **fork-not-mutate**, copy-at-mint, `fieldDefinitionId`-is-the-version (no `componentVersion`, no migration runner).
- **`fieldDefinitionId` → `definitionId` (the binding seam — intermediate step, *not* the Edge migration).** Three coupled, low-cost moves: (a) **rename** `fieldDefinitionId` → `definitionId` — same library-tree mechanism, un-field-specific, so a *policy-container* re-root kind binds config through the identical seam its field cousins use; (b) **decouple the Definition authoring contract from `placement: inline`** — today the hooks (`ConfigForm` / `defaultConfig` / `displayPreview`) sit only on the inline branch of the `KindManifest` union and the null-rule lives in `models.ts`; lift them into a placement-agnostic contract (those two spots are the *only* places the inline-coupling is written down — Config-as-Elements, the library tree, and the disposition vocab are already placement-blind); (c) **decide per kind where the bound Definition lives** — shared container vocabulary → **library** tree (the true FieldDefinition parallel); per-org policy (staleness/PMO) → **config** tree, resolved by the #4 arbiter (the seam is identical, only resolution differs). Keep the column now and make the create-time check **placement-driven**: inline *requires* a Definition, re-root *doesn't require — yet* ("not yet," not "can't carry"). Re-root splits in two: **leaf re-root** (`node`, asset-like `job`) genuinely has no Definition (reuse = Copy-As-Template #8, null binding correct); **policy-container re-root** (`jobs` / `logbook` / later `org`) wants one (child label, staleness, priority scheme, PMO format). **Forced first by `logbook` (#6c)** — first re-root kind that's both rollup *and* container, hence first with authored-in config — or `org`; decide it on that concrete kind, not in the abstract. End state (#6c/#7): model the binding as an internal, revision-pinned Edge (the `asset-doc` machinery).

## 8. Smaller decided items riding along
- `image` + `image-with-caption` replacing the `single-image` composite (caption becomes a sibling `text-kv`; fixes per-sub-value history + the reference-equality no-op/revert bugs for free). Needs the sub-field seam from #3/#6.
- Copy-As-Template (node-details affordance; skeleton-only clone — structure + seed values, never history/readings/memberships; org-scoped).

---

**Sequencing instinct:** 1 → 2 → 3 are the spine and unlock everything (done; #2's capability seam landed 2026-06-28); 4's seam is in. **#6a/#6b are built** (2026-06-28, stub-grade) and **#5 slices 1–2 shipped** (2026-06-29). **Next:** the §5 *container half* — `jobs`-as-container / "create a job inside Jobs" (ISSUES Features #1) — or jump to **#6c (`logbook`)**, the forcing kind for the both-rollup-and-container shape; deciding the container model on `logbook` vs prototyping it on `jobs` first is the open call. 6/7 are the big new-capability build and the natural place to slice into per-kind plans; 8 falls out of 3/6. Open design questions (ProvisionSpec triggers, aggregation materialization, person/org sub-specs, arbiter classification) are flagged in ELEMENT-MODEL.md and worth resolving before building 6/7.

Caveat for the unbuilt clusters (6c onward): file names/seams (`src/kinds/`, the `ConfigForm`s, `usePendingForms`) are framed as the docs describe them — confirm against the current tree when writing the real plan. (The §5 area was re-read and confirmed 2026-06-29.)
