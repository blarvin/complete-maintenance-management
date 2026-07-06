/**
 * KIND_REGISTRY — the single seam mapping each kind to its manifest. It is the
 * source of truth for the kind vocabulary: `Kind` (in models.ts) is derived from
 * these keys, so adding a kind here is the only place the framework learns about
 * it and a kind can never drift from its manifest. `satisfies Record<string,
 * KindManifest>` validates each entry is a well-formed manifest.
 *
 * `node` registers like any other kind (placement `re-root`, identity-only); it
 * is no longer privileged.
 */

import type { Component } from '@builder.io/qwik';
import type { Kind, DefinitionConfig } from '../data/models';
import type { ConfigFormProps, ConfigSubField, InlineManifest, KindManifest } from './types';
import { allowedChildKinds } from './childrenPolicy';
import { nodeManifest } from './node.manifest';
import { textKvManifest } from './text-kv.manifest';
import { enumKvManifest } from './enum-kv.manifest';
import { numberKvManifest } from './number-kv.manifest';
import { singleImageManifest } from './single-image.manifest';
import { orgManifest } from './org.manifest';
import { jobManifest } from './job.manifest';
import { jobsManifest } from './jobs.manifest';
import { logEntryManifest } from './log-entry.manifest';
import { logbookManifest } from './logbook.manifest';
import { assetDocManifest } from './asset-doc.manifest';
import { flagManifest } from './flag.manifest';
import { compoundManifest } from './compound.manifest';
import { stringListManifest } from './string-list.manifest';

export const KIND_REGISTRY = {
    node: nodeManifest,
    'text-kv': textKvManifest,
    'enum-kv': enumKvManifest,
    'number-kv': numberKvManifest,
    'single-image': singleImageManifest,
    // Node-like kinds (#6b minimal set) — the seam's first re-root consumers.
    org: orgManifest,
    job: jobManifest,
    jobs: jobsManifest,
    // #6c — the lens's second target kind + its container
    'log-entry': logEntryManifest,
    logbook: logbookManifest,
    'asset-doc': assetDocManifest,
    // Config-only sub-field kinds (config-as-Elements). Registered for value
    // typing + persistence; excluded from the authoring picker (see FIELD_KINDS).
    flag: flagManifest,
    compound: compoundManifest,
    'string-list': stringListManifest,
} satisfies Record<string, KindManifest>;

export function getKindManifest(kind: Kind): KindManifest {
    return KIND_REGISTRY[kind];
}

/**
 * Narrowing accessor for the inline (field-like) consumers — DataField, the
 * composer, history, authoring — which only ever handle field kinds. Centralises
 * the placement assertion so callers see the full inline manifest surface
 * (Renderer / ConfigForm / defaultConfig / displayPreview / flags) without
 * hand-narrowing the union at every call site.
 */
export function getInlineManifest(kind: Kind): InlineManifest {
    const manifest = getKindManifest(kind);
    if (manifest.placement !== 'inline') {
        throw new Error(`getInlineManifest called with non-inline kind: ${kind}`);
    }
    return manifest;
}

/** The Definition-authoring contract a kind carries (placement-agnostic). */
export type DefinitionAuthoring = {
    ConfigForm: Component<ConfigFormProps>;
    defaultConfig: () => DefinitionConfig;
    configSchema?: ConfigSubField[];
};

/**
 * Definition-authoring surface for any kind that carries one — inline field
 * kinds always do; re-root policy containers (`logbook`) may; leaf re-roots
 * (`node`, `job`) return null. The placement-agnostic counterpart to
 * `getInlineManifest` for the authoring hooks (map #7b: the contract is no
 * longer welded to `placement: 'inline'`).
 */
export function getDefinitionAuthoring(kind: Kind): DefinitionAuthoring | null {
    const manifest = getKindManifest(kind);
    if (!manifest.ConfigForm || !manifest.defaultConfig) return null;
    return {
        ConfigForm: manifest.ConfigForm,
        defaultConfig: manifest.defaultConfig,
        configSchema: manifest.configSchema,
    };
}

/**
 * Ordered kind list for the authoring-form segmented picker — the user-mintable
 * field kinds. Filters on `mintVia === 'composer'` so the config-only sub-field
 * kinds (`flag`/`compound`/`string-list`), though inline, never appear as a
 * choice for a new Definition.
 */
export const FIELD_KINDS: Kind[] = Object.values(KIND_REGISTRY)
    .filter((manifest) => manifest.mintVia === 'composer')
    .map((manifest) => manifest.kind);

/**
 * Ordered re-root (node-like) kinds offered in the node-create picker — the
 * counterpart to FIELD_KINDS for the construction surface. Filters on
 * `mintVia === 'node-create'`, so `jobs` (provisioned, `mintVia: 'provision'`)
 * is correctly excluded. `node` leads as the default.
 */
export const RE_ROOT_CREATE_KINDS: Kind[] = Object.values(KIND_REGISTRY)
    .filter((manifest) => manifest.placement === 're-root' && manifest.mintVia === 'node-create')
    .map((manifest) => manifest.kind);

/**
 * The re-root, user-creatable kinds a given parent admits — `RE_ROOT_CREATE_KINDS`
 * narrowed to the parent's `childrenSpec.allowedKinds` (chrome entailment #5, first
 * consumer of the allowlist). Empty for a content-free lens (`jobs`), so the create
 * surface offers nothing. The `mintVia`/`placement` filter stays here (registry);
 * the allowlist read is delegated to the component-free `childrenPolicy`.
 */
export const reRootCreateKindsFor = (parentKind: Kind): Kind[] => {
    const allowed = allowedChildKinds(parentKind);
    return RE_ROOT_CREATE_KINDS.filter((k) => allowed.includes(k));
};

export type { KindManifest, FieldRendererProps, ConfigFormProps } from './types';
