/**
 * KIND_MINT_VIA — each kind's create affordance as **pure data**, the
 * component-free mirror of the manifest's `mintVia`.
 *
 * Why a separate module (the same constraint as `placement.ts` / `capabilities.ts`):
 * `capabilities.ts` derives the child-kind allowlists from "which kinds can a user
 * actually create", which lives on the manifests — and importing `registry.ts` from
 * `capabilities.ts` is a cycle (`registry` → `*.manifest` → `capabilities`), quite
 * apart from pulling the `.tsx` renderers into every unit test. So the affordance
 * lives here as data.
 *
 * `as const satisfies Record<Kind, MintVia>` forces an entry per kind; the per-kind
 * *value* must agree with the manifest literal, which `registry.ts` checks at boot
 * in dev alongside the `KIND_PLACEMENT` mirror.
 *
 * Key order is load-bearing in one narrow way: `capabilities.ts` derives its
 * allowlists by filtering these keys, so this order is the order a child kind
 * appears in an allowlist. It matches `KIND_PLACEMENT`'s order.
 */

import type { Kind } from '../data/models';
import type { MintVia } from './types';

export const KIND_MINT_VIA = {
    node: 'node-create',
    'text-kv': 'composer',
    'enum-kv': 'composer',
    'number-kv': 'composer',
    'single-image': 'composer',
    org: 'node-create',
    job: 'node-create',
    // Framework-provisioned lenses — materialized per node, never user-picked.
    jobs: 'provision',
    'log-entry': 'node-create',
    logbook: 'provision',
    'asset-doc': 'composer',
    'part-supplier-link': 'composer',
    // Config-only sub-field kinds — real kinds, but only inside a config subtree.
    flag: 'config-only',
    compound: 'config-only',
    'string-list': 'config-only',
} as const satisfies Record<Kind, MintVia>;

const KINDS = Object.keys(KIND_MINT_VIA) as Kind[];

/** The kinds a user can mint through some create affordance, in registry order. */
export const kindsMintedVia = (via: MintVia): Kind[] => KINDS.filter((k) => KIND_MINT_VIA[k] === via);
