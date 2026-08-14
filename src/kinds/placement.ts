/**
 * KIND_PLACEMENT — each kind's placement (`inline` field-like vs `re-root`
 * node-like) as **pure data**, the component-free mirror of the manifest's
 * `placement` discriminant.
 *
 * Why a separate module (same constraint as `capabilities.ts`): the storage
 * layer (`IDBAdapter`, `initStorage`, `nodeIndexSubscriber`) and unit tests must
 * branch on placement without importing `registry.ts`/`*.manifest.ts` — those
 * pull the `.tsx` renderers, and `vitest.config.ts` has no Solid JSX transform.
 * So the node-vs-field split lives here as data, the component-free mirror of each
 * manifest's `placement` discriminant. `as const satisfies Record<Kind,
 * Placement>` forces an entry per kind; the per-kind *value* must agree with the
 * manifest literal. Still not test-enforceable (a test can't import the
 * component-bearing registry — same constraint as `KIND_CAPABILITIES`), but no
 * longer unchecked: `registry.ts` compares the two at boot in dev, where both sides
 * are legitimately visible, and throws on a mismatch.
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
    // Node-like kinds (#6c) — the lens's second target + its container
    'log-entry': 're-root',
    logbook: 're-root',
    'internal-link': 'inline',
    'external-link': 'inline',
    // Config-only sub-field kinds
    flag: 'inline',
    compound: 'inline',
    'string-list': 'inline',
} as const satisfies Record<Kind, Placement>;

/** A kind drawn as a navigable view (node-like): node, org, job, jobs, … */
export const isReRoot = (kind: Kind): boolean => KIND_PLACEMENT[kind] === 're-root';

/** A kind drawn as a DataField row (field-like), authored via the Add Surface. */
export const isInline = (kind: Kind): boolean => KIND_PLACEMENT[kind] === 'inline';
