# ELEMENT-MODEL.md — The Kind Catalogue

This catalogues every **kind** the framework is meant to reach — one self-contained spec per kind. A kind is a `name` + a capability subset + descriptors + a renderer; it earns its place in the registry by composing non-trivial behaviour from the closed capability vocabulary.

**For the substrate, registry, manifest shape, the six capabilities, the descriptors, config-as-Elements, the cascade, typed trees, and chrome entailment — see `SPECIFICATION.md → Data Model`.** This file assumes that machinery and specifies only the kinds built on top of it. It uses storage words (`Element`, `kind`, `manifest`, `Renderer`, capability names); see `SPECIFICATION.md → Concepts & Vocabulary` for the surface↔storage mapping.

**Entry shape.** Each kind below gives: its **composition** (capability subset + descriptors), **placement** (`inline` row vs `re-root` view), **value shape** (if any), **config sub-fields** (for field-like kinds; config is child Elements, never a blob), **UX** (edit / display / validation), and **status**:

- `current` — built and settled.
- `describe` — composition settled, build deferred.
- `open` — a design question remains (see Open Questions).

---

## Catalogue at a glance

| Kind                          | Composition                                                       | Example                        | Placement        | Status   |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------ | ---------------- | -------- |
| (origin)                      | `{}`                                                             | a bare titled row              | inline           | current  |
| text-kv / enum-kv / number-kv | `OwnValue`                                                       | `Depth = 12.4 m`               | inline           | current  |
| node                          | `Children(open)`                                                 | `Pump P-101`                   | re-root          | current  |
| image                         | `OwnValue(blob)`                                                 | a nameplate photo              | inline           | describe |
| image-with-caption            | `Children(template: image + text-kv)`                            | photo + "south face"           | inline           | describe |
| internal-link                 | `Edges(internal, live) + Reads.resolver`                         | → O&M Manual (live)            | inline           | current  |
| external-link                 | `Edges(external)`                                                | → supplier's web page          | inline           | current  |
| other-end                     | `Edges(internal, virtual) + Reads.resolver`                      | "also lives under Pump House"  | inline / re-root | describe |
| approval                      | `Edges(internal, revision) + Reads.resolver`                     | "approved @ rev 4 (now rev 7)" | inline           | describe |
| asset-gallery                 | `Derivation(children/transitive → image) + Reads.resolver`       | every photo below, one place   | inline           | describe |
| value-chart                   | `OwnValue + Reads.historyStream`                                 | pressure, last 90 days         | inline           | describe |
| inherit-unless-override       | `OwnValue + Derivation(ancestors/transitive) + arbiter`          | `Criticality ← parent`         | inline           | describe |
| logbook                       | `Derivation(children/transitive → log-entry) + Provision` (lens) | all entries below here         | re-root          | current  |
| log-entry                     | `Children(template: body + tag/flag tails)`                      | "replaced seal" `#done`        | inline           | current  |
| job                           | `Children(open)`                                                  | Replace bearing (Open→Done)    | re-root          | current  |
| jobs                          | `Derivation(children/transitive → job) + Provision` (lens)       | all jobs below here            | re-root          | current  |
| org                           | `Children(open) + Derivation(children/transitive)`               | Maintenance Dept (12)          | re-root          | current  |
| person                        | `Children(open) + identity/overlay-anchor + target`              | Dave (assignee, account)       | re-root          | describe |
| logical-container             | `Edges(members, multi) + Reads.resolver`                         | Spare Parts (hand-picked)      | re-root          | describe |
| cross-tree action             | `Action(cross-tree)`                                             | "close all child jobs"         | inline           | open     |
| saved view                    | view-state overlay                                               | "my open jobs"                 | re-root          | open     |

---

# Field-like kinds (inline; lean on `OwnValue` / `Edges` / `Derivation`)

A field-like kind draws an inline row on its Node's Data Card and is edited in place. A field-like kind minted from the Library binds to its Library Definition by `definitionId`; its config lives as that Definition's child sub-field Elements (see `SPECIFICATION.md → Config is Elements`). The binding is kind-agnostic: a re-root *policy container* (`logbook`) binds a Definition through the same column, while leaf re-roots (`node`, `job`) carry null.

## origin

The empty composition — `{}`, a bare titled row (just `name`). Every kind is the origin displaced by a capability subset. **Status: current.**

## text-kv

**Purpose**: Free-form text. The Phase-1 default field.

**Composition**: `OwnValue(string)`. **Placement**: inline.

**Value shape**: `string | null`.

**Config sub-fields**:

| Sub-field   | Kind        | Default | Notes                     |
| ----------- | ----------- | ------- | ------------------------- |
| maxLength   | number-kv?  | 500     | Hard limit on input       |
| multiline   | flag        | false   | `true` renders a textarea |
| placeholder | text-kv?    | —       | Shown when value is empty |

**Edit UX**: Single-line input (or textarea if `multiline`). Double-tap activates edit. Enter saves, Escape cancels. If `multiline`, Enter inserts a newline and Cmd/Ctrl+Enter saves.

**Display UX**: Plain text; multi-line renders with preserved line breaks.

**Validation**: length ≤ `maxLength`.

**Status: current.**

## enum-kv

**Purpose**: Selection from a fixed option list (Status, Condition, Category, …).

**Composition**: `OwnValue(string ∈ options)`. **Placement**: inline.

**Value shape**: `string | null` — must match an `options` entry unless `allowOther`.

**Config sub-fields**:

| Sub-field  | Kind     | Default | Notes                                     |
| ---------- | -------- | ------- | ----------------------------------------- |
| options    | list     | —       | **Required.** Selectable values.          |
| allowOther | flag     | false   | If `true`, user may enter an ad-hoc value |
| default    | text-kv? | —       | Pre-selected on new instance              |

**Edit UX**: Dropdown. If `allowOther`, the final item is "Other…" which reveals a text input.

**Display UX**: Plain text. Option styling (badges, colours) is deferred.

**Validation**: value ∈ `options` (or `allowOther === true`).

**Status: current.**

## number-kv

**Purpose**: A numeric quantity with semantic units, display formatting, an expected nominal (range or discrete with tolerance), ISA-18.2-style alarm thresholds (L/LL/H/HH), and an optional freshness expectation. Covers Pressure, Temperature, Current, Voltage, Flow Rate, Weight, Power Rating, currency-denominated values, percentages, etc.

This is the deliberately rich field-like kind — its breadth of config exercises the Library-authoring UI's progressive-disclosure and value-driven conditional-reveal patterns. Other field kinds stay deliberately thin.

**Composition**: `OwnValue(number)` + a config subtree. **Placement**: inline.

**Value shape**: `number | null`. Units, format, thresholds, and refresh expectation are **not** stored per-instance — they are owned config copied from the Definition at mint (edit-is-fork). Unit conversion is deferred.

**Config sub-fields**:

| Sub-field                | Kind / shape | Required | Notes                                                                                          |
| ------------------------ | ------------ | -------- | ---------------------------------------------------------------------------------------------- |
| `unitsSymbol`            | enum-kv      | Yes      | Short unit token affixed to the value (`"V"`, `"psi"`, `"°C"`, `"kg"`, `"%"`, `"$"`); options keyed to quantity-kind |
| `unitsLongForm`          | text-kv?     | No       | Full unit name shown in Field Details / authoring preview (`"Volts"`, `"pounds per square inch"`) |
| `affixPosition`          | enum-kv      | No       | `"prefix"` / `"suffix"`                                                                          |
| `decimals`               | number-kv?   | No       | Display precision (default 2). Storage is full IEEE-754                                          |
| `displayFormat`          | enum-kv      | No       | `"decimal"` (default) / `"currency"` / `"percent"` / `"scientific"` / `"engineering"`           |
| `currencyCode`           | text-kv?     | Cond.    | **Required iff** `displayFormat === "currency"`. Free-text in Phase 1 (`"USD"`, `"EUR"`)         |
| `nominalMode`            | enum-kv      | No       | `"range"` (default) / `"discrete"`                                                               |
| `nominalMin` / `nominalMax` | number-kv? | Cond.   | Range-mode only. Bounds of the expected operating range                                         |
| `nominalValue` / `tolerance` | number-kv? | Cond.  | Discrete-mode only. Expected exact value ± acceptable deviation                                  |
| thresholds `{LL,L,H,HH}` | compound     | No       | Atomic compound sub-field (co-varying; one LWW'd object). ISA-18.2 thresholds                    |
| `expectedRefreshSeconds` | number-kv?   | No       | If set, a value older than this renders as **stale**. Stored in canonical seconds               |

The `{LL,L,H,HH}` cluster is the one place an object-valued config survives (a small atomic compound), because the values co-vary and a torn merge (`L > H`) would be dangerous. Everything else is an independent scalar sub-field.

**Config invariants** (enforced at Library-authoring time, via the threshold compound's `validate` or the kind's optional `ConfigForm`):

- **Range mode**: `LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH`. Any subset may be omitted; provided values must satisfy the chain.
- **Discrete mode**: `LL ≤ L ≤ (nominalValue − tolerance)` and `(nominalValue + tolerance) ≤ H ≤ HH`. `tolerance ≥ 0`.
- `decimals ≥ 0`. `expectedRefreshSeconds > 0` if set.
- `displayFormat === "currency"` ⇒ `currencyCode` non-empty.

**Authoring form — progressive disclosure** (the canonical exercise for the conditional-reveal patterns the wider Library-authoring UI reuses). Three tiers:

- **Required** (always visible): `unitsSymbol` (plus the surrounding `label` and `kind`).
- **Common** (collapsible "Display & nominal", expanded by default): `unitsLongForm`, `affixPosition`, `decimals`, `displayFormat`, `nominalMode` and the inputs it reveals.
- **Advanced** (collapsed "Alarms & freshness"): thresholds, `expectedRefreshSeconds`.

**Value-driven conditional reveal**:

- `displayFormat === "currency"` → reveal `currencyCode`; auto-default `affixPosition` to `"prefix"` (overridable).
- `nominalMode === "range"` → show `nominalMin`/`nominalMax`; hide `nominalValue`/`tolerance`. `"discrete"` flips it.
- `expectedRefreshSeconds` pairs a numeric field with a unit picker (`sec`/`min`/`hr`/`day`); resolves to canonical seconds on Save.
- Threshold inputs render as one visual chain so the `LL ≤ … ≤ HH` invariant reads at a glance; a violating value marks the offending input and blocks Save with an inline message naming the broken link.

**Edit UX**: Numeric input with the units affix shown statically. Helper text summarises the active nominal (`"Nominal 20–25 °C"` / `"Nominal 24 ±0.5 °C"`). For `percent`, the input accepts the underlying number (`0.42` displays `42%`); for `scientific`/`engineering`, decimal in, formatted on blur.

**Display UX**: `{prefix}{value}{suffix}` per `displayFormat` and `decimals`. Visual state, in precedence order:

- **stale** (shown if `expectedRefreshSeconds` set and `now − updatedAt > expectedRefreshSeconds`) — dimmed, subtle "stale" affordance. Takes precedence because freshness is a separate signal axis.
- **alarm** — outside `[LL, HH]` (or discrete equivalent). Strongest visual.
- **warn** — outside `[L, H]` but inside `[LL, HH]`.
- **ok** — inside the nominal band.

Subtle background colour in Phase 1; no icons.

**Validation**: input rejected outside `[LL, HH]` (or the discrete equivalent) if set. `L`/`H` and the nominal band are informational, not blocking.

**Status: current** (value path built; the full config subtree is `describe` pending config-as-Elements).

## image

**Purpose**: One image attached to a field (Asset Main Image, Nameplate Photo, Field Observation).

**Composition**: `OwnValue(blob pointer)`. **Placement**: inline. The bytes live in blob storage; the Element holds the reference.

**Value shape**:

```ts
{
  blobId: string;       // key into blob storage
  mimeType: string;     // "image/jpeg" | "image/png" | "image/webp"
  width: number;        // px
  height: number;       // px
  byteSize: number;
} | null
```

**Config sub-fields**:

| Sub-field   | Kind       | Default | Notes                                     |
| ----------- | ---------- | ------- | ----------------------------------------- |
| maxSizeMB   | number-kv  | 5       | Reject uploads above this size            |
| aspectHint  | text-kv?   | —       | e.g. `"4:3"` — display hint, not enforced |

**Storage**: blob payload in a separate Dexie table (`imageBlobs`), keyed by `blobId`; the Element stores only the metadata above. Firestore blob sync is deferred — Phase-1 images are local-device only.

**Edit UX**: Double-tap → file picker. Preview with "Replace" / "Remove". Save commits the new blob and writes history.

**Display UX**: Image at container width, respecting `aspectHint` if set. Tap opens a full-size modal (no zoom in Phase 1).

**Validation**: MIME in allowed set; `byteSize ≤ maxSizeMB · 1024 · 1024`.

**History**: stores the metadata object (including `blobId`), not the bytes. Replacing writes history; the prior blob is retained (orphaned-blob GC deferred).

**Status: describe** (Phase-1 ships a display stub; real blob upload deferred — see ISSUES.md). The old `single-image` kind — which crammed image + caption into one value object — is **superseded by `image` + `image-with-caption`** (the caption becomes a sibling `text-kv`, giving per-sub-value history for free).

## image-with-caption

**Purpose**: A captioned image — proof that a "single field" can be two sub-fields without a bespoke kind.

**Composition**: `Children(template: image "Image" + text-kv "Caption")`. **Placement**: inline. A `template` entry names only child **kind + label**; the structure is declared, the sub-field values are the children's own.

**UX**: the image renders per `image`; the caption per `text-kv`. Each carries its own history stream keyed by its own `elementId`.

**Status: describe.**

## internal-link

**Purpose**: A live link to another internal Element, resolved at read time — it shows the target's current state, never a copy.

**Composition**: `Edges(internal, live) + Reads.resolver`. **Placement**: inline.

**Value shape**: an Element `id` (the target). `pin: 'live'` — always resolves the target's current state.

**Named for its composition, not its use** (renamed from `asset-doc`, 2026-08-12). "Linked Doc" is the *Definition* label in the seeded library; "O&M Manual", "Drawing", "Parent Assembly" are others of this same kind. Nothing about the behaviour is document-specific — it is a live internal reference, and that is the whole of it. The internal twin of `external-link`.

**UX**: an inline reference row rendered from the resolved target. **Status: current** (v1 stub, #6b 2026-06-28 — the value is a raw element-id resolved live to the target's name; a real target picker, an allowed-target-kind config, and editing a saved link are tracked in ISSUES).

## external-link

**Purpose**: A link *out* of the app — a stored URL. The external twin of `internal-link`.

**Composition**: `Edges(external)`. **Placement**: inline. The value is `{ url }`; it opens in a new tab; there is no resolver (nothing internal to resolve). Together `internal-link` and `external-link` exercise both halves of `TargetSpec.scope`.

**Named for its composition, not its use** (renamed from `part-supplier-link`, 2026-08-12). "Part Supplier Link", "Datasheet" and "Manufacturer Page" are *Definitions* of this one kind, authored in the library and bound by `definitionId` — the same relationship "Linked Doc" has to `internal-link`. A supplier is domain typology, and by this file's own rule (→ *What is not a kind*) domain typology never becomes a kind. The behaviour is what earns the registry entry, and the behaviour here is "an external URL, opened, never resolved" — nothing about it is supplier-specific.

**UX**: the row shows the link scheme-less (`supplier.example/part/9`) and opens in a new tab. The stored value is exactly what was typed; normalization happens at display, so a half-typed value survives a reload. A bare host is read as `https`. A value that isn't `http(s)` renders as plain text and never as an anchor — the guard that keeps a typed `javascript:` from becoming a live link (`safeHttpUrl`, `src/utils/url.ts`).

**Status: current** (2026-08-12 — no config sub-fields; editing a saved link rides on the general field-edit surface).

## other-end

**Purpose**: The same single Element shown under a *second* parent, without ever being copied — the `virtualParents` overlay.

**Composition**: `Edges(internal, virtual) + Reads.resolver`. **Placement**: inline / re-root. Authored from either end — *adopt-here* on the host's card, or *appears-also-under* from the element itself — but it writes **one** overlay edge, never a duplicate.

- `appearance: 'portal'` → a navigable child of the virtual parent (tap drills in; edits write through to the one canonical Element).
- `appearance: 'citation'` → a plain inline reference row, like `internal-link`.

One canonical `parentId` with appearances layered on top, so **detach** (remove an appearance) ≠ **delete** (remove the Element everywhere).

**Status: describe** (the field-like surface intended to build next).

## approval

**Purpose**: A reference pinned to a *specific revision*, not a live target — answers "what exactly was approved."

**Composition**: `Edges(internal, revision) + Reads.resolver`. **Placement**: inline.

**Value shape**: `{ targetId, rev }`, resolving to `${targetId}:${rev}` in history. The edge is **immutable once set** — re-approving mints a *new* approval against the new rev rather than repointing.

**UX**: the resolver-aware renderer compares the pinned rev against the target's current rev and draws **valid** vs **stale** ("approved @ rev 4 / target now at rev 7"). It is the first **edge-side** consumer of `ElementHistory` (the mirror of `value-chart`'s stored-side read), and the one kind exercising `TargetSpec.pin: 'revision'` + `ValiditySpec` (`pinned-rev-is-current`).

**Status: describe.** (Whether validity may also gate on target *state* is an open question.)

## asset-gallery

**Purpose**: A wall of every photo found *below* this point — walks the descendants, collects each `image` / `image-with-caption`, lays them out as one gallery. Always current; nothing stored.

**Composition**: `Derivation(children/transitive → image) + Reads.resolver`. **Placement**: inline. The field-scoped twin of the lens (see Node-like kinds): re-aim the match at `log-entry`, `job`, or a signed doc and the same machinery becomes an "every X beneath here" panel.

**Status: describe.**

## value-chart

**Purpose**: Plots its *own* value's history (pressure, last 90 days).

**Composition**: `OwnValue + Reads.historyStream`. **Placement**: inline. The "self over time" case that needs no scope — it reads its own value's history, not a Derivation.

**Status: describe.**

## inherit-unless-override

**Purpose**: A value that delegates up the tree — present ⇒ shadows; absent ⇒ reads the nearest ancestor with a value, arbitrated. The engine behind business-value inheritance and Definition specificity.

**Composition**: `OwnValue + Derivation(ancestors/transitive) + arbiter`. **Placement**: inline. The sync rule flips with state (value present ⇒ OwnValue LWW'd; absent ⇒ Derivation recomputed), so a static descriptor can't hold it — `arbiter` is required.

**Status: describe.**

---

# Node-like kinds (re-root; lean on `Children` / `Derivation` / `Edges` / `Provision`)

A node-like kind draws its own re-rooting view (it is *navigated into*, not edited in a row). It is not a bare container; each earns the registry by composition. `node` itself registers like any other kind — its recursion and navigation are framework-owned via the **shell**, not a kind privilege.

## node

**Purpose**: The base — a titled container with open children: a physical asset, sub-asset, or logical division.

**Composition**: `Children(open)`. **Placement**: re-root. What it *is* beyond "node" (pump vs vessel) is a soft `typeOf` tag, never a kind. Minting a node spawns **no Library Definition** — a node is self-contained from creation; node "templating" is **Copy-As-Template** (clone an existing node's skeleton — structure + seed values, never history/readings/memberships — org-scoped, ephemeral until reuse justifies persistence).

**Status: current.**

## The lens — `jobs`, `logbook`

The canonical node behaviour. A **lens** is a node-like Element that holds no content of its own: it *gathers* every Element of one target kind within a scope and shows them in one navigable place. **Jobs** and **Logbook** are one lens aimed at different kinds.

**Composition**: `Derivation(children/transitive → <target>) + ProvisionSpec`. **Placement**: re-root.

- **Gather (down)** — a `Derivation` reading `children/transitive`, matched to the target kind. Membership *is* this computation — current by construction, nothing stored. The target Elements live in their own physical home wherever created; the lens reads, never owns.
- **Provision (up)** — a `ProvisionSpec`: when a target Element appears anywhere, a lens is reconciled into existence at each ancestor, keyed by a deterministic id (`${nodeId}::jobs`), so concurrent creates converge on one lens, never duplicates. Each lens still gathers over *its own* subtree.

The target kind is the only parameter — an org that works in "work orders," "tasks," or "tickets" is the same lens aimed at a different kind. Hand-picked membership is a different thing: the curated `logical-container`.

- **jobs** — the lens aimed at `job`: every Jobs box shows all jobs beneath it; one appears at each ancestor when a job is added anywhere below.
- **logbook** — the same lens aimed at `log-entry`: all entries beneath the point you're viewing.

**v1 (#6b, 2026-06-28).** `jobs` is built as **a lens child on every node** (deterministic id `${nodeId}::jobs`), each gathering its *own* subtree — a **pure rollup**, reaching the same visible result as upward provisioning (a Jobs box at every ancestor level) without the write-time ancestor-walk. **Decision: pure rollup is right for `jobs` now.** Container behaviour landed with the #5 container half (2026-06-30): `jobs` is a **hybrid** — it owns its own DataFields *and* rolls up jobs; each `job` is authored inside the container (parented to the owning node) and renders field-like yet re-rootable — a compact `NavigableRow` under a node, a Node-like CHILD card when re-rooted into — the **inline-yet-navigable placement** made concrete. `logbook` inherits the same rollup-and-container shape; once job-subtypes (Task/Work Order/Project) arrive, a subtype may force its own kind.

**Deferred:** **rich gathered rows** — a row's status/lifecycle "primary line" — wait on `Action` (ISSUES → chrome entailment); picking which *descendant* a new job lands under — Phase-1 parents every job to the lens owner (LATER).

**Lifecycle (settled 2026-08-12).** **Backfill** is built: `backfillProvisionedLenses` reconciles every declared lens onto already-stored container nodes at startup, so a node minted before a lens kind existed grows one (`logbook` arriving after `jobs` is the case that already happened). Idempotent, keyed on the same deterministic id. **An empty lens stays visible** — the only door to creating the first job is inside its own box, so hiding an empty one hides the door. **De-provision/GC** follows from that: a lens is not removed when its last entry goes, and in any case it owns its own DataFields, which a GC would take with it.

**Status:** `jobs` **current** (v1 rollup #6b + the hybrid-container half of #5, 2026-06-30); `logbook` **current** (#6c + the Definition-binding seam, 2026-07-01: rollup-and-container with a bound policy Definition — entry label + staleness — stamped at mint from the seeded `fd_logbook_policy`).

## job

**Purpose**: A layered, asset-like task node — open children for its detail Fields, navigable like any asset.

**Composition**: `Children(open)`. **Placement**: re-root. Status/priority/owner/due-dates are ordinary **Fields** (scoped by the `children` allowlist), *not* an OwnValue — so `Children + OwnValue` never arises (the parked `intrinsic-node-scalar` shape). `job` composes the same capability as `node`; it **earns its kind as the trigger the `jobs` lens provisions against** — the framework reacts to its existence, behaviour keyed on the kind, not a passive `typeOf` label (the SPEC §584-585 boundary, a deliberate call). Org variants — task, work-order, ticket — are soft labels on `job` for now; if any ever needs distinct behaviour it becomes its own kind (and `jobs` may then need container behaviour — see the lens note). First-class validated transitions wait on `Action` (built last).

**Sub-jobs: no** (decided 2026-08-12). `job` admitted `job` in its `children` allowlist, but nothing ever minted one — `LensCreate` parents every new job to the lens's owning node — so the claim was untested, and a nested job would also have been counted in every ancestor's Jobs rollup. `job` is now absent from its own allowlist. Restoring it is one line; job-subtypes (Task / Work-Order / Project) remain the other fork.

**Status: current** (v1 stub, #6b — node shell; status lives as a Field).

## log-entry

**Purpose**: One logbook entry — a template body with tag/flag tails. The thing the `logbook` lens gathers.

**Composition**: `Children(template: body + tag/flag tails)`. **Placement**: inline.

**Status: current** (v1 stub, #6c 2026-07-01 — plain entries authored in the `logbook` lens, labeled per the bound policy Definition; the template body + tag/flag tails still to build).

## org

**Purpose**: A people/role container with engineered aggregation (a `children/transitive` rollup of its members).

**Composition**: `Children(open) + Derivation(children/transitive)`. **Placement**: re-root. (Concrete sub-specs design-pending — see Open Questions.)

**Status: current** (v1 stub, #6b 2026-06-28 — node shell + a descendant-node count, the first consumer of the `children/transitive` traversal; the real people/role sub-specs remain design-pending — see Open Questions).

## person

**Purpose**: An identity/account Element — the anchor for the per-user config/overlay cascade and a reliable edge target.

**Composition**: `Children(open) + identity/overlay-anchor + target`. **Placement**: re-root. Earns its kind on composed behaviour (account/overlay role); targeting is the bonus `kind`'s hardness provides, not the justification. (Exact sub-spec set design-pending — see Open Questions.)

**Status: describe.**

## logical-container

**Purpose**: The *curated* counterpart to the lens — hand-picked membership by reference, stored and manual, no auto-update.

**Composition**: `Edges(members, multi) + Reads.resolver`; `container: logical`. **Placement**: re-root. The minimal logical grouping.

**Status: describe.**

---

# Cross-cutting kinds

## cross-tree action

**Purpose**: The only imperative capability — e.g. "close all child jobs."

**Composition**: `Action(cross-tree)`. **Placement**: inline. Non-idempotent under replay → needs `idempotencyKey` + `confirm`. Built last; likely never user-authorable.

**Status: open.**

## saved view

**Purpose**: A stored query/overlay reading the soft tag/position/field-presence layer (e.g. "my open jobs").

**Composition**: a view-state overlay (see `SPECIFICATION.md → Populations are typed trees`). **Placement**: re-root.

**Status: open.**

---

# Config leaves

The leaves of config subtrees (see `SPECIFICATION.md → Config is Elements`). Most **reuse the field-like kinds outright**; only the compound earns a new kind:

- `units` — an `enum-kv` keyed to quantity-kind.
- `quantity-kind` — a fixed-option enum (e.g. `length-unit`, options {m, ft, in}), locked by `kind`-immutability.
- `staleness` — a `number-kv` in seconds.
- flags — booleans (`multiline`, `requireCaption`, `allowOther`).
- `threshold-compound` — a compound own value, atomic LWW; the one config leaf that earns a new kind.

These are leaves, never new primitives.

---

# What is *not* a kind

- **Domain typology stays soft.** Pump, vessel, relay, road-bridge — and org variants like task or work-order — are user-grown `typeOf` tags on the relevant kind, never kinds and never a schema column. Identity and lens-matching key on `kind` (the one hard discriminant); the soft layer (tags, position, field-presence) feeds search / filter / sort / facet. The behaviour-free domain typology ships as **forkable seed `typeOf` data** (tag + default field bundle), read by one generic service that suggests fields from a node's `typeOf`.
- **A field Definition is not its own kind.** It is an Element of the very kind it defines, living in the `library` tree and bound to instances by `definitionId`. The Library is a population, not a kind. (This holds for re-root policy Definitions too: `fd_logbook_policy` is a `library`-tree Element of kind `logbook`.)

---

# Open Questions

1. **`ProvisionSpec` triggers** — the reconciler's remit is settled (one node per place, deterministic id, idempotent, convergent); open is the trigger vocabulary (target-appears-in-scope, schedule) and *when* recompute fires (same invalidation question as Q2).
2. **Aggregation materialization** — recompute-on-read with a memo vs materialized rollup invalidated on descendant change; acute at node scale (a `jobs`/`org` rollup over a large subtree).
3. **`person`/`org` sub-specs** — the concrete composed behaviours beyond the sketch above.
4. **Arbiter classification** — is `ArbiterSpec` a closed set of pairwise rules or a general resolver?
5. **`treeType` granularity** — policy keyed by tree root, by `treeType` enum, or per-kind?
6. **Action exactly-once** — offline-replay idempotency (keys, dedupe window), when Action is built.
7. **Sub-field granularity** — per cross-field invariant, the line between independent sub-fields and one atomic compound sub-field.
8. **Disposition & pin encoding** — is owned/delegated/pinned an authored flag on the Definition-side sub-field (and where), or entailed by template-vs-open plus a pin boolean? Plus the read-time cost of assembling a Definition's config subtree vs the old blob (memo / materialization — bounded, but measure).
9. **Canonical classifier tag** — whether the soft layer gains one required, single-valued, controlled-but-user-grown tag per node (a firm handle for search / filter / target over domain typology), distinct from open multi-tags. Deferred; identity stays on `kind`.
10. **Approval validity predicate** — is `ValiditySpec` only rev-staleness, or also target-*state* predicates (an `approval` valid only while its target Job is in state X)? Scoped to rev-staleness for now.
11. **`approval` cannot pin by `rev`** — the value shape above (`{ targetId, rev }`, pinning `${targetId}:${rev}`) assumes `rev` names one revision globally. It does not: `rev` is minted from a local-only read, so two clients editing the same element offline both reach rev 5 (ISSUES Tech Debt #4, fixed 2026-08-13 by making the history *id* unique — which repaired convergence but confirmed `rev` is only a per-client sequence). "Approved @ rev 4" therefore promises a precision the storage layer cannot deliver. Two routes when this kind is built: pin the full history row id (unique, immutable, already a stable handle), or drop the pointer entirely and have the approval **snapshot** what it approved into its own child subtree, with staleness read from the target's server-stamped `updatedAt` rather than a revision counter. The second removes `approval`'s dependency on the history log altogether and would leave `rev` with no consumer.
