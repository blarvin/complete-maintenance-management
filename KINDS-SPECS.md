# KINDS-SPECS.md — Field Kinds, the Registry, and the Manifest API

***Intent:*** *the `Element` model makes new surfaces cheap; this document is where we design the plugin seam that keeps them honest — one manifest per kind, against one registry, proven by several concrete kinds.*

> **Status: planning / locking.** This file develops the shape of *kinds*, the *registry/manifest* API, and worked examples that stretch the architecture. It is deliberately separate from `SPECIFICATION.md` so the kind catalogue does not bloat the main spec. Once the API and the example kinds are locked here, the API section migrates into `SPECIFICATION.md` and the relevant deferred notes are removed from `LATER.md`.
>
> Read `SPECIFICATION.md → Concepts & Vocabulary` and `→ DataField Components and Crowdsourced Library` first — this document assumes that vocabulary (surface vs. storage; `Element` / `kind` / `Renderer` / `FieldDefinition` / `FieldComponent`; the FieldComponent → FieldDefinition → DataField hierarchy) and does not restate it.

---

## Why these example kinds

The unified `Element` model (one recursive record, drawn by the renderer its `kind` selects) makes it *cheap* to add surfaces. The risk is that cheapness dissolves the product into a featureless soup. The discipline (per SPEC's design invariant) is that every new surface enters as **a variety of Field** or **a behavior of Node** — never a new primitive.

The eleven kinds below are not a grab-bag. Each one either forces **one specific seam** that today's flat `KindManifest` (`src/kinds/`) lacks, or **confirms** that an existing model property reduces onto the API without a new slot. If the registry/manifest API designed here absorbs all of them **without special-casing**, the API is proven. That is the lock criterion for this document.

Two probe roles, made explicit:

- **Extension probe** — forces a seam the current API can't express; produces an enumerated *Finding* and a new descriptor/contract.
- **Confirmation probe** — a property the model *already* has (e.g. `virtualParents` per SPEC) must fall out of the API with **no new primitive**. Failing to reduce cleanly is itself a finding.

### Seam map (all eleven)


| Kind                       | Category                   | `nature`          | `placement`          | Role     | The seam it forces / confirms                                                                |
| -------------------------- | -------------------------- | ----------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| **Single Image + Caption** | composite                  | `composite`       | `inline`             | extends  | sub-field seam, minimal (2 children); retires the single-image latent-composite debt (Finding A–C) |
| **Equipment Plate**        | composite                  | `composite`       | `inline`             | confirms | sub-field seam at scale (grid of `Label : Value` children); same seam as #1, no new slot     |
| **Asset Gallery**          | aggregator                 | `derived`         | `inline`             | extends  | computed value via descendant traversal; nothing stored → sync must not LWW it (Finding D)   |
| **Asset Doc**              | in-link                    | `reference`       | `inline`             | extends  | internal reference (target `Element` id); renders live content; edge is LWW'd, target is not (Finding D, E) |
| **Part Supplier Link**     | out-link                   | `reference`       | `inline`             | confirms | external reference (URL); "open out" behavior; no live fetch — the `external` arm of `TargetSpec` |
| **Other End**              | virtual-parent appearance  | `reference`       | `inline` / `re-root` | confirms | the `virtualParents` overlay (portal vs citation) reduces to a `reference` edge; one identity, many appearances; **no new primitive** (Finding I) |
| **Approval**               | version reference          | `reference`       | `inline`             | extends  | reference pins a **history revision** `${id}:${rev}`; validity = pinned-rev vs current-rev (**Finding H**) |
| **Key-Value + Chart**      | stored, graphical          | `stored`          | `inline`             | extends  | renderer reads the **history stream**, not just the current value; heavy → lazy              |
| **Logbook + Log Entry**    | node behavior + entry kind | `node` / `composite` | `re-root` / `inline` | extends  | generalize registry key to full `Kind`; append-only children; collection sub-fields (Finding G) |
| **Job**                    | node behavior              | `node`            | `re-root`            | confirms | `placement = re-root` (navigate *into* it); references a `person` (Finding D resolver)        |
| **Person**                 | node behavior              | `node`            | `re-root`            | confirms | leaf via `childKinds: 'none'`; the canonical cross-`Element` reference target                |


### Locked design decisions (this exercise)

1. **Composites are recursive child Elements.** A composite is a parent `Element` whose sub-fields are real child `Element`s, distinguished by `kind`. Per-sub-field history and sync come for free; this matches the single-image / `nodeSubtitle` decomposition direction already noted in `LATER.md`. Cost accepted: atomic multi-Element creation and a card-vs-header render-region split.
2. **Node behaviors are first-class kinds, but all share `nature: 'node'`.** Logbook / Job / Person are promoted to `Kind` values (`kind: 'logbook' | 'job' | 'person'`) registered in the *generalized* registry alongside fields. They are **not** distinct natures — every one is `nature: 'node'` (recursive + navigable, framework-owned). What differs is a small bundle of **traits** (see *Node behaviors as trait bundles* below). The registry **key** widens to the full `Kind` union so behaviors can register; `node` stays framework-privileged.
3. **Drafting order:** probe-kinds first (this draft), then extract and lock the API, then fill the remaining nine (two fully drafted, nine stubbed).
4. **References are one `nature`, three target shapes.** `asset-doc` (live internal), `part-supplier-link` (external URL), `other-end` (virtual-parent appearance), and `approval` (revision-pinned) are all `nature: 'reference'`. The exercise is whether one `TargetSpec` covers all four arms without special-casing; if it splinters, `reference` needs sub-typing. (Result: it holds, after adding `pin` for Finding H — see API section.)

### Node behaviors as trait bundles

The "double duty" worry — that `nature: 'node'` means both "the privileged framework kind" and "the nature of behaviors like Job" — dissolves once you see that **the plain Asset node is the degenerate behavior**. Every navigable kind shares exactly two things: it is *recursive* and *navigable*. That is `nature: 'node'`, owned by the framework. Where the behaviors differ is a `node` trait descriptor:


| Trait                                  | Asset node | Logbook                                 | Job                                          | Person        |
| -------------------------------------- | ---------- | --------------------------------------- | -------------------------------------------- | ------------- |
| **childKinds** — what may be a child   | `*`        | `log-entry` only                        | job-related / `*`                            | `none` (leaf) |
| **aggregates** — rolls up descendants? | no         | **yes** (log entries, all the way down) | no                                           | no            |
| **container**                          | physical   | physical                                | **logical**                                  | physical      |
| **autoProvision**                      | —          | propagate down the subtree              | auto-group into a synthetic *Jobs* container | —             |


```ts
// PROVISIONAL — the `node` descriptor slot
type NodeBehaviorSpec = {
  childKinds: '*' | Kind[] | 'none';   // permitted child kinds (tree + card)
  aggregates?: SourceSpec;             // node-scoped rollup; SAME SourceSpec as `derived` fields
  container: 'physical' | 'logical';
  autoProvision?: AutoProvisionSpec;   // see Finding F — described now, deferred to build
};
```

Two consequences worth stating outright:

- **The base `node` is the origin of the trait space**, not a special case beside the behaviors: `{ childKinds: '*', container: 'physical' }`, no aggregation, no auto-provision. Variety is displacement from that origin — no new primitive is introduced, satisfying the design invariant.
- **Logbook's rollup reuses the aggregator's `SourceSpec` exactly.** "Shows the logs for all items below" is a descendant traversal + match — identical to the `derived` `asset-gallery` field, scoped to a node's subtree rather than a field. One traversal concept, two consumers (node-scoped and field-scoped). *(Open: is the Logbook card the whole rollup, or its own direct entries alongside a rollup of descendants?)*
- **Person validates the leaf case:** `childKinds: 'none'` means no child *nodes*, yet a Person still has a Data Card of Fields (name, role, contact) — because "child nodes" and "card fields" are both child Elements partitioned by kind. Leaf-ness is a `childKinds` policy, not a different primitive.

---

## Provisional manifest shape (to be hardened after the probes)

This is the **working sketch** the probe kinds below are written against. It extends the real `KindManifest` in `src/kinds/types.ts`. Treat every field as provisional until the "Registry & Manifest API" section is written from the findings.

```ts
// PROVISIONAL — generalizes src/kinds/types.ts KindManifest
type KindManifest = {
  kind: Kind;                       // generalized from ComponentType → full Kind
  pickerLabel: string;

  // --- the two orthogonal axes ---
  nature: 'stored' | 'composite' | 'derived' | 'reference' | 'node';
  placement: 'inline' | 're-root';

  // --- rendering / authoring (today's fields) ---
  Renderer: Component<FieldRendererProps>;
  ConfigForm: Component<ConfigFormProps>;
  defaultConfig: () => FieldDefinitionConfig;
  displayPreview: (value: DataFieldValue | null) => string | null;

  // --- nature-specific descriptor slots (exactly one applies) ---
  composition?: SubFieldSpec[];     // nature: 'composite'
  source?: SourceSpec;              // nature: 'derived'
  target?: TargetSpec;              // nature: 'reference'
  node?: NodeBehaviorSpec;          // nature: 'node' (behaviors; base node = degenerate)

  // --- mechanical ---
  lazy?: boolean;                   // heavy renderers loaded on demand
};
```

The sync layer reads `nature` to decide LWW: `stored`/`composite` children are LWW'd on their own value; `derived` is never stored, never synced; `reference` LWW's only the *edge* (the pointer), never the target's content. This is the `nature: data | reference` field LATER already called for, widened to four cases.

---

## Probe kind #1 — `image-with-caption` (composite, minimal)

**Purpose**: one image with a free-text caption, modeled as the smallest possible composite. This is the explicit, decomposed form of today's `single-image` stub, and **retires the "single-image is a latent 2-part composite" debt** documented in `LATER.md`.

### What the decomposition reveals

Today `single-image` crams two independent edit intents into one `value` object: *swap the image* (blob + derived `mimeType`/`width`/`height`/`byteSize`, all changing atomically) and *edit the caption* (free text). Decomposing it surfaces a **new primitive need**: a bare `image` stored kind that holds *only* the blob identity, with no caption. Caption is just a `text-kv`.

> **Finding A — new primitive `image`:** decomposing single-image yields a pure `image` stored kind. Value: `{ blobId, mimeType, width, height, byteSize }` (the caption field drops off). The old bundled `SingleImageValue` object disappears; the reference-equality bugs it caused (over-captured history, mis-gated revert) disappear with it, because each sub-value is a primitive again.

### Shape

```
Element(kind: 'image-with-caption')        // composite parent, no own value
 ├─ Element(kind: 'image',   name: 'Image')    // blob-only primitive
 └─ Element(kind: 'text-kv', name: 'Caption')  // config: { maxLength: 140 }
```

```ts
const imageWithCaptionManifest: KindManifest = {
  kind: 'image-with-caption',
  pickerLabel: 'Image + Caption',
  nature: 'composite',
  placement: 'inline',
  composition: [
    { kind: 'image',   label: 'Image' },
    { kind: 'text-kv', label: 'Caption', config: { maxLength: 140 } },
  ],
  Renderer: ImageWithCaptionField,   // lays out the two child renderers
  ConfigForm: NoopConfigForm,        // composition is fixed; nothing to author
  defaultConfig: () => ({}),
  displayPreview: (/* parent has no own value */) => null,
};
```

### Behavior

- **Creation is atomic multi-Element.** Minting the field mints the parent + both children in one transaction (deterministic child ids, e.g. `${parentId}:image`, `${parentId}:caption`). One commit, one rollback boundary.
- **History is per-child, free.** A caption edit writes history on the caption child; an image swap writes history on the image child. The audit log distinguishes them with zero extra machinery — the recursive move pays off exactly here.
- **The parent renderer composes child renderers.** `ImageWithCaptionField` does not re-implement image or text editing; it positions `getKindManifest('image').Renderer` and `getKindManifest('text-kv').Renderer`. → **Finding B (composition seam):** a composite renderer must be able to *render child Elements by their own manifests*. The framework needs a "render this child Element" entry point the manifest can call.

> **Finding C — `composition` declares structure, not values.** The `SubFieldSpec[]` is a fixed authoring template: which children exist, their kinds, labels, and per-child config. It is *not* a value. The composite's `ConfigForm` is typically a no-op (the shape is fixed); authoring a *configurable* composite (variable child set) is a later concern — flag it, don't build it.

---

## Probe kind #2 — `asset-doc` (in-link, reference, minimal)

**Purpose**: an in-tree link from one Node to another internal `Element` (a document Node, a related asset). The smallest possible **reference** kind. Tapping it navigates to the target; the row renders the target's live identity.

### Shape

```ts
type AssetDocValue = { targetId: ID };   // the edge — just a pointer

const assetDocManifest: KindManifest = {
  kind: 'asset-doc',
  pickerLabel: 'Linked Doc',
  nature: 'reference',
  placement: 'inline',
  target: {
    scope: 'internal',          // resolves to an Element id (vs 'external' URL)
    allowedKinds: ['node'],     // optional constraint on valid targets
  },
  Renderer: AssetDocField,      // resolves targetId → renders target name/subtitle
  ConfigForm: AssetDocConfigForm,
  defaultConfig: () => ({}),
  displayPreview: (v) => /* resolved target name, live */ null,
};
```

### Behavior

- **The value is the edge, nothing more.** `value: { targetId }`. The target's content lives in the target `Element` and is owned there.
- **Sync LWW's the edge, never the target.** Two users repointing the same `asset-doc` is an LWW race on `targetId` (fine). The target Node's content is never touched by this field's sync. → this is precisely why `nature: 'reference'` must exist as a sync signal.
- **History records edge changes only.** Setting / repointing `targetId` is a `value` history entry on the `asset-doc` element. The target's own edits are *its* history. Clean separation, no cross-writing.
- **The renderer needs read access beyond its own value.** To draw the target's name/subtitle live, `AssetDocField` must *resolve another Element*. Today's `FieldRendererProps` is self-contained (`id`, `value`, `fieldName`…) — it has no resolver. → **Finding D (the big one):** reference and derived kinds break the "renderer is a pure function of its own value" assumption. The manifest/renderer contract needs a **resolver capability** (read other Elements / run a scoped query) injected for `nature: 'reference' | 'derived'`. This is the single largest API consequence of the whole exercise.

> **Finding E — `placement: 'inline'` ≠ "not navigable".** `asset-doc` is `inline` (the link row lives on the Card) yet *navigates on tap*. `placement` governs **where the kind's own surface is drawn** (on the parent's Card vs. re-rooted into its own view), not whether tapping moves the user. Tap-navigation to a *target* is a reference behavior, orthogonal to `placement`. Job is `re-root` because *Job itself* becomes the view; `asset-doc` stays `inline` because the link row itself stays on the card.

---

## Findings rollup (drives the API section)


| #   | Finding                                                                                                                        | API consequence                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Decomposing single-image yields a bare `image` primitive                                                                       | new `stored` kind `image`; retire `SingleImageValue` bundle                                                                                                                   |
| B   | A composite renderer must render its child Elements                                                                            | framework needs a "render child Element by its manifest" entry point                                                                                                          |
| C   | `composition` declares structure (kinds/labels/config), not values                                                             | `SubFieldSpec[]` slot; composite `ConfigForm` usually no-op                                                                                                                   |
| D   | Reference/derived renderers must read *other* Elements                                                                         | **resolver capability** injected into the renderer contract for `reference`/`derived`                                                                                         |
| E   | `placement` ≠ navigability                                                                                                     | document the axis precisely; navigation-on-tap is a reference behavior                                                                                                        |
| F   | Some kinds auto-create *other* Elements when they appear (Logbook propagates down; Jobs auto-group into a synthetic container) | new **auto-provisioning / lifecycle** dimension (`AutoProvisionSpec`) — *described* in the manifest now, *deferred* to build; the render/author/sync API doesn't depend on it |
| G   | A composite (`log-entry`) needs *collection* sub-fields (0..n tags / @-mentions) alongside *singletons* (one body)             | `SubFieldSpec` gains a **cardinality** (`one` \| `many`)                                                                                                                      |
| H   | A reference may pin a **specific history revision** of its target (`approval` → `${targetId}:${rev}`), not just the live element. Its **validity is a function of pinned-rev vs current-rev** — the approval goes *stale* when the target advances past the approved revision. | `TargetSpec` gains `pin: 'live' \| 'revision'`; reference value widens to `{ targetId, rev? }`. Introduces a **validity/staleness** concept: the resolver compares pinned vs current rev at read; the renderer surfaces "approved @ rev N / now at rev M → stale." First **reference-side** reader of `ElementHistory` (mirrors `value-chart`'s stored-side read). |
| I   | The `virtualParents` overlay (a first-class model property per SPEC: `{ parentId, siblingOrder, navMode, render }`, portal vs citation) must reduce onto `nature: 'reference'` with **no new primitive** — confirming the SPEC claim that "`virtualParents`, the cross-linked field, and the in-link all reduce to one edge." | *Confirmation, not extension.* `other-end` is the reference whose edge **is** a `virtualParents` entry. `render: 'portal'` → navigable tree appearance (acts like `re-root` at the other end); `render: 'citation'` → non-navigable inline row (like `asset-doc`). No new slot; `placement`/`navMode` already span it. The probe's job is to prove the reduction holds. |


---

## Registry & Manifest API

Extracted and hardened from the probes (Findings A–G) and the trait model. This is the locked plugin seam: **one manifest per kind, one registry, exhaustiveness-checked.** Adding a kind is the *only* place the framework learns about it.

### The registry

Generalize today's `Record<ComponentType, KindManifest>` to the full `Kind` union. `node` is registered but **framework-privileged**: its recursion/navigation live in the framework (TreeNode), and its manifest carries only the base `NodeBehaviorSpec` (`childKinds: '*'`, physical, no aggregation). Behavior kinds (`logbook`/`job`/`person`) register beside it.

```ts
export const KIND_REGISTRY = {
  node: nodeManifest,                 // framework-privileged; base of the trait space
  'text-kv': …, 'enum-kv': …, 'number-kv': …,
  image: imageManifest,               // Finding A — bare blob primitive
  'image-with-caption': …, 'equipment-plate': …, 'log-entry': …,   // composite
  'asset-gallery': …,                 // derived
  'asset-doc': …, 'part-supplier-link': …,                          // reference (live internal / external)
  'other-end': …,                     // reference — virtualParents appearance (Finding I)
  approval: …,                        // reference — revision-pinned + validity (Finding H)
  'value-chart': …,                   // stored, lazy, history-reading
  logbook: …, job: …, person: …,      // node behaviors
} satisfies Record<Kind, KindManifest>;
```

`Kind` and `DataFieldValue` are **derived from** the registry, not hand-maintained beside it (closes LATER registry item (f)): a missing or mistyped kind is a compile error.

### The two axes (locked semantics)

`**nature`** — what the value *is*, and therefore how sync treats it:


| `nature`    | Value                                                                                     | Sync / LWW rule                                                                      | Kinds                                          |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `stored`    | owned data on this Element                                                                | LWW `value` by `updatedAt`                                                           | text/enum/number-kv, image, value-chart        |
| `composite` | none (parent has no `value`); structure is the fixed `composition`; children are Elements | parent's `value` is null (nothing to LWW); **each child LWW'd on its own**           | image-with-caption, equipment-plate, log-entry |
| `derived`   | none — computed at read by traversal (`source`)                                           | **never stored, never synced, never in history**                                     | asset-gallery; logbook's rollup                |
| `reference` | an *edge*: internal Element id (live or rev-pinned), external URL, or a `virtualParents` appearance | **LWW the edge only**; the target's content is owned by the target and never touched. A rev-pinned edge (`approval`) is **immutable once set** — repointing mints a new approval | asset-doc, part-supplier-link, other-end, approval |
| `node`      | none on the node itself; recursion is framework                                           | `name`/`subtitle`/structural props LWW'd as today; children are independent Elements | node, logbook, job, person                     |


`**placement*`* — where the kind draws *its own* surface:

- `inline` — on the parent's Data Card (all fields, composites, the gallery, both reference kinds).
- `re-root` — becomes its own view; you navigate *into* it (node + all behaviors).

`**placement` is orthogonal to navigation-on-tap (Finding E).** A `reference` is `inline` yet navigates to its *target* on tap; that's a reference behavior, not a placement. `placement` only says where *this* kind's surface lives.

### Renderer contract + resolver capability (Finding D)

Today's `FieldRendererProps` is self-contained — correct for `stored`/`composite`, which keeps them pure and trivially testable. `reference` and `derived` renderers additionally receive an injected **read-only** resolver; `stored`/`composite` renderers do **not** (so purity is preserved by construction):

```ts
type ElementResolver = {
  get(id: ID): Promise<Element | null>;                    // reference: resolve target
  query(spec: SourceSpec, root: ID): Promise<Element[]>;   // derived: scoped traversal
};
// injected into FieldRendererProps only when nature ∈ { reference, derived }
```

The resolver never mutates — it is the read capability and nothing more.

### Descriptor types (exactly one applies per manifest)

```ts
// composite — Findings C + G
type SubFieldSpec = {
  kind: Kind;
  label: string;
  cardinality: 'one' | 'many';        // singleton (body) vs collection (tags, @-mentions)
  config?: FieldDefinitionConfig;
};

// derived fields AND node.aggregates — one concept, two consumers
type SourceSpec = {
  scope: 'children' | 'descendants' | 'subtree';
  matchKinds: Kind[];                 // gallery: ['image','image-with-caption']; logbook: ['log-entry']
  // future: predicate/filter, ordering
};

// reference — Findings D, E, H, I
type TargetSpec = {
  scope: 'internal' | 'external';     // internal → Element id; external → URL
  pin?: 'live' | 'revision';          // Finding H — 'revision' pins ${targetId}:${rev}; default 'live'
  appearance?: 'portal' | 'citation'; // Finding I — virtualParents render mode (other-end); default 'citation'
  allowedKinds?: Kind[];              // internal only: valid target kinds
  valid?: ValiditySpec;               // Finding H — when the edge counts as valid (e.g. pinned-rev current)
};

// reference value shapes (discriminated by scope/pin)
//   internal, live:     { targetId: ID }
//   internal, revision: { targetId: ID, rev: number }   // approval
//   internal, virtual:  a virtualParents entry { parentId, siblingOrder, navMode, render }  // other-end
//   external:           { url: string }

// Finding H — validity / staleness; DESCRIBED now, predicate engine DEFERRED
type ValiditySpec =
  | { rule: 'pinned-rev-is-current' }   // approval valid only while target hasn't advanced
  | { rule: 'always' };                 // live references (default)

// node behaviors (sketched earlier)
type NodeBehaviorSpec = {
  childKinds: '*' | Kind[] | 'none';
  aggregates?: SourceSpec;
  container: 'physical' | 'logical';
  autoProvision?: AutoProvisionSpec;
};

// Finding F — DESCRIBED for completeness, DEFERRED to build
type AutoProvisionSpec =
  | { rule: 'propagate-down' }                          // logbook seeds down the subtree
  | { rule: 'synthetic-container'; container: Kind };   // job → minted Jobs container
```

### The locked manifest

```ts
type KindManifest = {
  kind: Kind;
  pickerLabel: string;
  nature: 'stored' | 'composite' | 'derived' | 'reference' | 'node';
  placement: 'inline' | 're-root';

  Renderer: Component<FieldRendererProps>;   // +resolver iff nature ∈ {reference, derived}
  ConfigForm: Component<ConfigFormProps>;    // no-op for fixed-structure composites
  defaultConfig: () => FieldDefinitionConfig;
  displayPreview: (value: DataFieldValue | null) => string | null;

  composition?: SubFieldSpec[];   // composite
  source?: SourceSpec;            // derived
  target?: TargetSpec;            // reference
  node?: NodeBehaviorSpec;        // node

  lazy?: boolean;                 // heavy renderers (value-chart canvas, gallery)
};
```

### Atomic multi-Element creation (composites)

Minting a composite mints the parent + every `cardinality: 'one'` child in **one transaction**, with deterministic child ids (`${parentId}:${labelSlug}`); `cardinality: 'many'` slots start empty and the user adds/removes instances at runtime (constrained to the declared `kind` — *not* an open card). One commit, one rollback boundary. This is the cost accepted in locked-decision #1, and it is shared by `image-with-caption`, `equipment-plate`, and `log-entry`.

### Adding a new kind (the plugin property)

1. Add the kind to the registry source of truth (the `Kind` union derives from it).
2. Drop a `src/kinds/<kind>.manifest.ts` declaring `nature`/`placement` + the one descriptor slot it uses.
3. Implement `Renderer` (resolver-aware iff `reference`/`derived`) and, if authorable, `ConfigForm`.
4. Register in `KIND_REGISTRY` → the `satisfies Record<Kind, …>` exhaustiveness check passes.

Nothing else in the framework changes. That is the plugin property this document set out to prove.

---

## Remaining kinds

*(Stubs — to be drafted against the locked API.)*

### `equipment-plate` (composite, at scale)

Grid of `Label : Value` children (Manufacturer / Model / Serial / …). Stresses the composition seam beyond two children; `placement: inline`. Open question: fixed vs. user-configurable child set.

### `asset-gallery` (aggregator, derived)

Gallery composed by traversing descendant Nodes for `image` / `image-with-caption` fields. `nature: derived` → nothing stored, never synced, recomputed on read. Needs `SourceSpec` (traversal scope + match predicate) and the resolver capability (Finding D).

### `part-supplier-link` (out-link, reference)

External URL reference. `target.scope: 'external'`. "Open out" behavior (new tab); no live fetch of target content; URL validation in `ConfigForm`/value. Contrast with `asset-doc` to validate the internal/external split of `TargetSpec`.

### `other-end` (reference — virtual-parent appearance) — *confirmation probe*

Not a new idea: `virtualParents` is a first-class data-model property (SPEC → `{ parentId, siblingOrder, navMode, render }`, portal-vs-citation). `other-end` is the **kind that surfaces the far end of that edge** — "this element also lives under *that* parent." `nature: reference`, with `target.appearance` mirroring the overlay's `render`:

- `render: 'portal'` — a **navigable** appearance: the element shows up as a real child in the virtual parent's tree, tap navigates into it (re-root at the other end). One identity, many appearances, never a copy — edits write through to the single canonical element.
- `render: 'citation'` — a **non-navigable** inline reference row, like `asset-doc`.

The probe **confirms** (Finding I) that this reduces to `nature: reference` with no new primitive — `placement`/`navMode` already span portal-vs-citation, and the canonical `parentId` stays the single home. Open: does authoring an `other-end` write the `virtualParents` entry on the *target* (graph overlay) or instantiate a reference field on the *referrer's* card? (Likely the former — the edge is the overlay, the field is its view.)

### `approval` (reference — version-pinned) — *extension probe (Finding H)*

An approval points at a **specific revision** of a Job / Task / Doc, not its live state: value `{ targetId, rev }` resolving to `${targetId}:${rev}` in `ElementHistory`. `nature: reference`, `pin: 'revision'`, `valid: { rule: 'pinned-rev-is-current' }`. The renderer (resolver-aware, Finding D) compares pinned rev against the target's current rev and renders **valid** vs **stale** ("approved @ rev 4 / target now at rev 7"). The edge is **immutable once set** — re-approving mints a new approval against the new rev rather than repointing (so the audit answers *what exactly was approved*). First reference-side consumer of `ElementHistory`, the mirror of `value-chart`'s stored-side read. Open: is "valid only under certain circumstances" *only* rev-staleness, or also state predicates (approval valid while Job is in state X)? Scoped here to rev-staleness; general predicates deferred to `ValiditySpec` future rules.

### `value-chart` (stored, graphical)

Same value type as `number-kv` but the renderer plots the **history stream** rather than the current value. Validates that a renderer may read an Element's own `ElementHistory`; `lazy: true` (canvas/chart lib). Open question: chart its own value-history vs. aggregate sibling values (likely own history).

### `logbook` (node behavior) + `log-entry` (composite)

`logbook` is a Node behavior: `nature: node`, `childKinds: ['log-entry']`, `**aggregates: SourceSpec`** (rolls up `log-entry` descendants), `container: physical`, `autoProvision: propagate-down`. Its Data Card shows **both its own direct entries *and* a rollup of descendant entries** — so an entry can be authored locally at any node and still surface on every ancestor Logbook without losing where it was written, and can be re-parented/attached elsewhere later.

`log-entry` is a **composite** (`nature: composite`, `placement: inline`) — *not* a node. The discriminator: a node is navigated *into* with an open, user-grown, recursive child set; a composite is an inline object with a kind-defined internal structure, expanded in place. With **no replies and no sub-entry recursion**, and rendering as a Field on the Logbook card, log-entry is the latter. Its parts are child Elements (so each carries its own history per locked-decision #1): a **body** (singleton `text-kv`) plus **collections** of tags and @-mentions, plus flag/action state. Same composite seam as `equipment-plate`, but mixing singleton and *collection* sub-fields (Finding G).

**Layered services, not parts of the kind:** notifications, bubbling alerts, action icons, and @-mention *delivery* are cross-cutting services over entries — *not* structural sub-fields, and they don't bear on the node-vs-composite call. (Bubbling alerts is the same descendant-propagation concept as the Logbook rollup — a system, not a field.) Deferred and logged separately; kept out of `log-entry`'s `composition`.

### `job` (node behavior)

`nature: node`, `container: logical` (a logical grouping, not a physical part — perfectly valid). Attachable as a child of any Node. `autoProvision`: any root Node with Jobs on itself or descendants gets a synthetic **Jobs container** Node. The canonical contrast: Job is a *node behavior you navigate into*, vs. Equipment Plate's *inline composite field*. References a `person` (assignee) — exercising cross-Element reference to a behavior-node (Finding D's resolver).

### `person` (node behavior)

`nature: node`, `**childKinds: 'none'`** (the leaf case — a Person has no child *nodes*, only Card Fields: name, role, contact). The canonical **reference target** (assignee on a Job, author of a log entry). Validates that leaf-ness is a `childKinds` policy, not a separate primitive, and that references can point at behavior-nodes.

---

## Project Context Management

This is a planning/docs branch; the "implementation" is this document. After the API and kinds are locked here and reviewed:

1. **SPECIFICATION.md** — migrate the locked Registry & Manifest API section into the main spec (under DataField Components).
2. **LATER.md** — remove the now-superseded notes: "Renderer registry — Phase 2", "`single-image` is a latent 2-part composite", the Phase-2 FieldComponents list entries promoted here, and any reference/composite notes folded into this doc.
3. **ISSUES.md** — file the implementation work items that fall out of the locked API.

