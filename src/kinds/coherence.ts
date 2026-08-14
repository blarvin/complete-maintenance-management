/**
 * Capability coherence — the validity rules from SPEC §589 (and §584).
 *
 * Capabilities aren't fully orthogonal: some subsets are incoherent and must be
 * rejected; some co-occurrences are valid but worth flagging. This module holds
 * both tiers of rule: the **global** table in `checkCoherence`, and the per-kind
 * overrides in `KIND_COHERENCE`. Neither is read in the running app yet — they
 * are exercised by the registry coherence test (`src/test/kindCoherence.test.ts`),
 * which fails CI if any manifest composes an incoherent subset. The cascade
 * arbiter (#7) is the first runtime reader of the contend-pair rules below.
 *
 * Per-kind rules live **here, as data**, not on the manifest. They were declared as
 * an optional `coherence(caps)` hook on `ManifestIdentity`, where nothing could ever
 * call them: the only caller is the test, and a test may not import a manifest (the
 * `.tsx` renderers, no Solid JSX transform in `vitest.config.ts`). A kind declaring
 * a rule there would have been silently unchecked. Same component-free-mirror
 * constraint as `placement.ts` / `capabilities.ts`.
 */

import type { Kind } from '../data/models';
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
 * Hard rules a single kind adds beyond the global table (SPEC §589's per-kind
 * override). Keyed by kind; a rule returns error strings, `[]` = coherent.
 *
 * **Empty on purpose.** No kind needs one yet — this is the wire, so that the first
 * kind that does gets checked instead of ignored. Add an entry only when a kind's
 * own composition can be wrong in a way the global rules can't see.
 */
export const KIND_COHERENCE: Partial<Record<Kind, (caps: CapabilitySet) => string[]>> = {};

/**
 * Validate a composed capability subset against the global rules, plus this kind's
 * own rule when it has one. Empty `errors` = coherent (the subset is admissible);
 * `warnings` note knowingly-allowed co-occurrences. Pure; no side effects.
 *
 * `kind` is optional so a caller checking a hypothetical subset (not a registered
 * kind) still gets the global rules.
 */
export function checkCoherence(caps: CapabilitySet, kind?: Kind): CoherenceReport {
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

    // Per-kind override, folded in last so a kind can only ever add rules.
    const perKind = kind ? KIND_COHERENCE[kind] : undefined;
    if (perKind) errors.push(...perKind(caps));

    return { errors, warnings };
}
