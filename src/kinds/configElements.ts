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
 * **Materialized, not sparse.** Every schema entry emits a child, valued or not
 * (`value: null` when unset) — SPEC → *Config Fields are provisioned*. Without it
 * the Library could only show config somebody had already set: an unset knob
 * would have no Element, so no row, so nothing to tap in order to set it.
 * `assembleConfig` skips the null-valued children, so the *assembled* config
 * stays sparse and byte-identical to what every downstream consumer already
 * reads.
 *
 * **The defined kind is the first child.** A Definition is `kind: node`, so the
 * kind it defines cannot live in the `kind` column; it is a config Field at
 * `${defId}::cfg::kind`, read first because it selects the schema the rest are
 * provisioned from (`readDefinedKind`). It is deliberately *not* a schema entry:
 * it belongs to every kind rather than to one, and keeping it out of
 * `CONFIG_SCHEMAS` is what stops it leaking into the assembled config object.
 *
 * `pack`/`unpack` on a schema entry bridge the flat config to a sub-field value;
 * nothing overrides the defaults (`config[key]` ⇄ `{ [key]: value }`) since the
 * thresholds compound was retired 2026-08-17 — `enum-kv.options` uses `pack`
 * only to strip blank rows.
 */

import type { DataFieldValue, Element, DefinitionConfig, Kind } from '../data/models';
import { CONFIG_SCHEMAS } from './configSchema';

/** Deterministic id of a Definition's config sub-field Element. */
export function configChildId(defId: string, key: string): string {
    return `${defId}::cfg::${key}`;
}

/** Config-Field key naming the kind a Definition defines (SPEC → *The defined kind is a config Field*). */
export const DEFINED_KIND_KEY = 'kind';

/** Label of the defined-kind row, as it reads on a Definition's Data Card. */
export const DEFINED_KIND_LABEL = 'Kind';

/** A config sub-field Element minus the audit columns the caller stamps. */
export type ConfigChildDraft = Omit<Element, 'updatedBy' | 'updatedAt' | 'deletedAt'>;

/**
 * Decompose a config object into config sub-field Element drafts for the given
 * Definition, led by the write-once `kind` child. Every schema entry emits a
 * child; an unset knob carries `value: null`. Caller stamps
 * `updatedBy`/`updatedAt`/`deletedAt` and persists under `parentId === defId`.
 */
export function serializeConfig(
    defId: string,
    kind: Kind,
    config: DefinitionConfig,
): ConfigChildDraft[] {
    const schema = CONFIG_SCHEMAS[kind] ?? [];
    const flat = config as Record<string, unknown>;
    const drafts: ConfigChildDraft[] = [
        {
            id: configChildId(defId, DEFINED_KIND_KEY),
            // An `enum-kv` because that is what the value is — one choice from the
            // closed kind vocabulary — even though it is read-only after mint.
            kind: 'enum-kv',
            name: DEFINED_KIND_LABEL,
            subtitle: null,
            value: kind,
            parentId: defId,
            siblingOrder: 0,
            definitionId: null,
            treeType: 'library',
        },
    ];
    let order = 1;
    for (const sub of schema) {
        const packed = sub.pack ? sub.pack(flat) : flat[sub.key];
        drafts.push({
            id: configChildId(defId, sub.key),
            kind: sub.kind,
            name: sub.label,
            subtitle: null,
            value: (packed === undefined ? null : packed) as DataFieldValue | null,
            parentId: defId,
            siblingOrder: order++,
            definitionId: null,
            treeType: 'library',
        });
    }
    return drafts;
}

/**
 * Read the kind a Definition defines off its `kind` config child — the bootstrap
 * read `buildDefinitionView` makes before it knows which schema applies. Returns
 * null when the child is missing or blank, so the caller can fall back.
 */
export function readDefinedKind(
    defId: string,
    getChild: (childId: string) => Pick<Element, 'value'> | null | undefined,
): Kind | null {
    const child = getChild(configChildId(defId, DEFINED_KIND_KEY));
    const value = child?.value;
    return typeof value === 'string' && value !== '' ? (value as Kind) : null;
}

/**
 * Reassemble a config object from a Definition's config sub-field children.
 * `getChild` resolves a child Element by id (the caller supplies a lookup over
 * the Definition's active children). Absent **and unset** children are omitted,
 * so the result is sparse — which is what every downstream consumer of the
 * `Definition` view already expects, and what keeps materialization invisible to
 * them.
 */
export function assembleConfig(
    defId: string,
    kind: Kind,
    getChild: (childId: string) => Pick<Element, 'value'> | null | undefined,
): DefinitionConfig {
    const schema = CONFIG_SCHEMAS[kind] ?? [];
    const config: Record<string, unknown> = {};
    for (const sub of schema) {
        const child = getChild(configChildId(defId, sub.key));
        if (!child) continue;
        // A materialized-but-unset knob is exactly the absent key it replaced.
        if (child.value === null || child.value === undefined) continue;
        if (sub.unpack) Object.assign(config, sub.unpack(child.value));
        else config[sub.key] = child.value;
    }
    return config as DefinitionConfig;
}
