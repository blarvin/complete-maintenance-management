/**
 * provisionPolicy — the per-node lens provisioning schedule as **pure data**, the
 * component-free read of every kind that declares a `provision` capability.
 *
 * Why a separate module (same constraint as `placement.ts` / `childrenPolicy.ts`):
 * the provisioner runs in the command/data layer (`handlers.ts`), which must not
 * import `registry.ts`/`*.manifest.ts` (they pull the `.tsx` renderers, which
 * `vitest.config.ts` has no Solid JSX transform for).
 * So the schedule reads `KIND_CAPABILITIES` (already component-free) directly.
 *
 * The lens *kind* + id-`suffix` are derived from each `provision.idScheme`
 * (`'${parentId}::jobs'` → `'jobs'`), so a new lens kind (e.g. `logbook`) joins the
 * schedule automatically. The display `name` is the one field not in the capability
 * data — carried here as a small mirror of each manifest's `pickerLabel` (the same
 * accepted cross-boundary duplication as `KIND_PLACEMENT`'s values; a lens name is
 * the container header shown under every node). `registry.ts` checks the mirror
 * against the manifest at boot in dev, so the two can't quietly drift apart.
 */

import type { Kind } from '../data/models';
import type { CapabilitySet } from './types';
import { KIND_CAPABILITIES } from './capabilities';
import { DEFINITION_IDS } from '../data/definitionIds';

/** One provisioned lens: kind, deterministic id suffix, container name, and the
 *  default policy Definition to bind at mint (null = no policy — jobs today). */
export type ProvisionedLens = { kind: Kind; suffix: string; name: string; definitionId: string | null };

/** Read an entry as a `CapabilitySet` (the indexed access is a union of literal shapes). */
const capsOf = (kind: Kind): CapabilitySet => KIND_CAPABILITIES[kind];

/** Container names for provisioned lens kinds — mirrors each manifest's `pickerLabel`. */
const LENS_NAMES: Partial<Record<Kind, string>> = {
    jobs: 'Jobs',
    logbook: 'Logbook',
};

/**
 * Default policy Definition per provisioned lens kind — stamped onto the lens
 * Element's `definitionId` at mint (stamp-if-resolvable; handlers.ts skips the
 * stamp when the seed isn't present). `jobs` carries none yet: re-root binding
 * is optional, and jobs-without-a-policy proves it.
 */
const LENS_POLICY_DEFINITIONS: Partial<Record<Kind, string>> = {
    logbook: DEFINITION_IDS.logbookPolicy,
};

/** Parse the id suffix out of a `provision.idScheme` (`'${parentId}::jobs'` → `'jobs'`). */
function suffixOf(idScheme: string): string {
    const marker = '::';
    const at = idScheme.indexOf(marker);
    return at === -1 ? idScheme : idScheme.slice(at + marker.length);
}

/**
 * Every kind that declares a `provision` spec, as the schedule the provisioner
 * loops. Derived from `KIND_CAPABILITIES`, so adding a `provision` to a kind is the
 * only edit needed (plus its `LENS_NAMES` entry). Today: `jobs`, `logbook`.
 */
export const PROVISIONED_LENSES: readonly ProvisionedLens[] = (Object.keys(KIND_CAPABILITIES) as Kind[])
    .map((kind): ProvisionedLens | null => {
        const provision = capsOf(kind).provision;
        if (!provision) return null;
        return {
            kind,
            suffix: suffixOf(provision.idScheme),
            name: LENS_NAMES[kind] ?? kind,
            definitionId: LENS_POLICY_DEFINITIONS[kind] ?? null,
        };
    })
    .filter((entry): entry is ProvisionedLens => entry !== null);

const PROVISIONED_KINDS: ReadonlySet<Kind> = new Set(PROVISIONED_LENSES.map((l) => l.kind));

/** Whether a kind is a framework-provisioned lens (so it never accrues lenses of its own). */
export const isProvisionedLens = (kind: Kind): boolean => PROVISIONED_KINDS.has(kind);
