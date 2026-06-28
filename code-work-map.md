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
- Factor the hardcoded shell drawing into a renderer that reads the manifest: `re-root` → Up button, `open` → Add surface, meta-field children → Details/Settings region, grouping-tag → section header.
- Add the value-shape vocabulary (`scalar | block | stream | composite`) driving layout, so kinds pick a shape, never declare layout.

## 6. The capability engine + node-like kinds

The capability vocabulary now exists (cluster #2) but has **no consumers**. This cluster gives it the first ones: build the engine machinery once, then instantiate the **smallest set of kinds that each light up a distinct capability** — so the engine gets exercised and #5 inherits several *different* re-root shells to vary on (a manifest-driven shell is indistinguishable from the current hardcode while `node` is the only re-root kind). Each minimal kind ships a **stub renderer + rudimentary re-root UI** — enough to navigate into and see the capability working, not the finished UX.

### 6a. Capability engine (build-once machinery)
- Implement the `SourceSpec {relation, reach}` traversal once (children / ancestors / edges × direct / transitive) — the single gather every Derivation/Edges kind reads.
- Build the **lens** once (`Derivation(children/transitive)` gather + upward `ProvisionSpec` with deterministic id, so concurrent creates converge), instantiable by target kind.
- Build the **`Edges` resolver** behind the `TargetSpec` axes (scope internal/external × pin live/revision × appearance citation/portal) — start with internal/live.
- Surface node-kind choice in the "New Asset" / `usePendingForms` under-construction flow; keep `typeOf` → suggested-fields as one generic service.

### 6b. The minimal kind set (one per capability axis — already have OwnValue = fields, Children(open) = node)
- **`intrinsic-node-scalar`** — `Children + OwnValue` (flagged). re-root. Lights the flagged co-occurrence (exercises `coherence`'s warning path) + a node that bears a value. Cheapest new kind: node shell + an inline value display.
- **`org`** — `Children(open) + Derivation(children/transitive)`. re-root. First consumer of the `SourceSpec` traversal — the simplest aggregation (a descendant count), no Provision. Stub: node shell + a derived count badge.
- **`job`** — `Children(open) + lifecycle` (validated transitions; eventually `Action` + guard). re-root. Lights a lifecycle state machine (Open→Done). Stub: node shell + a status control. It is the trigger the `jobs` lens provisions against.
- **`jobs`** — `Derivation(children/transitive → job) + ProvisionSpec` (the lens). re-root. Lights the full lens (gather + upward provision). Stub: a flat derived list of every `job` below here.
- **`asset-doc`** — `Edges(internal, live) + Reads.resolver`. inline. Lights the Edges family minimally — a live-resolved link to another Element. Stub: an inline row resolving + showing the target's name.

This set covers Children+OwnValue (flag), Derivation/transitive, Provision, lifecycle, Edges(internal/live), and Reads.resolver — leaving only `Action` (built last) untouched. It also hands #5 five distinct re-root shells (`node` / `intrinsic-node-scalar` / `org` / `job` / `jobs`).

### 6c. The rest of the catalogue (after the minimal set proves the engine)
- `logbook` + `log-entry` — the lens's second instance (`Derivation(children/transitive → log-entry) + Provision`), proving it generalizes by target kind.
- The fuller **`Edges` family**: `other-end` (internal/virtual = the `virtualParents` overlay), `approval` (internal/revision + `ValiditySpec`), `part-supplier-link` (external). `asset-gallery` reuses `org`'s `children/transitive` traversal (Derivation, not Edges).
- `person`, curated `logical-container` (`Edges(members, multi)`), `saved view` (view-state overlay).

## 7. The cascade / arbiter
- Implement `inherit-unless-override` (one arbiter, three jobs: business-value inheritance, Definition specificity, app→org→user config) reading `ancestors/transitive`.
- Definition lifecycle: **fork-not-mutate**, copy-at-mint, `fieldDefinitionId`-is-the-version (no `componentVersion`, no migration runner).

## 8. Smaller decided items riding along
- `image` + `image-with-caption` replacing the `single-image` composite (caption becomes a sibling `text-kv`; fixes per-sub-value history + the reference-equality no-op/revert bugs for free). Needs the sub-field seam from #3/#6.
- Copy-As-Template (node-details affordance; skeleton-only clone — structure + seed values, never history/readings/memberships; org-scoped).

---

**Sequencing instinct:** 1 → 2 → 3 are the spine and unlock everything (done; #2's capability seam landed 2026-06-28); 4's seam is in. **#5 is gated behind #6's minimal kind set** — a manifest-driven shell has nothing to vary on until several re-root kinds exist, so the build order is #6a/#6b → #5, not the map's numeric order. 6/7 are the big new-capability build and the natural place to slice into per-kind plans; 8 falls out of 3/6. Open design questions (ProvisionSpec triggers, aggregation materialization, person/org sub-specs, arbiter classification) are flagged in ELEMENT-MODEL.md and worth resolving before building 6/7.

One caveat worth a sanity check before you plan: I'm describing the migration touch-points as the docs frame them — actual file names/seams (`src/kinds/`, the `ConfigForm`s, `usePendingForms`) should be confirmed against the current tree when you write the real plan, since I haven't re-read the code this session.
