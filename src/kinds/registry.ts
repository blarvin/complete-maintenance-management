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

import type { Kind } from '../data/models';
import type { InlineManifest, KindManifest } from './types';
import { nodeManifest } from './node.manifest';
import { textKvManifest } from './text-kv.manifest';
import { enumKvManifest } from './enum-kv.manifest';
import { numberKvManifest } from './number-kv.manifest';
import { singleImageManifest } from './single-image.manifest';
import { flagManifest } from './flag.manifest';
import { compoundManifest } from './compound.manifest';
import { stringListManifest } from './string-list.manifest';

export const KIND_REGISTRY = {
    node: nodeManifest,
    'text-kv': textKvManifest,
    'enum-kv': enumKvManifest,
    'number-kv': numberKvManifest,
    'single-image': singleImageManifest,
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

/**
 * Ordered kind list for the authoring-form segmented picker — the user-mintable
 * field kinds. Filters on `mintVia === 'composer'` so the config-only sub-field
 * kinds (`flag`/`compound`/`string-list`), though inline, never appear as a
 * choice for a new Definition.
 */
export const FIELD_KINDS: Kind[] = Object.values(KIND_REGISTRY)
    .filter((manifest) => manifest.mintVia === 'composer')
    .map((manifest) => manifest.kind);

export type { KindManifest, FieldRendererProps, ConfigFormProps } from './types';
