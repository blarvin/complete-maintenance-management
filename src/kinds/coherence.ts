/**
 * Capability coherence — the validity rules from SPEC §589 (and §584).
 *
 * Capabilities aren't fully orthogonal: some subsets are incoherent and must be
 * rejected; some co-occurrences are valid but worth flagging. This module is the
 * **global** rule table; a kind may add its own hard rules via its manifest's
 * optional `coherence(caps)` hook. Neither is read in the running app yet — they
 * are exercised by the registry coherence test (`src/test/kindCoherence.test.ts`),
 * which fails CI if any manifest composes an incoherent subset. The cascade
 * arbiter (#7) is the first runtime reader of the contend-pair rules below.
 */

import type { CapabilitySet } from './types';

/** The six capability axes (node-oriented descriptors don't count as composed behaviour). */
const CAPABILITY_KEYS = [
    'ownValue',
    'children',
    'edges',
    'derivation',
    'action',
    'reads',
] as const;

/** Two-tier outcome (SPEC §589): `errors` reject the subset; `warnings` are valid-but-flagged. */
export type CoherenceReport = {
    errors: string[];
    warnings: string[];
};

/**
 * Validate a composed capability subset against the global rules. Empty `errors`
 * = coherent (the subset is admissible); `warnings` note knowingly-allowed
 * co-occurrences. Pure; no side effects.
 */
export function checkCoherence(caps: CapabilitySet): CoherenceReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    const hasAnyCapability = CAPABILITY_KEYS.some((k) => caps[k] !== undefined);

    // §584 — a kind must compose behaviour; a capability-empty kind that isn't the
    // framework's privileged shell is the degeneration anti-pattern.
    if (!hasAnyCapability) {
        errors.push('degeneration: a kind must compose at least one capability (SPEC §584)');
    }

    // §560/§589 — Derivation is pure compute: never stored, never synced, never in
    // history. A historyStream over it would have nothing to stream.
    if (caps.derivation && caps.reads?.historyStream) {
        errors.push('incoherent: Derivation stores nothing, so it cannot back a historyStream (SPEC §589)');
    }

    // §589 — OwnValue + Derivation contend (inherit-unless-override) and must name an
    // arbiter to resolve the pair.
    if (caps.ownValue && caps.derivation && !caps.arbiter) {
        errors.push('incoherent: OwnValue + Derivation contend and require an arbiter (SPEC §589)');
    }

    // §281/§589 — Children + OwnValue is valid (the intrinsic node scalar) but the two
    // capabilities co-occur, so it is allowed knowingly, not silently.
    if (caps.children && caps.ownValue) {
        warnings.push('flagged: Children + OwnValue co-occur (intrinsic node scalar) — allowed knowingly (SPEC §281)');
    }

    return { errors, warnings };
}
