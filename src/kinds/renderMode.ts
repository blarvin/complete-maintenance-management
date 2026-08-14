/**
 * nodeRenderMode — the one registry-side derivation of how a re-root kind's
 * content region renders, from its Derivation/Provision capability combination
 * (IMPLEMENTATION.md → *#9 — `renderMode.ts` is a fifth component-free
 * selector*). The component-free mirror pattern of
 * `placement.ts`/`childrenPolicy.ts`: reads `KIND_CAPABILITIES`, imports no
 * renderer components, so tests and the storage layer can branch on it.
 *
 *   - `lens`            — Provision + typed Derivation (`jobs`, `logbook`):
 *                         rollup + create surface render in the DataCard
 *                         (LensRollup/LensCreate); the gather targets `targetKind`.
 *   - `derivation-chip` — Derivation without Provision (`org`): a header
 *                         count chip (KindAdornment), no lens surfaces.
 *   - `plain`           — no Derivation (`node`, `job`, …): children only.
 *
 * A Provision without a typed Derivation renders `plain` — faithful to the
 * `provision ? derivation?.targetKind : undefined` reads this consolidates
 * (no such kind exists today; `checkCoherence` is the place to reject one).
 */

import type { Kind } from '../data/models';
import { KIND_CAPABILITIES } from './capabilities';
import type { CapabilitySet, DerivationSpec } from './types';

export type NodeRenderMode =
    | { mode: 'plain' }
    | { mode: 'lens'; targetKind: Kind }
    | { mode: 'derivation-chip' };

export function nodeRenderMode(kind: Kind): NodeRenderMode {
    const caps: CapabilitySet = KIND_CAPABILITIES[kind];
    if (caps.provision) {
        const targetKind = caps.derivation?.targetKind;
        return targetKind ? { mode: 'lens', targetKind } : { mode: 'plain' };
    }
    return caps.derivation ? { mode: 'derivation-chip' } : { mode: 'plain' };
}

/**
 * The gather descriptor behind the mode — what a Derivation kind actually reads,
 * handed whole to `gatherByDerivation`. `null` for a kind with no Derivation (and
 * for a nullish kind, so a caller awaiting its Element can pass `el()?.kind`).
 *
 * The mode above says *how the region draws*; this says *what it gathers*. Both
 * read the one capability, so a kind can't declare `children/transitive → job` and
 * be gathered some other way.
 */
export function derivationOf(kind: Kind | null | undefined): DerivationSpec | null {
    if (!kind) return null;
    // Widened like `nodeRenderMode` above — the indexed access is a union of literal
    // shapes, and only some arms carry `derivation`.
    const caps: CapabilitySet = KIND_CAPABILITIES[kind];
    return caps.derivation ?? null;
}
