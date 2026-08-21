/**
 * KIND_CAPABILITIES — the composed capability subset for every kind, as **pure
 * data** (no renderer components). Each `*.manifest.ts` spreads its entry; the
 * manifest is still the assembled whole, this is just the capability slice's
 * authoring home.
 *
 * Why a separate module: capability data must be readable without importing the
 * `.tsx` renderer components the manifests carry — both for the coherence test
 * (`vitest.config.ts` has no Solid JSX transform, so nothing test-reachable may
 * import them) and for the SPEC's "degeneration anti-pattern is CI-lintable"
 * (§584), which reads capability subsets without booting the app. `satisfies
 * Record<Kind, CapabilitySet>` enforces an entry for every kind.
 *
 * **Read by the running app**, and the place to hang new per-kind behaviour.
 * The component-free predicate modules read it directly — `childrenPolicy`
 * (`allowedChildKinds`, `canHaveChildren`, `isLensSurfaced`, `storesOwnValue`),
 * `provisionPolicy` (the lens schedule), `valueCompat` (`acceptsValue`) — and
 * through them the Add Surface's entailment, the lens reconciler, the rollup
 * gathers and Field Details' History band. The cascade arbiter (#7) is the next
 * reader.
 *
 * That matters when deciding how to add per-kind behaviour: a capability
 * declared here answers for every kind at once and is enforced by the
 * `satisfies` below, where a hand-listed predicate elsewhere has to be
 * remembered. Prefer widening a descriptor to adding an allowlist.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';
import { kindsMintedVia } from './mintVia';

/* ─────────────────────────────────────────────────────────────────────────────
 * Child-kind allowlists, derived rather than hand-listed.
 *
 * `open` children are always allowlist-constrained (never `open(any)`, SPEC §564),
 * but the honest allowlist is "the node kinds a user can create + the field kinds a
 * user can author" — which is `mintVia`, on the manifests. Four kinds used to repeat
 * that as a literal array, so a new kind had to be added in four places and a miss
 * was silent. Derived here from the component-free `KIND_MINT_VIA` mirror (importing
 * `registry.ts` would be a cycle: registry → manifest → capabilities).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Field kinds a user can author in the Add Surface — what any container admits inline. */
const FIELD_CHILD_KINDS: Kind[] = kindsMintedVia('add-surface');

/** Everything an open physical container admits: creatable node kinds, then fields. */
const CONTAINER_CHILD_KINDS: Kind[] = [...kindsMintedVia('node-create'), ...FIELD_CHILD_KINDS];

const without = (kinds: Kind[], ...drop: Kind[]): Kind[] => kinds.filter((k) => !drop.includes(k));

/**
 * What a *record* node (`job`, `log-entry`) admits: the container set minus `org`.
 * An `org` is a people/role container belonging to the asset tree; one nested inside
 * a task or a log entry is a modelling accident, not a use case. Named once here
 * rather than silently omitted from each list. Decided 2026-08-12.
 */
const RECORD_CHILD_KINDS: Kind[] = without(CONTAINER_CHILD_KINDS, 'org');

export const KIND_CAPABILITIES = {
    // Children(open) + physical container (ELEMENT-MODEL §node). `jobs` is omitted
    // from the allowlist deliberately — it is framework-provisioned, never picked.
    node: {
        children: { spec: { mode: 'open', allowedKinds: CONTAINER_CHILD_KINDS } },
        container: 'physical',
    },

    // Field-like kinds compose OwnValue; `shape` is the value-shape vocabulary
    // (#5) the DataField dispatcher's arrangement law reads. Validation/threshold
    // logic stays config-level for now.
    'text-kv': { ownValue: { shape: 'scalar', runtime: 'string' } },
    'enum-kv': { ownValue: { shape: 'scalar', runtime: 'string' } },
    'number-kv': { ownValue: { shape: 'scalar', runtime: 'number' } },
    // composite: the renderer owns its sub-structure (image + caption) — the
    // generic label is suppressed and the chevron pins to the row top.
    'single-image': { ownValue: { shape: 'composite', runtime: 'object' } },

    // ── Node-like kinds (#6b minimal set) — first consumers of the seam ──

    // org: Children(open) + Derivation(children/transitive). The untyped rollup
    // (no `targetKind`) — a descendant count, no Provision.
    org: {
        children: { spec: { mode: 'open', allowedKinds: CONTAINER_CHILD_KINDS } },
        container: 'physical',
        derivation: { source: { relation: 'children', reach: 'transitive' } },
    },

    // job: Children(open). A layered task node — status/priority/owner/due-dates
    // are ordinary Fields, not an OwnValue (so no Children+OwnValue flag). It earns
    // its kind as the trigger the `jobs` lens provisions against (ELEMENT-MODEL §job).
    // `job` is deliberately NOT in its own allowlist: sub-tasks were claimed but no
    // picker ever minted one, and a nested job would double-count in every ancestor's
    // Jobs rollup. Decided 2026-08-12 — job-subtypes are the other fork if it returns.
    job: {
        children: { spec: { mode: 'open', allowedKinds: without(RECORD_CHILD_KINDS, 'job') } },
        container: 'physical',
    },

    // log-entry: the `job` twin (#6c) — Children(open). A layered record node
    // whose timestamp/author/category are ordinary Fields, not an OwnValue. It is
    // the trigger the `logbook` lens provisions against, so being a
    // `derivation.targetKind` it auto-joins `isLensSurfaced` (ELEMENT-MODEL §job).
    'log-entry': {
        children: { spec: { mode: 'open', allowedKinds: RECORD_CHILD_KINDS } },
        container: 'physical',
    },

    // jobs: the hybrid Jobs container — Children(open, field-like) + Derivation
    // (children/transitive → job) + Provision. It is NOT only a lens: it owns its
    // own DataFields (Children, field kinds only — sub-assets don't belong directly
    // in a Jobs container, and jobs arrive via Derivation) AND rolls up every `job`
    // below its owning node. The "both-rollup-and-container" shape (code-work-map
    // parked for #6c) — `checkCoherence` admits Children+Derivation+Provision. Jobs
    // themselves stay derived/node-owned; a job created here parents to the node.
    jobs: {
        children: { spec: { mode: 'open', allowedKinds: FIELD_CHILD_KINDS } },
        container: 'physical',
        derivation: { source: { relation: 'children', reach: 'transitive' }, targetKind: 'job' },
        provision: { trigger: 'node-create', target: { relation: 'children', reach: 'transitive' }, idScheme: '${parentId}::jobs' },
    },

    // logbook: the `jobs` twin (#6c) — the lens's second instance, proving it
    // generalizes by target kind. Same hybrid shape: Children(open, field-like) +
    // Derivation(children/transitive → log-entry) + Provision. Materialized per node
    // by the spec-driven provisioner (`provisionPolicy.ts`), which reads this
    // ProvisionSpec instead of hardcoding the kind.
    logbook: {
        children: { spec: { mode: 'open', allowedKinds: FIELD_CHILD_KINDS } },
        container: 'physical',
        derivation: { source: { relation: 'children', reach: 'transitive' }, targetKind: 'log-entry' },
        provision: { trigger: 'node-create', target: { relation: 'children', reach: 'transitive' }, idScheme: '${parentId}::logbook' },
    },

    // internal-link: Edges(internal, live) + Reads.resolver — a live-resolved link
    // to another Element (the value is the target id). What the link *means* —
    // "Linked Doc", "O&M Manual", "Parent Assembly" — is a Definition label.
    'internal-link': {
        edges: { target: { scope: 'internal', pin: 'live', allowedKinds: ['node', 'org', 'job'] } },
        reads: { resolver: true },
    },

    // external-link: Edges(external) — the `internal-link` twin pointing *out* of the
    // app. No `reads.resolver`: there is nothing internal to resolve, the stored URL
    // is the whole value. Together the two exercise both halves of
    // `TargetSpec.scope` (ELEMENT-MODEL §external-link). What the link is *for* —
    // supplier page, datasheet, manufacturer — is a Definition label, not a kind.
    'external-link': {
        edges: { target: { scope: 'external' } },
    },

    // ── Library chrome kinds (Library-As-Lens-Tree, 2026-08-20) ──

    // library: the Library lens's root — Children(template) over exactly its two
    // seeded index children. Template, not open: nothing is ever user-created
    // here, so `CreateNodeButton` self-suppresses (no re-root creatable kinds).
    library: {
        children: { spec: { mode: 'template', allowedKinds: ['definitions', 'kinds'] } },
    },

    // definitions / kinds: the two index lenses — pure gathers (Definitions list /
    // registry roster). `reads.resolver` (the internal-link precedent): they resolve
    // other Elements to render, store nothing. Deliberately NOT `derivation` (would
    // leak into `isLensSurfaced`) and NOT `provision` (nothing reconciles per node).
    definitions: { reads: { resolver: true } },
    kinds: { reads: { resolver: true } },

    // Config-only sub-field kinds also bear an own value (inside config subtrees).
    // Scalar for now (behavior-preserving); reassign compound/string-list by
    // essence only when a consumer wants their own sub-structure.
    flag: { ownValue: { shape: 'scalar', runtime: 'boolean' } },
    compound: { ownValue: { shape: 'scalar', runtime: 'object' } },
    'string-list': { ownValue: { shape: 'scalar', runtime: 'object' } },
} satisfies Record<Kind, CapabilitySet>;
