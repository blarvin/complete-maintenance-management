# ELEMENT-MODEL.md (v3) — One Substrate, One `kind`, One Registry

***Intent:*** *one recursive record underlies everything the app stores. Every record carries a single discriminant, `kind`; all type-specific behaviour lives in that kind's manifest, never on the record. **One `kind` and one registry span node-like and field-like Elements alike — a spectrum, not two systems.** Kinds, node-like and field-like, earn the registry the same way: by composing a closed vocabulary of capabilities and descriptors. Config is just more records; chrome is entailed by the manifest and never stored.*

> **Status: working model.** Supersedes v1–v2 and the kind-catalogue framing of KINDS-SPECS. Read `SPECIFICATION.md → Concepts & Vocabulary` for surface↔storage vocabulary; this doc uses storage words (`Element`, `kind`, `manifest`, `Renderer`).

---

## 0. Invariants

1. **One substrate.** Every stored thing is an `Element` — inert, serializable data. A field, a node, a config knob, an alert channel, a saved view, the Library: all Elements.
2. **One discriminant.** Every Element carries exactly one `kind` (a bare string). `kind` is immutable, and it is the *only* hard discriminant in the system. Identity, typology, and targeting all key on it.
3. **Behaviour is not data.** All kind-specific logic lives in a module-level **manifest** keyed by `kind`, never serialized onto an Element (Qwik cannot serialize methods — a framework fact). The manifest is looked up at runtime.
4. **One vocabulary.** Every kind — node-like or field-like — is composed from the same closed set of capabilities (§2) and their descriptors (§3). Node-like and field-like are *regions of that composition space plus a placement*, not separate mechanisms.
5. **Config is Elements; chrome is not.** A thing the user *shapes* (a threshold, a channel, a label, a view) is an Element. A control that *renders or triggers* (Up button, chevron, Add surface, breadcrumb, section header) is **entailed by the manifest** and drawn by the renderer — never stored. The entailment is one-way: manifest → chrome.
6. **Recursion bounded both ends.** Downward (config-of-config) terminates at ⊥ — each level's config kind strictly smaller, until one declares none. Upward (field → node → branch) terminates at the tree root (`parentId: null`). Data turtles run ⊥→root; **behaviour does not turtle** — the manifest registry stays flat. The down-floor is ⊥; the up-wall is the behaviour layer.

---

## 1. The Element

The single recursive record. Phase-1 columns:

| Field               | Type            | Notes                                                              |
| ------------------- | --------------- | ------------------------------------------------------------------ |
| `id`                | UUID            | client-minted, canonical                                           |
| `kind`              | string          | immutable dispatch discriminant into the registry                  |
| `name`              | string          | required identity (Title / Label); permanent column                |
| `subtitle`          | string \| null  | node-only soft label (demotion candidate)                          |
| `value`             | JSON \| null    | shape discriminated by `kind`; `null` for pure containers          |
| `parentId`          | string \| null  | canonical ("home") parent; `null` = a tree root                    |
| `siblingOrder`      | number          | order among canonical siblings; integer, renumber-the-run on insert |
| `fieldDefinitionId` | UUID \| null    | set when minted from a Library Definition (field-like only)        |
| `updatedBy`         | string          | editor id                                                          |
| `updatedAt`         | epoch           | LWW key                                                            |
| `deletedAt`         | epoch \| null   | soft delete (tombstone)                                            |

The **origin** is the empty capability set: a bare titled row. Every kind is the origin displaced by a subset of §2. `name` and `siblingOrder` are permanent columns — identity and order are uniform across kinds and on the hot path; a feature that would force them into child Elements is, by that fact, chrome or derived state, not an Element.

---

## 2. The closed capability vocabulary (six)

Closed to modification, open to extension (Open/Closed): a new **kind** is cheap (a manifest recomposing these); a new **capability** is a deliberate framework change, warranted only by a sync, read, compute, or write path none of the six has.

| Capability    | Descriptor (§3)               | Consumer(s)                              | Sync contract                                                      |
| ------------- | ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| **OwnValue**  | `ValueSpec`                   | sync, history, value renderer            | LWW `value` by `updatedAt`                                        |
| **Children**  | `ChildrenSpec`                | atomic-create, tree, child-render pass   | parent has no own value to LWW; each child LWW'd independently     |
| **Edges**     | `TargetSpec`                  | edge-LWW, resolver, link renderer        | LWW the edge only; target content untouched                       |
| **Derivation**| `SourceSpec`                  | compute path                             | never stored, never synced, never in history                      |
| **Action**    | `ActionSpec`                  | command bus (the only write/effect path) | emits commands; stores no value; effects are ordinary mutations   |
| **Reads**     | `{ resolver?, historyStream? }` | renderer (injected, read-only)         | none — pure read                                                  |

- **Children** carries `mode: template` (fixed core) `| open` (user-grown), or both. `open` is always **type-constrained** — `open(allowlist)`, never `open(any)` — via `ChildrenSpec.allowedKinds` + `validateChild`.
- **Action** is the only imperative capability; everything else is declarative, convergent, offline-safe. Action is non-idempotent under replay → needs `idempotencyKey` + `confirm`. Built last; likely never user-authorable.

A kind is `origin + subset`. Field-like kinds lean on **OwnValue**; node-like kinds lean on **Children / Edges / Derivation**. The vocabulary is identical; only the emphasis and `placement` differ.

---

## 3. Descriptors — including the node-oriented ones

Descriptors parameterize the capabilities. The same closed set serves node-like and field-like kinds; node behaviours are *compositions of these*, not new primitives.

- **`ValueSpec`** — value shape, validation, renderer input. (Field-like core.)
- **`ChildrenSpec`** — `{ mode, allowedKinds, cardinality, validateChild, onCreate }`. `cardinality` defaults to `'one'` per child kind; repeatable data is one list-valued child, not repeated rows. `onCreate` provisions an atomic multi-Element draft at mint, and per sub-field may **pre-fill a copied value** (owned — instance forks the Definition) or **leave it absent** (delegated — instance reads the Definition live via §7).
- **`TargetSpec`** — edge target constraints (`allowedKinds`), internal/external, virtual/revision.
- **`SourceSpec`** — what a Derivation reads, as two orthogonal fields plus an optional kind filter: **`relation`** (`children` = down through containment · `ancestors` = up the parent chain · `edges` = out through links) and **`reach`** (`direct` = one hop · `transitive` = all the way), matched to a target kind where it gathers like-kind Elements. Written `relation/reach`: `children/transitive` is a subtree rollup (and, provisioned at each ancestor, the gather behind a **lens** — §10), `children/direct` a direct-child rollup, `edges/direct` is curated membership, `ancestors/transitive` is inheritance (nearest-first). The grid is complete; `edges/transitive` (following references transitively) is available though no current kind needs it. One `SourceSpec`, ≥1 consumer (a rollup value, a chart, a derived child set); the `compute` hook reduces the candidate set. A Derivation that would read only itself is not a scope — it is the renderer (own data) or `Reads.historyStream` (own value over time).
- **`ProvisionSpec`** — declarative, idempotent, **framework-reconciled** materialization: `{ trigger, target, idScheme }`. Its whole remit: ensure **exactly one node exists at each target place**, keyed by a deterministic id, so concurrent creates converge on one (never duplicates). The trigger is a target Element appearing in scope (a lens provisions a copy of itself at each ancestor; `onCreate` is the degenerate case, `trigger: self-creation`). This is **not** `Action` — it is declarative and convergent, never imperative.
- **`container`** — `physical` (membership via `Children`/`parentId`, single home, cascade-delete) `| logical` (membership via `Edges`, many, resolved, no cascade). A descriptor, not a capability: it selects *which* of Children/Edges expresses “what is in me.”
- **`ArbiterSpec`** — resolves a contending capability pair (§5).

The point: **aggregation = Derivation reading `children/transitive`; a lens = that gather provisioned upward at every level (§10); inheritance = Derivation reading `ancestors/transitive`; auto-provisioning = Derivation + ProvisionSpec; membership-mode = container; lifecycle = constrained Action or validated OwnValue.** Node behaviour decomposes entirely into the six plus these descriptors, exactly as field behaviour does.

---

## 4. Kinds are manifests

A kind is **a name + a capability subset + descriptors + hooks**, one module-level manifest. The manifest is the entire plug-in seam, identical in shape for node-like and field-like kinds.

```ts
type KindManifest = {
  // identity
  kind: Kind;
  pickerLabel: string;
  mintVia: 'composer' | 'node-create';   // which create affordance offers this kind
  placement: 'inline' | 're-root';        // where this kind draws ITS surface (≠ navigability)
  Renderer: Component<RendererProps>;      // placement-keyed (inline row | re-root view)

  // capabilities — each optional; absence = origin in that axis
  ownValue?: ValueSpec;
  children?: { spec: ChildrenSpec; validateChild?: (c: Element) => boolean; onCreate?: (parentId: ID) => ElementDraft[] };
  edges?: { target: TargetSpec; validateTarget?: (c: Element) => boolean };
  derivation?: { source: SourceSpec; compute?: (r: ElementResolver, root: ID) => Promise<Value | null> };
  action?: { spec: ActionSpec; run?: (el: Element, bus: CommandBus, r: ElementResolver) => Promise<void> };

  // node-oriented descriptors (ride on the six; not new capabilities)
  provision?: ProvisionSpec;              // declarative, framework-reconciled (§3)
  container?: 'physical' | 'logical';

  // cross-capability + meta
  arbiter?: ArbiterSpec;
  coherence?: (caps: CapabilitySet) => Result<void, string[]>;
  reads?: { resolver?: boolean; historyStream?: boolean };
  lazy?: boolean;
};
```

`Kind` and `Value` derive from the registry, not hand-maintained — a missing/mistyped kind is a compile error.

```ts
export const KIND_REGISTRY = {
  // field-like
  'text-kv': …, 'enum-kv': …, 'number-kv': …, image: …, 'image-with-caption': …,
  'asset-doc': …, 'value-chart': …,
  // node-like
  node, logbook, 'log-entry': …, job, jobs, org, person, 'logical-container': …,
} satisfies Record<Kind, KindManifest>;
```

`node` registers like any other kind (`{Children(open)}`); its recursion and navigation are framework-owned via the shell (§8), not a kind privilege. **There is no privileged kind** — only the privileged *shell* and *root position* (`parentId: null`). The node-like / field-like distinction is `placement` plus capability emphasis; no naming ceremony is required (a `_node`/`_field` suffix convention is available if disambiguation is ever wanted, but `placement` already carries it).

### Adding a kind (the only place the framework learns of it)

1. Add to the registry source of truth (the `Kind` union derives from it).
2. Drop `src/kinds/<kind>.manifest.ts` declaring its subset + descriptors.
3. Implement `Renderer` (resolver-aware iff `reads.resolver`); supply a `ConfigForm` only if config can't be expressed as child Elements (§6 — it is an override, not a default).
4. `coherence()` must accept the set; the `satisfies Record<Kind, …>` check passes.

---

## 5. Earning a kind

A kind exists **iff it composes non-trivial behaviour from §2/§3** — and the rule is identical for node-like and field-like kinds.

- **Behaviour-bearing → kind.** `number-kv` composes `OwnValue`(+thresholds); `jobs` composes `Derivation(children/transitive) + ProvisionSpec` (the lens); `logbook` is the same lens aimed at `log-entry`. These earn the registry.
- **Behaviour-free label → not a kind.** `pump`, `vessel`, `fuse`, `relay` compose nothing — they are `typeOf` *tags* (soft data) on `node`, and ship as seed data (§10). A capability-empty kind that is neither the base `node` nor justified by composed behaviour is the **degeneration anti-pattern** (a domain label masquerading as code); it is CI-lintable.
- **Targeting alone does not earn a kind.** Being an `Edges` *target* is a use of a kind, not a behaviour it composes. A concept that is *only* "a thing to point at" stays a `typeOf` tag. `person` is a kind because it composes real behaviour (§10) — targeting is then a bonus that `kind`'s hardness provides, not the justification.

So: **the registry holds composed behaviour; `typeOf` holds the open domain typology.** Users mint *instances* and coin *`typeOf` tags* (both unbounded data); they never author kinds — exactly as for field-like kinds. `kind` being immutable means reclassifying an instance's *domain label* is a `typeOf` edit; changing a node's *behavioural kind* is rare and destructive (delete-and-recreate), which is correct, because it is a change of behaviour, not of label.

The **three asterisks** (where capabilities aren't orthogonal):

- **Arbitration.** A contending pair belongs to neither member. Live case: `OwnValue + Derivation` = *inherit-unless-override* (§7) — value present ⇒ OwnValue (LWW'd); absent ⇒ Derivation (recomputed). The sync rule flips with state, so a static descriptor can't hold it; `arbiter` is required.
- **Validity.** Not all 2ⁿ subsets cohere. `coherence(caps)` is manifest code; a failing set doesn't register. Seeds: `OwnValue+Derivation` without `arbiter` → invalid; `Derivation+historyStream` → invalid (nothing stored); `Children+OwnValue` → valid, flagged (intrinsic node scalar — knowingly allowed for cheap rollup).
- **Identity & targeting.** `kind` is the one hard, immutable discriminant, so it doubles as the reliable target/identity/match key — an assignment edge resolves to a `person` *by kind*, and a lens matches its target *by kind* (§10), never by a soft tag. This identity role spans both populations: node-like and field-like Elements are identified and matched the same way, which is why no separate classifier column is needed. Capability composition can't tell a person from a pump; `kind` does, and that separation is the point. (`pickerLabel`, `mintVia` are presentation metadata on a kind.)

---

## 6. Config is Elements (turtles down)

A field's secondary values — units, quantity-kind, affix, decimals, ranges, alert points, channels, staleness threshold, colour, source link, author guidance — are **child Elements** (sub-fields / meta-fields), each minted from its own kind, editable, history-tracked, LWW'd. **There is no `config` blob.** `FieldDefinition.config` is retired: a Definition lives as an Element in the `library` tree (§9), and its config *is* its child subtree. Config thereby becomes business-grade data — synced, history-tracked, revertible — authored through the same layered progressive-disclosure UI as any field.

**The only object-valued residue is the compound sub-field.** Config is a *subtree whose leaves are sub-field Elements*; a leaf's `value` may be a scalar (`units: "m"`) or a small **atomic compound** (`thresholds: {LL,L,H,HH}`) where co-varying values must move together (see *Granularity*). The compound's value is one LWW'd JSON object — a blob *in the small*, never the source of truth for the whole config. It is the one place an object-valued config survives, and it survives by necessity (atomicity), not by default.

**Most config sub-fields reuse existing field-like kinds.** A units sub-field is an `enum-kv` (options fixed by quantity-kind); decimals/staleness are `number-kv`; multiline/requireCaption are flags. Only the few co-varying clusters (thresholds) want a new compound kind. So a kind's **config schema** — *which* knobs exist, their admissible kinds, their invariants — is just that kind's `ChildrenSpec` over config sub-field kinds (template core + open tail), not a separate typed blob. `ValueSpec` carries only the *own* value; it no longer holds a config schema.

**Locking — three mechanisms, no new primitive.** Some config must not be freely edited, and the model already carries the locks, hardest to softest:

1. **`kind`-immutability.** Semantic identity. A "Depth" field's **quantity-kind** is *length* — not a value you could mistype into *mass*, but a different *kind* of thing. Encode it as the kind of the units sub-field (`length-unit`, options {m, ft, in}); invariant 2 makes it structurally unchangeable, and "= mass" is simply not in that kind's vocabulary. The lock is free.
2. **`template` presence-lock.** The fixed config core (units must exist on a `number-kv`) is the kind's `ChildrenSpec.template` — minted by `onCreate`, not user-removable.
3. **Cascade `pin`.** A Definition author may **pin** an otherwise-open sub-field so instances cannot override it — one value shared across every instance, for governance/comparability. A pin is authored data (a terminating boolean) honored by the §7 arbiter, not a capability.

**Disposition — owned · delegated · pinned — is one arbiter (§7), set per sub-field.** Whether a sub-field's value is copied at mint or read live is `onCreate`'s choice, and all three are branches of inherit-unless-override:

- **owned** — `onCreate` pre-fills the instance's own child with the Definition's value; the instance owns it, and editing the Definition does **not** propagate. Use for *meaning-defining* config (units, thresholds), where "edit is fork" (§7) must hold.
- **delegated** — `onCreate` leaves the child absent; the instance reads the Definition live; Definition edits propagate; an instance override shadows. Use for *cascade / specificity* config (criticality, rated pressure).
- **pinned** — delegated with override disabled; always reads the Definition.

**Add/remove/edit at any level.** Open sub-fields are user-grown: a `number-kv` ships thin, a user later adds a `valid-until` sub-field, another edits its value. Presence and value both carry history in whatever population the Element lives in. Presence cascades like value (§7): an instance tombstone shadows an inherited sub-field. Only `kind` is structurally unoverridable; everything else is reachable through template/open, disposition, and pin.

**Admissibility and cardinality.** Two orthogonal axes: the *admissible menu* (which child kinds may attach — a manifest `allowedKinds`, fixed) and the *present population* (which are on this Element — sparse, user-grown; absent = no row, no null slots). The menu being fixed makes sub-fields meaningful; the population being free keeps kinds alive. Each sub-field kind defaults to `cardinality: 'one'`; repeatable data is one list-valued sub-field.

**Renderer reads sub-fields directly; no snapshot.** The renderer reads its child sub-fields as reactive signals — already eager-loaded, plain assembly, memoizable. No persisted/synced derived config object (it would be a second source of truth racing the children under LWW). Reading *own* children needs no cross-tree resolver, and a config subtree is a bounded, local children-read — not the node-scale aggregation of §13.2.

**Granularity is a choice, not a mandate.** Decomposed config can tear under concurrent offline edits (`L` and `H` independently LWW'd can converge to `L > H`). This is allowed — *a high warning below the low warning isn't broken data, it's a daft entry; let it through, flag it, let someone revert it; reserve the tamper-proof form for the few values where a wrong combination is dangerous, not merely silly.* Where a torn state is dangerous, bundle co-varying values into one compound sub-field (`thresholds: {LL,L,H,HH}`, atomic LWW) — the compound-leaf residue above. Validation is advisory by default — block at edit time on one client; post-merge, warn rather than refuse.

**Termination (⊥).** Each level's sub-field is a strictly smaller kind than its parent, until one declares no config. A cycle is impossible because the chain strictly descends (a pin is a boolean; a boolean's config is `{}`). `ConfigForm` is an optional override (for cross-field invariants / progressive disclosure, e.g. number-kv); the generic Treeview is the default Definition-authoring UI.

---

## 7. The cascade — one arbiter, three jobs

`inherit-unless-override` is shadow-and-delegate: an own value present shadows; absent, it delegates upward — a Derivation reading `ancestors/transitive` (the nearest ancestor that has a value) — and recomputes. Inheritance is therefore the same `SourceSpec` as aggregation, pointed up rather than down. One arbiter, three jobs:

1. **Business value inheritance** down the asset tree (criticality, rated pressure) until a node sets its own. ("Sets its own" = an instance override; distinct from the §6 governance *pin*, which *disables* override.)
2. **Definition specificity** — general → narrow → instance. With config as Elements (§6), a narrow Definition stores only overrides and delegates the rest; config-as-Elements + inherit-unless-override *is* the specificity spectrum, no new mechanism.
3. **App → org → role → user config** down the authority hierarchy, each layer's prefs being Fields on a Node (My Organisation, My Account).

**Audit-safe by construction.** Live delegation of *business values* would wreck business history; but config and prefs file in **Library / overlay** history, not business history, so delegating them touches no business audit. The danger of prototype-style delegation is absent at exactly the layer that uses it.

### Definition lifecycle (field-like) — fork, copy, no versions

- **Fork, never mutate.** A Definition is immutable in practice; editing one mints a new id; existing instances stay bound to the one they were minted from.
- **Copy at mint (owned sub-fields).** An instance copies its *meaning-defining* config (units, thresholds; `name` already) via `onCreate` — the **owned** disposition (§6) — and binds by `fieldDefinitionId` for the **delegated** sub-fields it reads live. Self-contained for what it owns; cascade-bound for the rest.
- **Identity is the version.** No `componentVersion`, no migration runner: `fieldDefinitionId` answers "which version," and the target never mutates. Value/config shapes are widen-only.
- Copy-at-mint is the degenerate case of the delegate cascade (value present at mint), so owned and delegated are one arbiter, not two mechanisms. **Node-like minting has no Definition at all** (§10) — a node is self-contained from creation.

---

## 8. Manifest → chrome (one-way entailment)

Chrome is never an Element. Each affordance is a consequence of the kind's composed set, drawn by the renderer reading the manifest. The entailment runs one way: manifest → chrome.

| Affordance              | Entailed by                                | Stored as |
| ----------------------- | ------------------------------------------ | --------- |
| Up button               | `placement: re-root` + own `parentId`      | nothing (derived) |
| Expand/collapse chevron | has children                               | nothing; `isExpanded` is device-local view state, not synced |
| Breadcrumb              | own `parentId` walk                        | nothing (derived) |
| Add surface(s)          | `Children(open)` + child kinds' `mintVia`  | nothing (rendered expression of `open`) |
| Field Details / Settings | has meta-field children                   | the region is chrome; its contents are Elements (§6) |
| Section header          | a grouping tag on the items                | nothing; a section is a render grouping, not a node |

The chrome is always one of: **derived** (Up, breadcrumb), **device-local view state** (chevron), or **the rendered expression of a capability** (`open` → Add; meta-fields → Details). None is content. The shell is **fractal** — every Node carries a tiny shell, the renderer reading that Node's manifest; it cannot be deleted by turning it into data.

**Presentation follows from a value's shape, not from per-kind flags.** A small closed vocabulary of value shapes (e.g. `scalar | block | stream | composite`) carries the arrangement rules once: a `scalar` renders inline with a centred chevron; a `block` is tall and pins the chevron to the top; a `composite` draws its own sub-structure and suppresses the generic label. A kind picks a shape; it never declares the layout. Layout is entailed, never declared — the same one-way rule as the rest of this section, applied to the value surface (and the discipline is the same as *earning a kind*: a new shape must carry a distinct *arrangement law*, not merely a different look, or it is styling and belongs in the renderer).

**Render precedence is surface assignment, not a layout arbiter.** An Element's primary surface (value, edge-link, or children-as-sole-content) owns the inline row alone. `Children` co-occurring with `OwnValue`/`Edges` is annotation and renders one surface deeper (Field Details). Field Details holds guidance; Field History the value audit; **Field Settings** the config/value-data meta-fields — a peer disclosure region below History, armed by an "Edit Field Settings & Config" toggle plus a background-colour affordance (depth + disclosure, not a mode).

---

## 9. Populations are typed trees

Each tree is rooted at its own Element (`parentId: null`); the ROOT view lists the business-tree roots. `Up` walks `parentId` up to a root, then to the ROOT view — it never ascends above a root. The business tree and the other populations (the Library, config, saved views) are distinguished not by structure but by a `treeType` axis.

Structure is uniform; **policy travels per-tree** as a `treeType` axis:

| `treeType`   | example contents             | history  | sync                       |
| ------------ | ---------------------------- | -------- | -------------------------- |
| `business`   | assets, fields, jobs, logs   | business | shared, LWW                |
| `library`    | field Definitions + their config subtrees | Library  | shared, LWW                |
| `config`     | org / role / user prefs      | overlay  | shared or per-user         |
| `view-state` | expansion, ordering overlays | none     | device-local, not synced   |

Per-viewer resolution layers `config`/`view-state` at read time through a single `effectiveChildren(node, viewer)` chokepoint — never written into the shared Element. (Personal `siblingOrder` is such an overlay: the canonical order is the column, a personal reorder is a sparse per-viewer overlay, never a write to the shared column.)

The **shell minimizes, doesn't vanish.** The only irreducible residue is: load the current root, render it, provide navigation. Generic, special-casing no kind. (This is the up-wall: data ascends to a tree root, but the manifest registry the shell consults is not itself an Element.)

---

## 10. Node-like kinds in depth

Node-like kinds compose the same vocabulary (§2/§3) as field-like kinds, weighted toward Children/Edges/Derivation and `re-root` placement. They are not bare containers; each earns the registry by composition.

### The lens — a computed, upward-provisioned view

The canonical node behaviour. A **lens** is a node-like Element that holds no content of its own: it *gathers* every Element of one target kind within a scope and shows them in one navigable place. **Jobs** and **Logbook** are one lens aimed at different kinds — Jobs gathers every `job`, Logbook every `log-entry`. It composes two parts already in the vocabulary, working in opposite directions:

- **Gather (down)** — a `Derivation` reading `children/transitive`, matched to the target kind. A lens's membership *is* this computation: current by construction, nothing stored. Jobs = `Derivation(children/transitive → job)`; Logbook = `Derivation(children/transitive → log-entry)`. The target Elements live in their own physical home in the tree, wherever they were created; the lens reads, never owns.
- **Provision (up)** — a `ProvisionSpec`: when a target Element appears anywhere, a lens is reconciled into existence at each ancestor, keyed by a deterministic id (`jobs:<nodeId>`), so concurrent creates converge on one lens, never duplicates. Each lens still gathers over *its own* subtree.

Provisioning goes **up** so every level can see what lies beneath it; gathering goes **down** so each level sees only its own. **A lens is `Derivation(children/transitive) + ProvisionSpec`** — no stored membership, because the Derivation *is* the membership. Hand-picked membership is a different thing: the curated `logical-container` (below), which stores `Edges`.

The target kind is the only parameter. An org that works in "work orders," "tasks," or "tickets" rather than "jobs" is the same lens aimed at a different kind. Nothing here is a new primitive; it is a composition, which is why it belongs in the registry.

### Other node-like kinds

- **`job`** — a rich node-like Element, much like a physical asset: `Children(open)` for user-added detail, plus its own status/lifecycle fields and a constrained state machine (validated transitions; eventually `Action` with a transition guard). Its appearance is the trigger the Jobs lens provisions against. (`log-entry` is its analogue for the Logbook lens.)
- **`org`** — `Children(open)` + `Derivation(children/transitive)` (people/role rollup); a people container with engineered aggregation.
- **`person`** — composes its identity/account role (the anchor for the per-user `config`/overlay cascade of §9) plus the reliable-target role; it earns its kind on behaviour, with targeting as the bonus `kind`'s hardness provides. (Exact sub-spec set is design-pending; it is a kind because it composes behaviour, not because it is a label.)
- **`logical-container`** — the **curated** counterpart to the lens: `Edges(members, multi) + Reads.resolver`. Membership is hand-picked by reference, stored, and manual — it does not auto-update. `container: logical`.

### Instances, tags, and seed data

Users mint **instances** (a specific pump, fuse, ship, a Dave) of these kinds, and coin **`typeOf` tags** (`pump`, `vessel`, `relay`) — both unbounded data. The behaviour-free domain typology ships as **forkable seed `typeOf` data** (tag + default field bundle), read by *one generic service* that suggests fields from the node's `typeOf` (unknown tags fall back; suggestions are soft). `typeOf`, Tags, Flags are folksonomy the system does not dispatch on. **Behaviour ≠ kind:** the create affordance, the suggestion lookup, and the renderer are generic app code, not kinds.

### Templating (no Definition)

Node-like minting spawns **no Library/Definition record** — the second of the two node/field differences (the first: kind choice comes via `mintVia: 'node-create'`, not the composer). Node "templating" is **Copy As Template**: a node_details affordance that clones an existing node's *skeleton* (structure + seed values, never business history, readings, or memberships), org-scoped, ephemeral until reuse justifies persistence. A clone copies the skeleton, never the blood.

### Sections are chrome, not nodes

A card-section / children-section is a render grouping keyed on a tag on the items (fields or child nodes stay flat, direct children, drawn under a heading) — not a container node, which would add a tree level and defeat the flattening it exists for (§8).

---

## 11. Catalogue (composed subsets)

This is the demonstration set: every kind the framework is meant to reach, field-like and node-like, each a composition of the §2 capabilities and nothing else. Not all are built at once — the catalogue exists to show the framework *can* express them all without new primitives. `current` = built/settled · `describe` = subset settled, build deferred · `open` = a question remains.

| Kind                  | Composition                                                  | Example                          | Placement | Status   |
| --------------------- | ----------------------------------------------------------- | -------------------------------- | --------- | -------- |
| (origin)              | `{}`                                                        | a bare titled row                | inline    | current  |
| text-kv / enum-kv / number-kv | `OwnValue`                                          | `Depth = 12.4 m`                 | inline    | current  |
| node                  | `Children(open)`                                            | `Pump P-101`                     | re-root   | current  |
| image                 | `OwnValue(blob)`                                            | a nameplate photo                | inline    | describe |
| image-with-caption    | `Children(template: image + text-kv)`                       | photo + "south face"             | inline    | describe |
| asset-doc             | `Edges(internal, live) + Reads.resolver`                    | → O&M Manual (live)              | inline    | describe |
| value-chart           | `OwnValue + Reads.historyStream`                            | pressure, last 90 days           | inline    | describe |
| inherit-unless-override | `OwnValue + Derivation(ancestors/transitive) + arbiter`   | `Criticality ← parent`           | inline    | describe |
| intrinsic node scalar | `Children + OwnValue` (flagged)                             | Tank (own value `84%`)           | re-root   | describe |
| logbook               | `Derivation(children/transitive → log-entry) + Provision` (lens) | all entries below here     | re-root   | describe |
| log-entry             | `Children(template: body + tag/flag tails)`                 | "replaced seal" `#done`          | inline    | describe |
| job                   | `Children(open) + lifecycle`                                | Replace bearing (Open→Done)      | re-root   | describe |
| jobs                  | `Derivation(children/transitive → job) + Provision` (lens)  | all jobs below here              | re-root   | describe |
| org                   | `Children(open) + Derivation(children/transitive)`          | Maintenance Dept (12)            | re-root   | describe |
| person                | `Children(open) + identity/overlay-anchor + target`         | Dave (assignee, account)         | re-root   | describe |
| logical-container     | `Edges(members, multi) + Reads.resolver`                    | Spare Parts (hand-picked)        | re-root   | describe |
| cross-tree action     | `Action(cross-tree)`                                        | "close all child jobs"           | inline    | open     |
| saved view            | view-state overlay (§9)                                     | "my open jobs"                   | re-root   | open     |

### How each works

**Field-like** (inline; lean on `OwnValue`):

- **text-kv / enum-kv / number-kv** — the core key-value fields: a label plus a typed own value (free text · one-of-a-set · a number). LWW. A `number-kv`'s units and thresholds are config sub-fields, not part of the value (§6).
- **image** — an own value that is a blob pointer; the bytes live in blob storage, the Element holds the reference.
- **image-with-caption** — a composite built from two `template` children (an `image` + a `text-kv`). Proof that a "single field" can be two sub-fields without a bespoke kind.
- **asset-doc** — a live link to another internal Element, resolved at read time: it shows the target's current state, never a copy. `Edges(internal, live)` + a resolver.
- **value-chart** — plots its *own* value's history. The "self over time" case that needs no scope — it reads `Reads.historyStream`, not a Derivation.
- **inherit-unless-override** — a value that delegates up the tree: present ⇒ shadows; absent ⇒ reads the nearest ancestor with a value (`Derivation(ancestors/transitive)`), arbitrated. The engine behind business-value inheritance and Definition specificity (§7).

**Node-like** (re-root; lean on `Children` / `Derivation` / `Edges` / `Provision`):

- **node** — the base: a titled container with open children — a physical asset, sub-asset, or logical division. What it *is* beyond "node" (pump vs vessel) is a soft tag, never a kind.
- **intrinsic node scalar** — a node that *also* carries its own value (`Children + OwnValue`). This is the answer to "can a node-like Element have a value?" — yes: a tank that holds child fields *and* a primary reading or a cheap rollup as its own value. Flagged (§5) because the two capabilities co-occur; allowed knowingly.
- **lens** — the general gather-and-provision pattern (§10): a node holding no content of its own that gathers every Element of a target kind over `children/transitive` and is auto-provisioned upward (one per ancestor, deterministic id). Membership *is* the Derivation — nothing stored.
  - **jobs** — the lens aimed at `job`: every Jobs box shows all jobs beneath it, and one appears at each ancestor when a job is added anywhere below.
  - **logbook** — the same lens aimed at `log-entry`: all entries beneath the point you're viewing.
- **job** — a rich, asset-like node (open children for detail) plus its own status/lifecycle state machine (validated transitions). Its appearance is what the `jobs` lens provisions against. Org variants — task, work-order, ticket — are soft labels on `job`, not new kinds.
- **log-entry** — one logbook entry: a template body with tag/flag tails. The thing the `logbook` lens gathers.
- **org** — a people/role container with engineered aggregation (a `children/transitive` rollup of its members).
- **person** — an identity/account Element: the anchor for the per-user config/overlay cascade (§9) and a reliable edge target. Earns its kind on behaviour, not as a label.
- **logical-container** — the *curated* counterpart to the lens: hand-picked membership by reference (`Edges`), stored and manual, no auto-update. The minimal logical grouping.

**Config leaves** (§6) — `units` (an `enum-kv` keyed to quantity-kind), `quantity-kind` (a fixed-option enum like `length-unit`, locked by `kind`-immutability), `staleness` (a `number-kv` in seconds), flags (booleans), `threshold-compound` (a compound own value, atomic LWW). Most reuse the field-like kinds outright; only the compound earns a new kind. These are the leaves of config subtrees, never new primitives.

**Cross-cutting** — **cross-tree action** is the only imperative capability (`Action`): built last, likely never user-authorable (§2). **saved view** is a stored query/overlay in the `view-state` population (§9), reading the soft tag/position/field-presence layer; deferred.

### What is *not* a kind

- **Domain typology stays soft.** Pump, vessel, relay, road-bridge — and org variants like task or work-order — are user-grown tags on the relevant kind, never kinds and never a schema column. Identity and lens-matching key on `kind` (the one hard discriminant, spanning both populations); the soft layer (tags, position, field-presence) feeds search / filter / sort / facet. *(Whether the soft layer gains one canonical required tag is a separate, deferred question — §13.)*
- **A field Definition is not its own kind.** It is a field-like Element of the very kind it defines, living in the `library` tree (§9) and bound to instances by `fieldDefinitionId`. The Library is a population, not a kind.

---

## 12. Resolved decisions

- **One `kind`, one registry, one vocabulary.** Node-like and field-like kinds are a spectrum composed from the same six capabilities + descriptors; `kind` is the sole hard, immutable discriminant.
- **Kinds earn the registry by composed behaviour.** Behaviour-free domain labels are `typeOf` tags on `node` and ship as seed data; targeting alone never earns a kind. Users mint instances and coin tags, never kinds. Identity and lens-matching key on `kind` across both populations; domain typology stays soft — no separate classifier column.
- **Node behaviour decomposes into descriptors:** one `SourceSpec` of `{relation, reach}` covers aggregation (`children/transitive`), inheritance (`ancestors/transitive`), and curated membership (`edges/direct`) — direction × reach, with own-data/own-history needing no scope; auto-provisioning = `Derivation` + `ProvisionSpec` (one node per place, deterministic id, not `Action`); membership-mode = `container` (physical/logical); lifecycle = constrained `Action`/validated value.
- **The lens.** Jobs and Logbook are one pattern: a node-like Element that gathers every Element of a target kind over `children/transitive` (membership *is* the Derivation — nothing stored) and is auto-provisioned upward (one lens per ancestor, deterministic id, converging). Gathering goes down; provisioning goes up. The target kind is the only parameter (work-orders/tasks/tickets are just other targets). Hand-picked membership is the separate curated `logical-container` (stored `Edges`).
- **Config is Elements; no blob.** `FieldDefinition.config` retires into the Definition's `library`-tree subtree; the only object-valued residue is the compound sub-field for atomic clusters. The renderer reads sub-fields as reactive signals (no snapshot). Locking decomposes into `kind`-immutability / `template`-presence / cascade-`pin` — no new capability; a sub-field's disposition (owned-at-mint / delegated / pinned) selects the §7 branch. Stupid combinations are allowed and reverted; validation advisory; `ConfigForm` an optional override for cross-field invariants.
- **One arbiter, three jobs** (business inheritance, Definition specificity, app→org→user cascade), audit-safe because config/prefs are Library/overlay-historical.
- **Manifest → chrome is one-way; the shell is fractal and minimal.** Sections are chrome, not nodes.
- **Populations are typed trees, each with its own root**; sync/history/visibility ride `treeType`; per-viewer state layers at read time, never written into the shared Element.
- **Two node/field minting differences:** node kind choice via `mintVia: 'node-create'`; node minting spawns no Definition record (templating is Copy-As-Template, skeleton-only, org-scoped). Field minting binds a `FieldDefinition` (fork-not-mutate, copy-at-mint, identity-is-the-version).
- **`name`/`siblingOrder` are permanent columns**; `coherence` is per-manifest until many kinds exist.

---

## 13. Open questions

1. **`ProvisionSpec` triggers** — the reconciler's remit is settled (one node per place, deterministic id, idempotent, convergent); what remains open is the trigger vocabulary (target-appears-in-scope, schedule) and *when* recompute fires — the same invalidation question as Q2, not a separate one.
2. **Aggregation materialization** — recompute-on-read with a memo vs materialized rollup invalidated on descendant change; acute at node scale (a `jobs`/`org` rollup over a large subtree).
3. **`person`/`org` sub-specs** — the concrete composed behaviours beyond the sketch in §10.
4. **Arbiter classification** — is `ArbiterSpec` a closed set of pairwise rules or a general resolver?
5. **`treeType` granularity** — policy keyed by tree root, by `treeType` enum, or per-kind?
6. **Action exactly-once** — offline-replay idempotency (keys, dedupe window), when Action is built.
7. **Sub-field granularity** — per cross-field invariant, the line between independent sub-fields and one atomic compound sub-field.
8. **Disposition & pin encoding** — is owned/delegated/pinned an authored flag on the Definition-side sub-field (and where: a reserved property vs a meta-sub-field), or entailed by template-vs-open plus a pin boolean? Plus the read-time cost of assembling a Definition's config subtree vs the old single blob (memo / materialization — bounded, but measure).
9. **Canonical classifier tag** — whether the soft layer gains one required, single-valued, controlled-but-user-grown tag per node (a firm handle for search / filter / target over domain typology), distinct from open multi-tags. Deferred; identity stays on `kind`.

---

## 14. Migration / code touch-points

Today → target; each a widening, not a rewrite.

1. **One `kind`, one registry** — first collapse `componentType` into `kind`: flatten the two-tier `Kind = "node" | ComponentType` into a single registry-derived `Kind` union, and rename `componentType` → `kind` across `registry.ts`, the four `*.manifest.ts`, the `KindManifest` type, `FieldDefinition`, and the `DataField` dispatcher. This is a **1:1 rename, not a de-entangling** — nothing reuses a componentType across kinds; each manifest already owns its whole component code, so it is wide but mechanical (the only structural part is flattening the genus/subset union; `FIELD_KINDS` survives only as a derived `placement: inline` helper, not a type tier). Then widen `KIND_REGISTRY` to `Record<Kind, KindManifest>`, admitting `node` and all node-like kinds; `node` ceases to be framework-rendered-outside-the-registry.
2. **Manifest** — add `placement`, `mintVia`, the capability descriptors, and the node-oriented descriptors (`provision`, `container`, `SourceSpec` `{relation, reach}`); generalize `FieldRendererProps` → placement-keyed `RendererProps`.
3. **Privilege reframing** — SPEC's "Node is the privileged Kind / rendered outside the registry" → "the shell is privileged; `node` is the degenerate re-root kind in the registry." Rename Field-kind framing to Element-kind where SPEC over-narrows.
4. **Config-as-Elements** — retire `FieldDefinition.config`; the Definition becomes a `library`-tree Element whose config is its child subtree. Concrete touch-points: the four `ConfigForm`s become Definition-authoring over config sub-fields (kept only as cross-field-invariant / progressive-disclosure overrides); `validateNumberKvConfig` moves to the threshold compound sub-field's `validate` (or the number-kv `ConfigForm`); `seedFieldDefinitions` writes Definition subtrees with stable deterministic sub-field ids; `ValueSpec` sheds its config-schema role (config schema = the kind's `ChildrenSpec` over config sub-field kinds); co-varying values become one compound sub-field; the §7 arbiter honors disposition (owned/delegated) + `pin`; give `DEFAULT_FIELD_DEFINITION_IDS` a manifest/Definition home.
5. **Chrome entailment** — factor hardcoded shell drawing into a renderer reading the manifest (`re-root → Up`, `open → Add`, meta-fields → Details/Settings, grouping-tag → section).
6. **Typed trees** — introduce `treeType`; route sync/history/visibility by tree; `effectiveChildren(node, viewer)` for per-viewer state.
7. **Node-like kinds** — implement the **lens** once (`Derivation(children/transitive)` gather + upward `ProvisionSpec`, one node per ancestor, deterministic id) and instantiate it for `jobs` and `logbook` by target kind; then `job`/`log-entry`, `org`, `person`, and the curated `logical-container` (the only kind needing `Edges`). Implement the `SourceSpec` `{relation, reach}` traversal (children, ancestors, edges). Surface node-kind choice in the "New Asset" / `usePendingForms` under-construction flow, choice UI in the under-construction node_details div; keep `typeOf`→suggested-fields as one generic service.
8. **Copy As Template** — a node_details affordance cloning skeleton-only (no history/readings/memberships), org-scoped, persisted on demonstrated reuse.

Retires from LATER.md: recursive sub-field composition, reusable config sub-shape extraction, the Phase-2 renderer-registry items, `single-image` as a latent composite; reframes Tree Partitioning as typed trees, each with its own root.
