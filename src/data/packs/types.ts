/**
 * Field Definition Pack — the shape of a bundle of Definitions plus the bindings
 * that point at them (SPEC/LATER → *Definition Packs*).
 *
 * A pack is **data, not code**: the starter Library, which Definitions a new node
 * is born with, and which policy Definition each provisioned lens binds at mint.
 * Those three were hardcoded constants until this seam existed; the resolvers in
 * `activePack.ts` are what everything reads now.
 *
 * Component-free by construction — types only, and only from `../models`, so the
 * storage layer and the kind policies can both reach a pack without dragging in
 * the registry or the db.
 */

import type { DefinitionConfig, Kind } from '../models';

/** One Definition in a pack: the row the seeder writes plus its config subtree. */
export type PackDefinitionRow = {
    id: string;
    kind: Kind;
    label: string;
    config: DefinitionConfig;
};

/**
 * A pack: the Definitions and the bindings that reference them by id.
 *
 * Only `definitions` is required — a pack that ships Definitions and binds
 * nothing is legitimate (the bindings are the layer the config-tree cascade will
 * eventually own). Absent keys resolve to empty/null, never to a built-in
 * default: an omitted binding means "none", not "fall back to the old constant".
 */
export type FieldDefinitionPack = {
    definitions: PackDefinitionRow[];
    /** Definition ids every new node is born with. Default: none. */
    constructionDefaults?: string[];
    /** Lens kind → the policy Definition id stamped onto the lens at mint. */
    lensPolicies?: Record<string, string>;
    /** Lens kind → the container's display name. */
    lensNames?: Record<string, string>;
};
