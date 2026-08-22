/**
 * activePack — the resolver seam every pack consumer reads through.
 *
 * The seeded Definitions, the construction defaults and the lens bindings used to
 * be three hardcoded constants, two of them folded into a module-level const at
 * *import* time — before the first render, long before the DB opens. They are
 * pack data now, reached only through the functions below, so the day a pack
 * arrives from somewhere other than the bundle (org layer, config-tree cascade,
 * user upload — all deferred) nothing but this module changes.
 *
 * The active pack is the bundled one, with no setter: compiled in means loading
 * cannot fail and "never boot packless" holds by construction. `public/packs` +
 * fetch + a first-run picker stay deferred (LATER.md → *Definition Packs*).
 *
 * Resolvers, not the pack object: a caller that reached in for `.lensNames`
 * would re-couple to the shape, and an absent optional key must read as "none"
 * rather than as `undefined` to be defaulted at each call site.
 */

import type { Kind } from '../models';
import { DEFAULT_PACK } from './defaultPack';
import type { FieldDefinitionPack, PackDefinitionRow } from './types';

const activePack: FieldDefinitionPack = DEFAULT_PACK;

/** Every Definition the active pack ships — the seeder's input. */
export function packDefinitions(): readonly PackDefinitionRow[] {
    return activePack.definitions;
}

/** Definition ids a new node is born with; empty when the pack binds none. */
export function constructionDefaults(): readonly string[] {
    return activePack.constructionDefaults ?? [];
}

/** The policy Definition id bound onto a provisioned lens of this kind, or null. */
export function lensPolicyFor(kind: Kind): string | null {
    return activePack.lensPolicies?.[kind] ?? null;
}

/** The display name for a provisioned lens container of this kind, or null. */
export function lensNameFor(kind: Kind): string | null {
    return activePack.lensNames?.[kind] ?? null;
}
