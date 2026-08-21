/**
 * provisionPolicy — the per-node lens provisioning schedule, composed from the
 * component-free read of every kind that declares a `provision` capability plus
 * the active pack's lens bindings (display name, default policy Definition).
 *
 * Why a separate module (same constraint as `placement.ts` / `childrenPolicy.ts`):
 * the provisioner runs in the command/data layer (`provisionLenses.ts`), which must
 * not import `registry.ts`/`*.manifest.ts` (they pull the `.tsx` renderers, which
 * `vitest.config.ts` has no Solid JSX transform for).
 * So the schedule reads `KIND_CAPABILITIES` (already component-free) directly.
 *
 * The lens *kind* + id-`suffix` are derived from each `provision.idScheme`
 * (`'${parentId}::jobs'` → `'jobs'`), so a new lens kind (e.g. `logbook`) joins the
 * schedule automatically. The two fields that are not capability data — the display
 * `name` and the policy `definitionId` — are pack data, resolved per call. That is
 * why the schedule is a **function**: a pack is not readable at module-import time
 * in the world this seam is heading for, and the old eager const evaluated before
 * the first render. No memo — ~16 kinds, once per CREATE_ELEMENT or backfill row.
 *
 * `isProvisionedLens` stays eager: *which kinds are lenses* is capability data,
 * pack-independent, and read on hot render paths.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';
import { KIND_CAPABILITIES } from './capabilities';
import { lensNameFor, lensPolicyFor } from '../data/packs/activePack';

/** One provisioned lens: kind, deterministic id suffix, container name, and the
 *  default policy Definition to bind at mint (null = no policy — jobs today). */
export type ProvisionedLens = { kind: Kind; suffix: string; name: string; definitionId: string | null };

/** Read an entry as a `CapabilitySet` (the indexed access is a union of literal shapes). */
const capsOf = (kind: Kind): CapabilitySet => KIND_CAPABILITIES[kind];

/** Parse the id suffix out of a `provision.idScheme` (`'${parentId}::jobs'` → `'jobs'`). */
function suffixOf(idScheme: string): string {
    const marker = '::';
    const at = idScheme.indexOf(marker);
    return at === -1 ? idScheme : idScheme.slice(at + marker.length);
}

/** Every kind declaring a `provision` spec — the lens vocabulary, pack-independent. */
const PROVISIONED_KINDS: ReadonlySet<Kind> = new Set(
    (Object.keys(KIND_CAPABILITIES) as Kind[]).filter((kind) => capsOf(kind).provision),
);

/**
 * Every kind that declares a `provision` spec, as the schedule the provisioner
 * loops. Derived from `KIND_CAPABILITIES`, so adding a `provision` to a kind is the
 * only edit needed (plus its pack `lensNames` entry). Today: `jobs`, `logbook`.
 *
 * A kind the pack does not name falls back to its own kind string rather than
 * dropping out of the schedule — an unnamed lens is a cosmetic problem, a
 * missing one is a structural one.
 */
export function getProvisionedLenses(): readonly ProvisionedLens[] {
    return (Object.keys(KIND_CAPABILITIES) as Kind[])
        .map((kind): ProvisionedLens | null => {
            const provision = capsOf(kind).provision;
            if (!provision) return null;
            return {
                kind,
                suffix: suffixOf(provision.idScheme),
                name: lensNameFor(kind) ?? kind,
                definitionId: lensPolicyFor(kind),
            };
        })
        .filter((entry): entry is ProvisionedLens => entry !== null);
}

/** Whether a kind is a framework-provisioned lens (so it never accrues lenses of its own). */
export const isProvisionedLens = (kind: Kind): boolean => PROVISIONED_KINDS.has(kind);
