/**
 * KIND_PLACEMENT — each kind's placement (`inline` field-like vs `re-root`
 * node-like) as **pure data**, the component-free mirror of the manifest's
 * `placement` discriminant.
 *
 * Why a separate module (same constraint as `capabilities.ts`): the storage
 * layer (`IDBAdapter`, `initStorage`, `nodeIndexSubscriber`) and unit tests must
 * branch on placement without importing `registry.ts`/`*.manifest.ts` — those
 * pull the Qwik `component$` renderers, which Vitest can't transform. So the
 * node-vs-field split lives here as data, the component-free mirror of each
 * manifest's `placement` discriminant. `as const satisfies Record<Kind,
 * Placement>` forces an entry per kind; the per-kind *value* must agree with the
 * manifest literal (not test-enforceable, since a test can't import the
 * component-bearing registry — same accepted constraint as `KIND_CAPABILITIES`).
 *
 * This retires the hardcoded `kind === 'node'` checks scattered across the
 * framework — the honest predicate is "is this kind re-root?", not "is it the
 * single privileged kind?".
 */

import type { Kind } from '../data/models';

export type Placement = 'inline' | 're-root';

export const KIND_PLACEMENT = {
    node: 're-root',
    'text-kv': 'inline',
    'enum-kv': 'inline',
    'number-kv': 'inline',
    'single-image': 'inline',
    // Node-like kinds (#6b minimal set)
    org: 're-root',
    job: 're-root',
    jobs: 're-root',
    'asset-doc': 'inline',
    // Config-only sub-field kinds
    flag: 'inline',
    compound: 'inline',
    'string-list': 'inline',
} as const satisfies Record<Kind, Placement>;

/** A kind drawn as a navigable view (node-like): node, org, job, jobs, … */
export const isReRoot = (kind: Kind): boolean => KIND_PLACEMENT[kind] === 're-root';

/** A kind drawn as a DataField row (field-like), authored via the composer. */
export const isInline = (kind: Kind): boolean => KIND_PLACEMENT[kind] === 'inline';
