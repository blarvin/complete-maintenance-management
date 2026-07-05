/**
 * nodeRenderMode — the one registry-side derivation of how a re-root kind's
 * content region renders, from its Derivation/Provision capability combination
 * (ISSUES Architecture Migration #9). The component-free mirror pattern of
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
import type { CapabilitySet } from './types';

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
