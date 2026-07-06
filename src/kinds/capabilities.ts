/**
 * KIND_CAPABILITIES — the composed capability subset for every kind, as **pure
 * data** (no renderer components). Each `*.manifest.ts` spreads its entry; the
 * manifest is still the assembled whole, this is just the capability slice's
 * authoring home.
 *
 * Why a separate module: capability data must be readable without importing the
 * Qwik renderer `component$`s the manifests carry — both for the coherence test
 * (Vitest doesn't transform components; project convention forbids importing them
 * in unit tests) and for the SPEC's "degeneration anti-pattern is CI-lintable"
 * (§584), which reads capability subsets without booting the app. `satisfies
 * Record<Kind, CapabilitySet>` enforces an entry for every kind.
 *
 * **Structural seam only** — not read by any consumer in the running app yet; the
 * lens / node-like kinds (#6) are the first readers, the cascade arbiter (#7) the
 * second.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';

export const KIND_CAPABILITIES = {
    // Children(open) + physical container (ELEMENT-MODEL §node). `jobs` is omitted
    // from the allowlist deliberately — it is framework-provisioned, never picked.
    node: {
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['node', 'org', 'job', 'log-entry', 'text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
        container: 'physical',
    },

    // Field-like kinds compose OwnValue; `shape` is the value-shape vocabulary
    // (#5) the DataField dispatcher's arrangement law reads. Validation/threshold
    // logic stays config-level for now.
    'text-kv': { ownValue: { shape: 'scalar' } },
    'enum-kv': { ownValue: { shape: 'scalar' } },
    'number-kv': { ownValue: { shape: 'scalar' } },
    // composite: the renderer owns its sub-structure (image + caption) — the
    // generic label is suppressed and the chevron pins to the row top.
    'single-image': { ownValue: { shape: 'composite' } },

    // ── Node-like kinds (#6b minimal set) — first consumers of the seam ──

    // org: Children(open) + Derivation(children/transitive). The untyped rollup
    // (no `targetKind`) — a descendant count, no Provision.
    org: {
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['node', 'org', 'job', 'log-entry', 'text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
        container: 'physical',
        derivation: { source: { relation: 'children', reach: 'transitive' } },
    },

    // job: Children(open). A layered task node — status/priority/owner/due-dates
    // are ordinary Fields, not an OwnValue (so no Children+OwnValue flag). It earns
    // its kind as the trigger the `jobs` lens provisions against (ELEMENT-MODEL §job).
    job: {
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['node', 'job', 'log-entry', 'text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
        container: 'physical',
    },

    // log-entry: the `job` twin (#6c) — Children(open). A layered record node
    // whose timestamp/author/category are ordinary Fields, not an OwnValue. It is
    // the trigger the `logbook` lens provisions against, so being a
    // `derivation.targetKind` it auto-joins `isLensSurfaced` (ELEMENT-MODEL §job).
    'log-entry': {
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['node', 'job', 'log-entry', 'text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
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
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
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
        children: {
            spec: {
                mode: 'open',
                allowedKinds: ['text-kv', 'enum-kv', 'number-kv', 'single-image', 'asset-doc'],
            },
        },
        container: 'physical',
        derivation: { source: { relation: 'children', reach: 'transitive' }, targetKind: 'log-entry' },
        provision: { trigger: 'node-create', target: { relation: 'children', reach: 'transitive' }, idScheme: '${parentId}::logbook' },
    },

    // asset-doc: Edges(internal, live) + Reads.resolver — a live-resolved link to
    // another Element (the value is the target id).
    'asset-doc': {
        edges: { target: { scope: 'internal', pin: 'live', allowedKinds: ['node', 'org', 'job'] } },
        reads: { resolver: true },
    },

    // Config-only sub-field kinds also bear an own value (inside config subtrees).
    // Scalar for now (behavior-preserving); reassign compound/string-list by
    // essence only when a consumer wants their own sub-structure.
    flag: { ownValue: { shape: 'scalar' } },
    compound: { ownValue: { shape: 'scalar' } },
    'string-list': { ownValue: { shape: 'scalar' } },
} satisfies Record<Kind, CapabilitySet>;
