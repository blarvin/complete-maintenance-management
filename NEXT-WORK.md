Here's the code work the docs now imply, grouped and roughly in dependency order. This is a map, not a plan â each cluster is probably its own plan later.

1. Collapse componentType â kind (the foundational rename)

- Flatten the two-tier Kind = "node" | ComponentType into a single registry-derived Kind union; rename componentType â kind across registry.ts, the four *.manifest.ts, the KindManifest type, FieldDefinition, and the DataField dispatcher.
- Derive the Kind and Value unions from KIND_REGISTRY (so a missi error).
- Mostly mechanical 1:1 rename - nothing reuses a componentType across kinds; each manifest already owns its component code. Do this first; everything else sits on it.

2. Widen the registry to all kinds (incl. node)

- Widen KIND_REGISTRY to Record<Kind, KindManifest>; admit node astops being framework-rendered-outside-the-registry.
- Add manifest fields: placement: "inline" | "re-root", mintVia, the six capability descriptors (ownValue/children/edges/derivation/action/reads), and node descriptors (provision, container, SourceSpec {relation, reach}).
- Generalize FieldRendererProps â placement-keyed RendererProps.
- Add coherence(caps) per manifest (reject incoherent capability subsets).

3. Config-as-Elements (retire the config blob)

- Retire FieldDefinition.config; a Definition becomes a library-tree Element whose config is its child sub-field subtree.
- The four ConfigForms become Definition-authoring over config suross-field-invariant / progressive-disclosure overrides, e.g.number-kv).
- Move validateNumberKvConfig onto the threshold compound sub-field's validate.
- seedFieldDefinitions writes Definition subtrees with stable dete FIELD_DEFINITION_IDS a manifest/Definition home.
- Implement the disposition logic (owned-at-mint copy vs delegated live-read) + pin, honored by the cascade arbiter.
- Renderer reads sub-fields as reactive signals (no persisted derived config snapshot).

4. Typed trees (treeType)

- Introduce the treeType axis (business / library / config / view by it.
- Route sync / history / visibility by tree (view-state never syncs; config shared-or-per-user).
- Add the effectiveChildren(node, viewer) read-time chokepoint for per-viewer config/view-state overlays (incl. personal siblingOrder).
- This subsumes the old "Tree Partitioning / treeID" plan â each n parentId: null Element.

5. Chrome entailment

- Factor the hardcoded shell drawing into a renderer that reads the manifest: re-root .. Up button, open .. Add surface, meta-field children .. Details/Settings region, grouping-tag .. section header.
- Add the value-shape vocabulary (scalar | block | stream | compos pick a shape, never declare layout.

6. The capability engine + node-like kinds

- Implement the SourceSpec {relation, reach} traversal once (children / ancestors / edges Ã direct / transitive).
- Build the lens once (Derivation(children/transitive) gather + upward ProvisionSpec with deterministic id), then instantiate for jobs and logbook by target
kind.
- Build the Edges family behind the TargetSpec axes: asset-doc (internal/live), part-supplier-link (external), other-end (internal/virtual = the virtualParents overlay), approval (internal/revision + ValiditySpec). asset-gallery reuses the same children/transitive traversal (Derivation, not Edges).
- Then job/log-entry (lifecycle state machine), org, person, cura
- Surface node-kind choice in the "New Asset" / usePendingForms under-construction flow; keep typeOf .. suggested-fields as one generic service.

7. The cascade / arbiter

- Implement inherit-unless-override (one arbiter, three jobs: business-value inheritance, Definition specificity, appâorgâuser config) reading ancestors/transitive.
- Definition lifecycle: fork-not-mutate, copy-at-mint, fieldDefinitionId-is-the-version (no componentVersion, no migration runner).

8. Smaller decided items riding along

- image + image-with-caption replacing the single-image composite (caption becomes a sibling text-kv; fixes per-sub-value history + the reference-equality no-op/revert bugs for free). Needs the sub-field seam from #3/#6.
- Copy-As-Template (node-details affordance; skeleton-only clone ver history/readings/memberships; org-scoped).

---
Sequencing instinct: 1 .. 2 .. 3 are the spine and unlock everythinh and can interleave; 6/7 are the big new-capability build and the natural place to slice into per-kind plans; 8 falls out of 3/6. Open design questions (ProvisionSpec triggers, aggregation materialization, person/org sub-specs, arbiter classification) are flagged in ELEMENT-MODEL.md and worth resolving before building 6/7.

One caveat worth a sanity check before you plan: I'm describing tthe docs frame them - actual file names/seams (src/kinds/, theConfigForms, usePendingForms) should be confirmed against the current tree when you write the real plan, since I haven't re-read the code this session.