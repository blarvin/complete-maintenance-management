# KINDS-SPECS.md — Field Kinds, the Capability Model, and the Manifest API

***Intent:*** *the `Element` model makes new surfaces cheap; this document is where we design the plug-in seam that keeps them honest — one manifest per kind, against one registry, proven by a catalogue of concrete kinds.*

> **Status: working model.** This file develops the shape of *kinds*, the *capability model*, the *registry/manifest* API, and a catalogue of contemplated kinds with per-kind specifications. It is deliberately separate from `SPECIFICATION.md` so the kind catalogue does not bloat the main spec.
>
> The model is **capability composition**: a kind is the base `Element` plus a subset of independent capabilities — not a point in an enum. The capability set is **closed and small** (six), the kind catalogue is **open** (Open/Closed Principle).

> Read `SPECIFICATION.md → Concepts & Vocabulary` and `→ DataField Components and Crowdsourced Library` first — this document assumes that vocabulary (surface vs. storage; `Element` / `kind` / `Renderer` / `FieldDefinition` / `FieldComponent`; the FieldComponent → FieldDefinition → DataField hierarchy) and does not restate it.

---

## The design invariant — why "kinds" exist

The unified `Element` model (one recursive record, drawn by the renderer its `kind` selects) makes it *cheap* to add surfaces. The risk is that cheapness dissolves the product into a featureless soup. The discipline (per SPEC's design invariant) is that **every new surface enters as a variety of Field or a behavior of Node — never a new primitive.**

The capability model is how that invariant is *enforced cheaply*. Because a kind is the base `Element` plus a chosen subset of capabilities, "a new kind" is always a recomposition of existing parts, never a new primitive — by construction. The catalogue below is the proving ground: if every contemplated need reduces to a capability subset **without special-casing**, the model is sound. That is the success criterion for this document.

---

## The Capability Model

### A kind is a composition, not an enum point

**A kind is the base `Element` plus a chosen subset of independent *capabilities*.** There is exactly one origin — the bare `Element` (`id`, `name`, `parentId`, `siblingOrder`; no value, no children, no edge, no derivation), drawn as a plain row. Every other kind is that origin displaced by one or more capabilities, each capability consumed only by the subsystem that cares about it.

This is the entity–component decomposition: the `Element` is the entity, capabilities are components, each subsystem is a system reading the one component it owns. Capabilities are orthogonal by construction, so a kind may combine any of them — e.g. a stored value that *also* owns a fixed sub-template (a `number-kv` carrying the author's usage-instructions children). The combinations that are *not* legal are forbidden explicitly by a coherence rule (Asterisk 2), never implicitly by the shape of an enum.

### The base Element (the origin / shell)

The origin is the empty capability subset: `{ id, name, parentId, siblingOrder, updatedBy, updatedAt, deletedAt }` — no `value`, no children, no edge, no derivation — rendered as a bare titled row. The only irreducible privileges in the system are the framework **shell** (current-root view, navigation, Up button, ROOT) and the **root position** (`parentId: null`); these are privileges of the *renderer* and a *position*, not of any kind. `node` is **not** privileged — it is the origin plus `{ Children(open) }`, registered like any other kind.

### The capability set (closed; six)

The set is **closed to modification, open to extension** (Open/Closed): adding a **kind** is cheap (a manifest, a recomposition of these six); adding a **capability** is a deliberate, expensive framework change. A need is a *new capability* only if it introduces a sync rule or a read/compute/**write** path none of the six already has.


| Capability        | Descriptor                    | Consuming subsystem(s)                            | Sync / LWW contract                                                                                            |
| ----------------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **OwnValue**      | `ValueSpec`                   | sync, history, value renderer                     | LWW `value` by `updatedAt`                                                                                     |
| **Children**      | `ChildrenSpec`                | atomic-create, tree framework, child-render pass  | parent has no own value to LWW; **each child is an independent Element, LWW'd on its own**                     |
| **Edges**         | `TargetSpec`                  | edge-LWW, resolver, link renderer                 | **LWW the edge only**; target content never touched                                                           |
| **Derivation**    | `SourceSpec`                  | compute path                                      | **never stored, never synced, never in history**                                                              |
| **Action**        | `ActionSpec`                  | command bus (the write / effect path)             | emits commands; **stores no value**; effects are ordinary Element mutations elsewhere (which carry their own history); activation may be logged as an event |
| **Reads** (flags) | `{resolver?, historyStream?}` | renderer (injected read-only)                     | none — pure read capability, no sync effect                                                                    |

Two of these came out of the design dialogue and are worth stating plainly:

- **`Children` merges the former `Composition` + `TreeBehavior`.** "Has a fixed sub-template" and "has an open child set" were two facets of one fact — *this Element has children* — so they are one capability whose descriptor (`ChildrenSpec`) carries a `template`, an `open` bag, or both. Composite vs. node is now the two ends of one knob; `placement` (inline vs. re-root) carries the UX distinction. This *removed* a cross-capability arbiter (see Asterisk 1).
- **`Action` is the only write/effect capability.** Every other capability is *declarative state* (convergent, LWW, offline-safe); `Action` is an *imperative command*. It is described for completeness and gated hard (see *Action* below and Resolved decisions).

A kind = origin + a subset of these. Worked subsets:

- base row = `{}` · `node` = `{Children(open)}` · `text-kv` = `{OwnValue(string)}`
- `image-with-caption` = `{Children(template)}` · usage-annotated field = `{OwnValue, Children(template)}`
- `asset-doc` = `{Edges, Reads.resolver}` · `asset-gallery` = `{Derivation, Reads.resolver}`
- `value-chart` = `{OwnValue(number), Reads.historyStream}` (lazy) · `person` = `{Children(open)}` (capability-identical to `node` — see Asterisk 3)

### The three asterisks — where "independent" needs care

Capabilities are orthogonal in **storage and representation**. They are *not* orthogonal in three specific gaps, and those gaps — not the capabilities themselves — are the real spec surface. (The system has an irreducible kernel; when the `nature` enum dissolved into capabilities, the kernel did not vanish — it shrank into these three.)

**Asterisk 1 — Arbitration (invariants that live *between* capabilities).** Some pairs contend for one decision the resolution of which belongs to neither capability:

- **OwnValue + Derivation** = *inherit-unless-override* (criticality / cost-center / rated-pressure cascading down the tree until a node pins its own). Runtime state decides which is live: value present → OwnValue, LWW'd; value absent → Derivation, recomputed, never stored. The sync rule *flips with state*. Requires an explicit `arbiter` — a third thing, owned by neither.
- **Render precedence** across `OwnValue + Children + Edges`: when one element draws a value, child rows, and a link affordance at once, draw-order/layout is in no single capability.

> The former *fixed core + open tail* arbiter (Composition vs. TreeBehavior) is **gone** — it is now internal to one `ChildrenSpec` that may hold both a `template` and an `open` bag. Merging the two capabilities removed the arbitration case rather than resolving it.

→ the model needs an `arbiter?` slot per remaining contending pair. **Describe now, build when a concrete kind forces it.**

**Asterisk 2 — Validity (not all 2ⁿ subsets are coherent — and coherence is codeable).** The capability bag is a *product type*; most of the 2ⁿ combinations are nonsense. There is no curated enum to guarantee every member is sensible, so coherence is paid back as an explicit **predicate**. **This is the plug-in seam:** authoring a new kind = composing capabilities, and the predicate answers "does this one work, or not?" — "some that work, some that don't" becomes a *computed* property of the manifest, not a matter of taste.


| Capability subset                            | Verdict               | Why                                                                           |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `OwnValue + Derivation`, no `arbiter`        | **invalid**           | which value wins is undefined (Asterisk 1)                                    |
| `Derivation + Reads.historyStream`           | **invalid**           | nothing is stored, so there is no history stream to read                      |
| `Derivation + OwnValue + arbiter`            | **valid**             | inherit-unless-override; arbiter resolves the flip                            |
| `Children` `open.childKinds:'*'` as a *tail* on a `template` | **valid** | fixed core + open tail; the tail must stay kind-constrained so it is not a bare node |
| `Edges + Children(template)`                 | **valid**             | labeled inline edge / association-class (edge with local annotation children) |
| `Children + OwnValue`                        | **valid, flagged**    | intrinsic node scalar (cheap rollup/filter) — allowed *knowingly*             |
| `Action` + own-value mutation only           | **invalid**           | a pure self-CRUD "action" is just `OwnValue` + the edit UI — not a kind        |
| `Edges` `pin:'revision'`, no `ValiditySpec`  | **valid (defaulted)** | defaults to `pinned-rev-is-current`, not an error                             |


→ `coherence?: (caps) => Result<void, string[]>` is itself manifest code; a kind whose set fails it **does not register**. The table above is the seed rule set, **per-manifest** for now (extract to a central engine once many kinds exist — Resolved decisions, Q2).

**Asterisk 3 — Identity (the nominal residue structure can't absorb).** A kind is **a name + a capability subset**, and the name is load-bearing on its own. `person` is capability-identical to base `node`, yet must be a distinct kind — it is the typed cross-`Element` reference target (`allowedKinds: ['person']`), its own picker entry, its own semantic type. Structure differentiates *behavior*; it cannot differentiate *identity*. So `kind` (the nominal slug) and `pickerLabel` live in the manifest's **identity layer**, outside the capability bag. Two kinds may share every capability and still be different kinds.

### The coded manifest — logic lives in the manifest, never on the Element

The manifest carries data (descriptors) **and** code (components + hooks). **Each capability descriptor may carry logic hooks, and that is the entire plug-in mechanism.** Authoring a kind = dropping a manifest that composes capabilities and supplies their hooks.

**Why this is the *only* possible shape here (a framework constraint, not a choice).** Qwik cannot serialize methods (`CLAUDE.md`: services in context → `Code(3)`; `noSerialize` → `undefined` after SSR). Therefore logic **cannot** be injected onto an `Element` instance — the `Element` must stay inert, serializable data, and `kind` is just a string discriminant. All kind-specific logic lives in the **manifest registry, module-level, looked up by `kind` at runtime** (`getKindManifest(el.kind)` inside `$()` handlers; never captured, never serialized). This is not a tax — it *is* the entity–component split, enforced by the framework: data (`Element`) and behavior (manifest) are physically separated, joined by the `kind` string.

So *"a `person` node admits only an actual person as a child"* is **not** state on the person Element; it is a hook on the person manifest — `children.validateChild(child) => child.kind === 'person'` — evaluated by the tree framework at insert time. And *"this authored kind doesn't work"* is a manifest whose `coherence()` rejects its own capability set, or whose hooks contradict its descriptors. Both the legit and the non-legit cases are codeable, in the same place.

```ts
type KindManifest = {
  // --- identity layer (Asterisk 3 — irreducible; capabilities don't determine it) ---
  kind: Kind;
  pickerLabel: string;

  // --- presentation (a skin over the bag, not a capability) ---
  Renderer: Component<FieldRendererProps>;   // every kind renders something; +resolver iff reads.resolver
  placement: 'inline' | 're-root';           // where this kind draws its own surface (≠ navigability)

  // --- capabilities (each optional; absence = origin in that axis) ---
  ownValue?: ValueSpec;          // value default/validate/equals/displayPreview + the VALUE config schema/form
  children?: {
    spec: ChildrenSpec;                              // template, open bag, or both
    validateChild?: (child: Element) => boolean;     // "only persons here"
    onCreate?: (parentId: ID) => ElementDraft[];     // atomic multi-Element provisioning of the template core
  };
  edges?: {
    target: TargetSpec;
    validateTarget?: (candidate: Element) => boolean;// person-only / doc-only link constraints
    ConfigForm?: Component<ConfigFormProps>;         // authors the target (edge config, not value config)
  };
  derivation?: {
    source: SourceSpec;                              // signals "never store"
    compute?: (resolver: ElementResolver, root: ID) => Promise<DataFieldValue | null>;
  };
  action?: {
    spec: ActionSpec;
    run?: (el: Element, bus: CommandBus, resolver: ElementResolver) => Promise<void>; // emits commands; never mutates inline
  };

  // --- cross-capability + meta (the asterisks made code) ---
  arbiter?: ArbiterSpec;                             // Asterisk 1 — resolves contending pairs
  coherence?: (caps: CapabilitySet) => Result<void, string[]>; // Asterisk 2 — is this kind buildable?
  reads?: { resolver?: boolean; historyStream?: boolean };     // capability-flags (not natures)
  lazy?: boolean;                                    // heavy renderers loaded on demand
};
```

`Kind` and `DataFieldValue` are **derived from** the registry of these manifests, not hand-maintained beside it (closes LATER registry item (f)): a missing or mistyped kind is a compile error.

Note the value-presupposing machinery — `defaultConfig`, `ConfigForm`, `displayPreview`, value `validate`/`equals` — now lives **inside `ownValue` (`ValueSpec`)**, not at the top level (Q1). A value-less kind (`node`, `image-with-caption`, `asset-doc`) omits `ownValue` and all of it disappears, instead of supplying no-op stubs. `Renderer` and `placement` stay top-level because every kind renders something somewhere.

`placement` is orthogonal to **navigation-on-tap**. A reference kind is `inline` (its row lives on the Card) yet navigates to its *target* on tap; that is a reference behavior, not a placement. `placement` only says where *this* kind's surface is drawn — on the parent's Card (`inline`) or as its own view you navigate *into* (`re-root`).

### Descriptor types

Exactly the descriptor referenced by each present capability applies.

```ts
// OwnValue descriptor — everything that presupposes the element has its own value (Q1).
type ValueSpec<TValue = DataFieldValue, TConfig = FieldDefinitionConfig> = {
  defaultValue?: TValue | null;
  equals?: (a: TValue | null, b: TValue | null) => boolean;          // structural; default === (avoids bundled-object ref bugs)
  validate?: (value: TValue, config: TConfig) => Result<void, string>;
  // value-config layer — schema + interpreter, NOT the concrete per-Definition values
  defaultConfig: () => TConfig;
  validateConfig?: (config: TConfig) => Result<void, string>;        // e.g. number-kv LL ≤ L ≤ nominal ≤ H ≤ HH
  ConfigForm: Component<ConfigFormProps>;
  displayPreview: (value: TValue | null, config: TConfig) => string | null;
};

// Children — merges the former Composition + TreeBehavior. One capability for "this Element has children."
type ChildrenSpec = {
  template?: SubFieldSpec[];               // fixed core (the former composite): kind-constrained, minted atomically
  open?: { childKinds: '*' | Kind[] };     // open user-grown bag (the former node)
  // a kind may have template, open, or BOTH (fixed core + open tail) — no longer a cross-capability arbiter
  aggregates?: SourceSpec;                 // node-scoped rollup (Logbook); same SourceSpec as Derivation
  autoProvision?: AutoProvisionSpec;
  container?: 'physical' | 'logical';
};

// Composition template entry — structure, not values.
type SubFieldSpec = {
  kind: Kind;
  label: string;
  cardinality: 'one' | 'many';        // singleton (body) vs collection (tags, @-mentions)
  config?: FieldDefinitionConfig;
};

// Derivation source — AND Children.aggregates. One concept, two consumers.
type SourceSpec = {
  scope: 'children' | 'descendants' | 'subtree';
  matchKinds: Kind[];                 // gallery: ['image','image-with-caption']; logbook: ['log-entry']
  // future: predicate/filter, ordering
};

// Edges target — internal/external, live/revision-pinned, virtual-parent appearance.
type TargetSpec = {
  scope: 'internal' | 'external';     // internal → Element id; external → URL
  pin?: 'live' | 'revision';          // 'revision' pins ${targetId}:${rev}; default 'live'
  appearance?: 'portal' | 'citation'; // virtualParents render mode (other-end); default 'citation'
  authorFrom?: 'referrer' | 'target' | 'both';  // which end's UI creates the edge; default 'referrer'
  allowedKinds?: Kind[];              // internal only: valid target kinds
  valid?: ValiditySpec;              // when the edge counts as valid (e.g. pinned-rev is current)
};

// Edge value shapes (discriminated by scope/pin)
//   internal, live:     { targetId: ID }
//   internal, revision: { targetId: ID, rev: number }            // approval
//   internal, virtual:  a virtualParents entry { parentId, siblingOrder, navMode, render }  // other-end
//   external:           { url: string }

// Validity / staleness; DESCRIBED now, predicate engine DEFERRED.
type ValiditySpec =
  | { rule: 'pinned-rev-is-current' }   // approval valid only while target hasn't advanced
  | { rule: 'always' };                 // live references (default)

// Action — the only WRITE/effect capability. Imperative command, not declarative state.
// DESCRIBED for completeness; build last; gate hard; likely never user-authorable.
type ActionSpec = {
  emits: string[];                 // command names dispatched on activation (reuses the existing CommandBus)
  target: 'self' | 'cross-tree';   // 'cross-tree' (order a part, mint a job elsewhere) is the dangerous one
  confirm?: boolean;               // require explicit user confirmation before firing
  idempotencyKey?: (el: Element) => string;   // exactly-once guard so offline replay can't double-fire
};

// Auto-provisioning / lifecycle; DESCRIBED for completeness, DEFERRED to build.
type AutoProvisionSpec =
  | { rule: 'propagate-down' }                          // logbook seeds down the subtree
  | { rule: 'synthetic-container'; container: Kind };   // job → minted Jobs container

// Arbitration — resolves a contending capability pair (Asterisk 1). DESCRIBED now.
type ArbiterSpec =
  | { rule: 'own-value-overrides-derivation' };   // inherit-unless-override (the fixed-core/open-tail arbiter is retired)
```

### The resolver capability

`OwnValue`/`Children` renderers are pure functions of their own value/children — trivially testable, no read access beyond themselves. `Edges` and `Derivation` renderers additionally receive an injected **read-only** resolver (`reads.resolver: true`); it never mutates.

```ts
type ElementResolver = {
  get(id: ID): Promise<Element | null>;                    // edge: resolve target
  query(spec: SourceSpec, root: ID): Promise<Element[]>;   // derivation: scoped traversal
};
```

### Children trait bundles (node behaviors)

Every kind with `Children(open)` shares two things: it is *recursive* and *navigable*. That common core is owned by the framework. What differs between behaviors is the rest of the `ChildrenSpec` trait bundle. The plain Asset node is the **degenerate** bundle (the origin of this trait space), not a special case beside the others:


| Trait                                  | Asset node | Logbook                                 | Job                                          | Person   |
| -------------------------------------- | ---------- | --------------------------------------- | -------------------------------------------- | -------- |
| **open.childKinds** — what may be a child | `*`     | `log-entry` only                        | job-related / `*`                            | `*`      |
| **aggregates** — rolls up descendants? | no         | **yes** (log entries, all the way down) | no                                           | no       |
| **container**                          | physical   | physical                                | **logical**                                  | physical |
| **autoProvision**                      | —          | propagate down the subtree              | auto-group into a synthetic *Jobs* container | —        |


Two consequences:

- **Logbook's rollup reuses the Derivation `SourceSpec` exactly.** "Show the logs for all items below" is a descendant traversal + match — identical to the `asset-gallery` `Derivation` field, scoped to a node's subtree rather than a field. One traversal concept, two consumers (node-scoped `aggregates` and field-scoped `derivation`).
- **Person is the trait-degenerate behavior.** Its traits are identical to the base Asset node; it earns a distinct `Kind` by **identity** (Asterisk 3), not by trait displacement.

### The registry & adding a new kind

The registry maps each `Kind` to its manifest, exhaustiveness-checked. `node` registers like any other kind (its recursion/navigation are framework-owned via the shell; its manifest carries only the base `ChildrenSpec(open)`).

```ts
export const KIND_REGISTRY = {
  node: nodeManifest,                 // base of the trait space — Children(open)
  'text-kv': …, 'enum-kv': …, 'number-kv': …,
  image: imageManifest,               // bare blob primitive
  'image-with-caption': …, 'equipment-plate': …, 'log-entry': …,   // children(template)
  'asset-gallery': …,                 // derivation
  'asset-doc': …, 'part-supplier-link': …, 'other-end': …, approval: …,   // edges
  'value-chart': …,                   // ownValue + reads.historyStream
  logbook: …, job: …, person: …,      // children(open) behaviors
} satisfies Record<Kind, KindManifest>;
```

Adding a kind is the **only** place the framework learns about it:

1. Add the kind to the registry source of truth (the `Kind` union derives from it).
2. Drop a `src/kinds/<kind>.manifest.ts` declaring its capability subset + the descriptor each present capability needs.
3. Implement `Renderer` (resolver-aware iff `reads.resolver`) and, if authorable, the capability's `ConfigForm`; supply capability hooks as needed.
4. Register in `KIND_REGISTRY` → the `satisfies Record<Kind, …>` exhaustiveness check passes; `coherence()` must accept the capability set.

Nothing else in the framework changes. That is the plug-in property this document sets out to prove.

---

## Two populations and Definitions

The one substrate (`Element` + capabilities) carries **two populations**, distinguished not by a capability but by which tree they live in and how they sync:

- **The business tree** — Assets / Nodes / Fields / Jobs / Logbooks / Persons. Per-asset-tree user data with full **business history** ("who changed this torque value, when"). This is what the app is *about*.
- **The Library** — the authored **Definitions** (a.k.a. **Templates**) that instances are minted from. Globally shared, with its own edit history so a Definition can *evolve in place* rather than a Field dying when superseded — but **not** business history; who minted a Definition is irrelevant to an Asset.

**Turtles all the way down in *mechanism*; two trees in *population*.** Both populations are built from the same recursive Element+capability machinery (children, LWW, history); they differ only in tree and sync rules. So a `FieldDefinition` is **not** a business Element (Q3 answered: *no*) — yet it is edited through the same Treeview and built from the same parts.

### Definition generalizes (FieldDefinition → Definition / Template)

`FieldDefinition` was Fields-only. The concept generalizes to **any kind whose instances benefit from a reusable, named, configured shape**: a *Daily Inspection* Logbook, a *Work Order* Job, an *HPU-with-Accumulator* template (the word "Template" `LATER.md` already reserves). There is **no separate `NodeDefinition` type** — there is one `Definition` concept, per-kind, optional. Plain ad-hoc Assets need none; you just make one.

A Definition lives in the Library population and declares the **configured** form of a kind: its config values (units, enum options, colours), and — crucially — its **child policy** (which `template` / `open` children its instances get). This is where "what children may a Log Entry have" is authored: in the Log-Entry Definition, not hardcoded and not user-grown willy-nilly.

### Meta-fields, and why the turtles terminate

A Definition's configurable knobs are themselves modeled as child Fields — **meta-fields** — editable, add/removable, history-tracked and LWW'd like any Field (in the Library's history, not the business tree's). Config that can have config gives **meta-meta-fields**: a *Water Level* `number-kv` with a *Low Warn* threshold that itself carries an *alert type* / *notification channel* / *display colour*.

The recursion is real but **structurally terminating**: every child set — at every level — is **policy-declared** by a manifest `template` or a kind-constrained `open` bag; it is never a free, user-grown tree. A meta-meta-field bottoms out because its manifest declares no further config worth exposing (an *alert type* is an `enum-kv` with a fixed option list and nothing beneath it). Turtles stop where a manifest says "no more turtles" — sanity is guaranteed by construction, not by a remembered rule. Depth is bounded by developer-authored manifests, not by users.

---

## Contemplated kinds (catalogue)

The catalogue of needs the model must absorb. Each row is a capability subset; if it reduces without special-casing, it is sound. Detailed specs follow in *Per-kind specifications*. "Status" is `current` (built or capability subset settled) / `describe` (subset settled, build deferred) / `open` (a question remains in the spec below).


| Kind                              | Category                  | Capability subset                                                | Placement            | Status   |
| --------------------------------- | ------------------------- | ---------------------------------------------------------------- | -------------------- | -------- |
| **(base row)**                    | origin                    | `{}`                                                             | `inline`             | current  |
| **node**                          | tree                      | `Children(open)`                                                 | `re-root`            | current  |
| **text-kv / enum-kv / number-kv** | stored field              | `OwnValue`                                                       | `inline`             | current  |
| **image**                         | stored primitive          | `OwnValue(blob)`                                                 | `inline`             | describe |
| **image-with-caption**            | composite                 | `Children(template)`                                             | `inline`             | describe |
| **equipment-plate**               | composite (at scale)      | `Children(template)`                                             | `inline`             | open     |
| **usage-annotated field**         | field + author guidance   | `OwnValue + Children(template)`                                  | `inline`             | describe |
| **asset-gallery**                 | aggregator                | `Derivation + Reads.resolver`                                    | `inline`             | describe |
| **asset-doc**                     | in-link                   | `Edges(internal,live) + Reads.resolver`                          | `inline`             | describe |
| **part-supplier-link**            | out-link                  | `Edges(external)`                                                | `inline`             | describe |
| **other-end**                     | virtual-parent appearance | `Edges(internal,virtual) + Reads.resolver`                       | `inline` / `re-root` | describe |
| **approval**                      | version reference         | `Edges(internal,revision) + Reads.resolver`                      | `inline`             | describe |
| **labeled inline edge**           | annotated reference       | `Edges + Children(template)`                                     | `inline`             | open     |
| **maintained edge**               | derived reference         | `Edges(derived target) + Derivation`                             | `inline`             | open     |
| **inherit-unless-override**       | cascading value           | `OwnValue + Derivation + arbiter`                                | `inline`             | describe |
| **value-chart**                   | stored, graphical         | `OwnValue + Reads.historyStream`                                 | `inline` (lazy)      | describe |
| **intrinsic node scalar**         | node with own value       | `Children + OwnValue`                                            | `re-root`            | describe |
| **logbook**                       | node behavior             | `Children(open: ['log-entry'], aggregates, autoProvision)`       | `re-root`            | describe |
| **log-entry**                     | bounded node              | `Children(template: body + tag/flag tails)`                      | `inline`             | describe |
| **job**                           | node behavior             | `Children(open, logical, autoProvision)`                         | `re-root`            | describe |
| **person**                        | node behavior (identity)  | `Children(open)`                                                 | `re-root`            | describe |
| **cross-tree action**             | action (dangerous)        | `Action(cross-tree)`                                             | `inline`             | open     |


---

## Per-kind specifications

### `image` / `image-with-caption` (stored primitive + minimal composite)

`image-with-caption` is one image with a free-text caption, modeled as the smallest possible composite (a `Children(template)` of two). It is the decomposed form of today's `single-image` stub and retires the "single-image is a latent 2-part composite" debt in `LATER.md`.

Decomposing single-image yields a bare **`image`** primitive: `OwnValue` with value `{ blobId, mimeType, width, height, byteSize }` (no caption). Caption is just a `text-kv`. The old bundled `SingleImageValue` object disappears, and the reference-equality bugs it caused (over-captured history, mis-gated revert) disappear with it, because each sub-value is a primitive again.

```
Element(kind: 'image-with-caption')              // Children(template) parent, no own value
 ├─ Element(kind: 'image',   name: 'Image')      // OwnValue(blob)
 └─ Element(kind: 'text-kv', name: 'Caption')    // config: { maxLength: 140 }
```

```ts
const imageWithCaptionManifest: KindManifest = {
  kind: 'image-with-caption',
  pickerLabel: 'Image + Caption',
  placement: 'inline',
  children: {
    spec: { template: [
      { kind: 'image',   label: 'Image',   cardinality: 'one' },
      { kind: 'text-kv', label: 'Caption', cardinality: 'one', config: { maxLength: 140 } },
    ] },
    onCreate: (parentId) => [ /* image + caption drafts, deterministic ids */ ],
  },
  Renderer: ImageWithCaptionField,   // lays out the two child renderers
  // no ownValue → no defaultConfig/ConfigForm/displayPreview; this composite has no own value
};
```

- **Creation is atomic multi-Element.** Minting the field mints the parent + both `cardinality:'one'` template children in one transaction, with deterministic child ids (`${parentId}:image`, `${parentId}:caption`). One commit, one rollback boundary.
- **History is per-child, free.** A caption edit writes history on the caption child; an image swap writes history on the image child. The recursive model pays off here with zero extra machinery.
- **The parent renderer composes child renderers** — it positions `getKindManifest('image').Renderer` and `getKindManifest('text-kv').Renderer`. The framework provides a "render this child Element by its manifest" entry point the composite renderer calls.
- **`children.spec.template` declares structure, not values** — which children exist, their kinds, labels, per-child config. A configurable composite (variable child set) is a later concern.

### `equipment-plate` (composite, at scale) — *open*

Grid of `Label : Value` children (Manufacturer / Model / Serial / …). Stresses `Children(template)` beyond two children; `placement: inline`. **Open:** fixed vs. user-configurable child set — a configurable composite needs a non-trivial authoring form and runtime template editing, which `image-with-caption` deliberately avoids. (When configurable, the child policy is declared by a *Definition*, per *Two populations*.)

### `usage-annotated field` (`OwnValue + Children(template)`)

A stored field (e.g. `number-kv`) that also carries fixed author-guidance children — *usage instructions*, *tooltip*, *help* — each a `text-kv`, each editable and history-tracked like any Element. This is the diagonal the old `nature` enum forbade: own value **and** fixed sub-structure.

```
Element(kind: 'number-kv-annotated')   // OwnValue(number) + Children(template)
 ├─ value: 42                          // the field's own value
 ├─ Element(kind:'text-kv', name:'Usage',   cardinality:'one')
 ├─ Element(kind:'text-kv', name:'Tooltip', cardinality:'one')
 └─ Element(kind:'text-kv', name:'Help',    cardinality:'one')
```

Note on level: usage/tooltip/help are **author guidance written once on the Definition**, not per-instance value data — so they are **meta-fields on the FieldDefinition** (Library population), not children of every placed instance. That is exactly the *Two populations* resolution: the guidance lives once on the Definition, edited via the same Treeview with the Library's own history. The `OwnValue + Children(template)` shape here is the general model the diagonal proves the manifest admits; the chosen realization is definition-side meta-fields.

### `asset-gallery` (aggregator, `Derivation + Reads.resolver`)

A gallery composed by traversing descendant Nodes for `image` / `image-with-caption` fields. `Derivation` → nothing stored, never synced, recomputed on read. Needs `SourceSpec` (`scope: 'descendants'`, `matchKinds: ['image','image-with-caption']`) and the resolver. The `compute` hook runs the scoped query and returns the assembled view value (not persisted).

### `asset-doc` (in-link, `Edges(internal,live) + Reads.resolver`)

An in-tree link from one Node to another internal `Element`. The smallest reference kind. Tapping it navigates to the target; the row renders the target's live identity.

```ts
const assetDocManifest: KindManifest = {
  kind: 'asset-doc',
  pickerLabel: 'Linked Doc',
  placement: 'inline',
  edges: {
    target: { scope: 'internal', allowedKinds: ['node'] },
    validateTarget: (candidate) => candidate.kind === 'node',
    ConfigForm: AssetDocConfigForm,   // authors the target (edge config)
  },
  reads: { resolver: true },
  Renderer: AssetDocField,            // resolves targetId → renders target name/subtitle live
  // no ownValue → no displayPreview; the live target is rendered, not previewed
};
```

- **The value is the edge, nothing more** — `value: { targetId }`. The target's content lives in, and is owned by, the target Element.
- **Sync LWW's the edge, never the target.** Two users repointing the same `asset-doc` is an LWW race on `targetId` (fine); the target Node's content is never touched.
- **History records edge changes only.** Setting/repointing `targetId` is a `value` history entry on the `asset-doc` element; the target's own edits are *its* history.
- **The renderer reads beyond its own value** via the injected resolver (`reads.resolver`) to draw the target's name/subtitle live.
- **`inline` ≠ "not navigable".** `asset-doc` is `inline` (the link row lives on the Card) yet navigates on tap. Tap-navigation to a target is a reference behavior, orthogonal to `placement`.

### `part-supplier-link` (out-link, `Edges(external)`)

External URL reference. `target.scope: 'external'`, value `{ url }`. "Open out" behavior (new tab); no live fetch of target content; URL validation in the edge `ConfigForm`/value. No resolver (nothing internal to resolve). Validates the internal/external split of `TargetSpec`.

### `other-end` (virtual-parent appearance, `Edges(internal,virtual) + Reads.resolver`)

`virtualParents` is a first-class data-model property (SPEC → `{ parentId, siblingOrder, navMode, render }`, portal-vs-citation). `other-end` is the kind that surfaces the far end of that edge — "this element also lives under *that* parent." It reduces to `Edges` with no new primitive; `target.appearance` mirrors the overlay's `render`:

- `render: 'portal'` — a **navigable** appearance: the element shows up as a real child in the virtual parent's tree; tap navigates into it. One identity, many appearances, never a copy — edits write through to the single canonical element.
- `render: 'citation'` — a **non-navigable** inline reference row, like `asset-doc`.

**Authoring works from either end, but writes one edge** (the single `virtualParents` entry; the overlay is the source of truth — no second copy):

- `authorFrom: 'referrer'` — *adopt-here*. On a node's Data Card you add an *Other End* pointing at an existing element. Default `render: 'citation'`, upgradeable to `portal`.
- `authorFrom: 'target'` — *appears-also-under*. From the element itself you add an additional parent. Default `render: 'portal'`.
- `authorFrom: 'both'` — both entry points; they converge on the identical write.

**Data-model rule (Q5):** there is **one canonical `parentId`**; virtual appearances are overlay edges, not a second graph. A virtual parent sees the virtual child as its own child. Distinguish **detach** (remove a virtual appearance → element survives under its canonical parent) from **delete** (remove the canonical element → it and all appearances vanish). Moving an end edits a parent (canonical, or the virtual edge). No graph DB. **Open:** confirm the resolver/sync path treats this target-owned edge identically to a referrer-owned one.

### `approval` (version reference, `Edges(internal,revision) + Reads.resolver`)

An approval points at a **specific revision** of a Job / Task / Doc, not its live state: value `{ targetId, rev }` resolving to `${targetId}:${rev}` in `ElementHistory`. `target.pin: 'revision'`, `valid: { rule: 'pinned-rev-is-current' }`. The resolver-aware renderer compares the pinned rev against the target's current rev and renders **valid** vs **stale** ("approved @ rev 4 / target now at rev 7"). The edge is **immutable once set** — re-approving mints a new approval against the new rev rather than repointing, so the audit answers *what exactly was approved*. First edge-side consumer of `ElementHistory` (the mirror of `value-chart`'s stored-side read). **Open:** is "valid" only rev-staleness, or also state predicates (valid while the Job is in state X)? Scoped here to rev-staleness; general predicates are a future `ValiditySpec` rule.

### `labeled inline edge` (`Edges + Children(template)`) — *open*

A reference that carries its own local annotation, authored at the link site rather than on the target: a `part-supplier-link` with a "last verified" date and a "why this supplier" note; an `asset-doc` with a relationship label. The heavyweight version — reify the relationship as a navigable node with its own fields — already exists (a `node` with an `Edges` field). What this row adds is the **lightweight** version: an inline link row that owns one or two annotation children without being promoted to a navigable node. An association-class in embryo. **Open:** confirm render precedence (Asterisk 1) for an edge row that also renders annotation children.

### `maintained edge` (`Edges(derived target) + Derivation`) — *open*

An edge whose value is a single pointer, but the pointer is *computed and kept current* rather than hand-set: "responsible person = nearest ancestor with an assignee," recomputed as the tree moves. Not backlinks (a "used-by" panel is plain `Derivation` returning elements rendered as links — no new cell). It is a reference whose *target* is set by a traversal. **Open:** whether the derived target is recomputed on read (pure `Derivation`) or materialized + invalidated; and the arbiter between "computed pointer" and any manual override.

### `inherit-unless-override` (`OwnValue + Derivation + arbiter`)

A value computed by default but owned once set: criticality / owner / cost-center cascading down the asset tree unless a node pins its own; operating pressure defaulting to the parent system's rated pressure until a measured value is entered. The CSS-cascade / config-inheritance pattern, which asset hierarchies want widely. `arbiter: { rule: 'own-value-overrides-derivation' }`: value present → `OwnValue` is live and LWW'd; value absent → `Derivation` is live, recomputed, never stored. The element tracks whether it is currently overridden, and the **sync rule flips with that state** — which is exactly why a single static descriptor can't hold it and the arbiter is required.

### `value-chart` (stored, graphical, `OwnValue + Reads.historyStream`)

Same value type as `number-kv`, but the renderer plots the **history stream** rather than the current value. Validates that a renderer may read its own Element's `ElementHistory` (`reads.historyStream`); `lazy: true` (canvas/chart lib). **Open:** value-status (stale/warn/alarm) — is it a `ValueSpec` method or a `Reads.historyStream` capability, since it reads history? (See Open questions.)

### `intrinsic node scalar` (`Children + OwnValue`)

A node with an intrinsic value — a Job's status, a Logbook's open-count — read as a column rather than traversed into as a child field. Admitted *knowingly* (Asterisk 2: valid, flagged) for cheap rollup/filter ("all Jobs in state X", badge a Logbook). The alternative (purity: scalar as a child field + a denormalized index) is a query/perf call, not a model gap; the capability model permits both.

### `logbook` (node behavior) + `log-entry` (bounded node)

`logbook`: `Children(open: { childKinds: ['log-entry'] }, aggregates: SourceSpec(subtree, ['log-entry']), container: physical, autoProvision: propagate-down)`. A Logbook is a node whose children are Log Entries. Its card shows **its own direct entries and a rollup of its descendants' entries** — an entry authored locally at any node surfaces on every ancestor Logbook without losing where it was written (Q6: descendant rollup).

`log-entry`: a node with a **bounded** child policy (`Children(template + kind-constrained tails)`, `placement: inline`) — embracing the composite/node collapse (Q4). Its parts are child Elements (each with its own history): a **body** (singleton `text-kv`) plus **collections** of tags / flags / ratings / @-mentions (`cardinality: 'many'`, kind-constrained — the fixed core + open tail, now internal to one `ChildrenSpec`). The child set is declared by the **Log-Entry Definition**, not user-grown willy-nilly (*Two populations*). 

**Per-field edit policy (new, Q6).** The body is editable **only by the original author**; flags / ratings / etc. may be **others-editable** — a per-field authorization that is itself **config** (a meta-field on the Definition), not a new capability. All of it is business data with history.

Cross-cutting services — notifications, bubbling alerts, action icons, @-mention *delivery* — are systems over entries, **not** structural children; deferred and kept out of the template. (Bubbling alerts is the same descendant-propagation concept as the Logbook rollup — a system, not a field.)

### `job` (node behavior)

`Children(open, container: logical, autoProvision: synthetic-container)`. A Job is a sub-asset-like Node attachable under whatever Node needs the work, carrying an open, user-grown Field set: due date, costs, materials, skills, risk assessment, scope, work descriptions, goals, plus child sub-jobs. The canonical contrast: Job is a *node behavior you navigate into*, vs. Equipment Plate's *inline composite field*.

- **Assignee is not part of the Job kind.** A person assigned to a Job is an ordinary `Edges` field on the Job's card (`target.allowedKinds: ['person']`) — the same in-link machinery as `asset-doc`, constrained to `person` targets. The Job manifest hardcodes no assignee slot.
- **The Jobs container is a rollup, not a parent.** `autoProvision: synthetic-container` mints a per-asset **Jobs container** Node whose `aggregates` (`scope: subtree, matchKinds: ['job']`) surfaces every descendant job at the asset root — identical machinery to the Logbook rollup, over navigable `job` nodes instead of inline `log-entry` parts. Job's own `aggregates` stays `no`; the aggregation lives on the synthetic container.

### `person` (node behavior, identity)

`Children(open: { childKinds: '*' })` — **not a leaf**. A Person has ordinary child Nodes (e.g. a *Qualifications* node holding individual *Qualification* children) alongside its Data Card of Fields (name, role, contact). Its traits are *identical to the base Asset node*: Person is the **trait-degenerate behavior**, earning a distinct `Kind` by **identity** (Asterisk 3) — it is the canonical, nameable cross-`Element` reference target (assignee on a Job, author of a log entry; `allowedKinds: ['person']`) — not by any trait displacement.

### `cross-tree action` (`Action(cross-tree)`) — *open, dangerous*

An element that, when activated, **emits commands that affect a different part of the tree or the outside world** — order a part, mint a job elsewhere, fire a notification. The only kind built on the write/effect capability.

- **Reuses the CommandBus.** `action.run` dispatches `emits` against the existing command bus; its *effects* are ordinary Element mutations (a new `job` appears elsewhere, with its own history). The action element itself stores no value.
- **Not self-CRUD.** Editing one's own value is `OwnValue` + the edit UI, not an action (Asterisk 2: that combination is invalid as a "kind").
- **The dangerous one.** Imperative, not declarative — outside the convergent-state model — so **non-idempotent under offline replay**. Requires `idempotencyKey` (exactly-once) and `confirm`. **Build last; likely never user-authorable** (authoring arbitrary cross-tree effects is a power most users should not have). Specced here for completeness, per the closed-set discipline.

---

## Resolved decisions

These settle the former Open Questions Q1–Q6 and the capability-set discussion.

- **Capability set is closed and small (Open/Closed).** Six: **OwnValue · Children · Edges · Derivation · Reads · Action**. Adding a kind is cheap; adding a capability is a deliberate framework change. A need is a new capability only if it introduces a sync rule or a read/compute/**write** path none of the six has.
- **`Children` merges Composition + TreeBehavior.** One capability for "this Element has children," with a `ChildrenSpec` that may carry a `template`, an `open` bag, or both. Removed a cross-capability arbiter (Asterisk 1). `placement` carries the inline-vs-re-root UX distinction.
- **`Action` is the sixth capability — the only write/effect path.** Imperative command (reuses the CommandBus); effects are ordinary Element mutations. Non-idempotent under offline replay → needs `idempotencyKey` + `confirm`. Build last; likely never user-authorable.
- **Two populations, one substrate (Q3 answered: *no*).** `FieldDefinition` is **not** a business Element. The Library and the business tree are two populations over the same Element+capability mechanism; Definitions/Templates generalize across kinds; meta-field recursion terminates structurally. See *Two populations and Definitions*.
- **Q1 — `ValueSpec` defined.** `OwnValue`'s descriptor holds everything that presupposes an own value: value default / validate / equals / `displayPreview` **and** the value config schema (`defaultConfig` / `validateConfig` / `ConfigForm`). These moved off the top-level manifest into `ownValue`, so value-less kinds omit them. The *concrete* configured values (units="psi", decimals=2) remain per-Definition data, not in `ValueSpec`.
- **Q2 — `coherence` is per-manifest for now.** Each kind validates its own capability set; extract to a central rule engine once many kinds exist.
- **Q4 — embrace the collapse.** Resolved by the `Children` merger: do not police "composite vs node." Child policy (`template` / `open`, kind constraints) is declared per kind; most kinds bottom out shallowly.
- **Q5 — one canonical parent, overlay appearances; no graph DB.** Distinguish **detach** (remove an appearance) from **delete** (remove the canonical element). Moving an end edits a parent. Single canonical `parentId`.
- **Q6 — Logbook is a descendant rollup.** Logbook = node of Log Entries; Log Entry = bounded node (body + tag/flag children) whose child set is declared by its Definition. Body is author-only-editable; flags/etc. may be others-editable — a per-field edit policy that is itself config (a meta-field). All business data with history.

## Open questions

1. **Arbiter & auto-provision classification.** Is `ArbiterSpec` a closed set of pairwise rules or a general resolver? Is `autoProvision` a `Children` sub-property (as now) or its own capability a non-tree kind might want?
2. **`value-chart` / `status`.** Does value-status (stale / warn / alarm) live as a `ValueSpec` method or as a `Reads.historyStream` capability, since it reads history? (Loops back to the capability-vs-kind test.)
3. **`other-end` target-owned edge** — confirm the resolver/sync path treats a target-owned edge identically to a referrer-owned one.
4. **Action exactly-once** — the offline-replay idempotency mechanism (keys, dedupe window) for `Action`, when it is eventually built.
5. **`equipment-plate` / configurable composites** — fixed vs. user-configurable child set, and the Definition-side authoring UI it implies.
6. **`labeled inline edge` render precedence** — layout for an edge row that also renders annotation children (Asterisk 1, the remaining render-precedence case).

---

## Project Context Management

This is a planning/docs document; the "implementation" is this file. As sections settle and are reviewed:

1. **SPECIFICATION.md** — migrate the settled **Capability Model** (the manifest, the three asterisks, the validity rules, the resolver contract, the two populations) into the main spec under DataField Components.
2. **LATER.md** — remove the now-superseded notes: "Renderer registry — Phase 2", "`single-image` is a latent 2-part composite", the Phase-2 FieldComponents promoted into the catalogue, and any reference/composite notes folded into this doc.
3. **ISSUES.md** — file the implementation work items that fall out of the settled API (start with `base + ownValue + children(template)`, then the resolver for `edges`/`derivation`).
