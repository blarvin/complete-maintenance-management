/**
 * lensPolicy — pure resolution of a lens's policy Definition config into the
 * values the lens surfaces read (component-free; no registry import, so it is
 * testable and usable from any layer).
 *
 * A lens Element may carry a `definitionId` bound at provision time
 * (stamp-if-resolvable, handlers.ts). Its Definition's config supplies the
 * policy; a lens with no binding (jobs, pre-existing lenses) falls back to the
 * target kind's `pickerLabel`, which the caller passes in.
 */

import type { LogbookConfig } from '../data/models';

export type LensPolicy = {
    /** The word for one new entry — LensCreate/LensRollup label. */
    entryLabel: string;
    /** Seconds after the newest entry before the rollup shows stale. 0 = never. */
    staleness: number;
};

/** Resolve a policy config (or null when unbound/missing) against the fallback label. */
export function resolveLensPolicy(
    config: LogbookConfig | null | undefined,
    fallbackEntryLabel: string,
): LensPolicy {
    const entryLabel = config?.entryLabel?.trim();
    const staleness = config?.staleness;
    return {
        entryLabel: entryLabel || fallbackEntryLabel,
        staleness: typeof staleness === 'number' && staleness > 0 ? staleness : 0,
    };
}

/** Whether a rollup is stale: newest entry older than the staleness window.
 *  No entries or staleness disabled (0) → never stale. */
export function isLensStale(
    newestUpdatedAt: number | null,
    stalenessSeconds: number,
    nowMs: number,
): boolean {
    if (!stalenessSeconds || newestUpdatedAt === null) return false;
    return nowMs - newestUpdatedAt > stalenessSeconds * 1000;
}
