/**
 * configElements — the bridge between a Definition's in-memory config object and
 * its `library`-tree config sub-field subtree (config-as-Elements, SPEC §591).
 *
 * `serializeConfig` turns a config object into child sub-field Element drafts;
 * `assembleConfig` reverses it, reading those children back into a config object
 * at read time (there is no persisted config blob). Both are driven by the kind's
 * manifest `configSchema`, with deterministic child ids so seeds are idempotent
 * and the inverse needs no id parsing.
 *
 * `pack`/`unpack` on a schema entry bridge the flat config to a sub-field value;
 * only the compound thresholds entry overrides the defaults (`config[key]` ⇄
 * `{ [key]: value }`).
 */

import type { DataFieldValue, Element, FieldDefinitionConfig, Kind } from '../data/models';
import { CONFIG_SCHEMAS } from './configSchema';

/** Deterministic id of a Definition's config sub-field Element. */
export function configChildId(defId: string, key: string): string {
    return `${defId}::cfg::${key}`;
}

/** A config sub-field Element minus the audit columns the caller stamps. */
export type ConfigChildDraft = Omit<Element, 'updatedBy' | 'updatedAt' | 'deletedAt'>;

/**
 * Decompose a config object into config sub-field Element drafts for the given
 * Definition. Only schema entries with a present (`!== undefined`) packed value
 * emit a child, mirroring the old sparse config blob. Caller stamps
 * `updatedBy`/`updatedAt`/`deletedAt` and persists under `parentId === defId`.
 */
export function serializeConfig(
    defId: string,
    kind: Kind,
    config: FieldDefinitionConfig,
): ConfigChildDraft[] {
    const schema = CONFIG_SCHEMAS[kind] ?? [];
    const flat = config as Record<string, unknown>;
    const drafts: ConfigChildDraft[] = [];
    let order = 0;
    for (const sub of schema) {
        const value = sub.pack ? sub.pack(flat) : flat[sub.key];
        if (value === undefined) continue;
        drafts.push({
            id: configChildId(defId, sub.key),
            kind: sub.kind,
            name: sub.label,
            subtitle: null,
            value: value as DataFieldValue | null,
            parentId: defId,
            siblingOrder: order++,
            fieldDefinitionId: null,
            treeType: 'library',
        });
    }
    return drafts;
}

/**
 * Reassemble a config object from a Definition's config sub-field children.
 * `getChild` resolves a child Element by id (the caller supplies a lookup over
 * the Definition's active children). Absent children are simply omitted, so the
 * result is sparse — matching what `serializeConfig` wrote.
 */
export function assembleConfig(
    defId: string,
    kind: Kind,
    getChild: (childId: string) => Pick<Element, 'value'> | null | undefined,
): FieldDefinitionConfig {
    const schema = CONFIG_SCHEMAS[kind] ?? [];
    const config: Record<string, unknown> = {};
    for (const sub of schema) {
        const child = getChild(configChildId(defId, sub.key));
        if (!child) continue;
        if (sub.unpack) Object.assign(config, sub.unpack(child.value));
        else config[sub.key] = child.value;
    }
    return config as FieldDefinitionConfig;
}
