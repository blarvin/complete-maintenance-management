/**
 * KIND_REGISTRY — the single seam mapping each value-bearing kind to its
 * renderer, config form, default config, and value preview. It is the source
 * of truth for the kind vocabulary: `Kind` (in models.ts) is derived from
 * these keys, so adding a kind here is the only place the framework learns
 * about it and a kind can never drift from its manifest. `satisfies
 * Record<string, KindManifest>` validates each entry is a well-formed manifest.
 *
 * The `"node"` kind is deliberately absent — see types.ts.
 */

import type { Kind } from '../data/models';
import type { KindManifest } from './types';
import { textKvManifest } from './text-kv.manifest';
import { enumKvManifest } from './enum-kv.manifest';
import { numberKvManifest } from './number-kv.manifest';
import { singleImageManifest } from './single-image.manifest';

export const KIND_REGISTRY = {
    'text-kv': textKvManifest,
    'enum-kv': enumKvManifest,
    'number-kv': numberKvManifest,
    'single-image': singleImageManifest,
} satisfies Record<string, KindManifest>;

export function getKindManifest(kind: Kind): KindManifest {
    // `node` has no manifest in Phase 1 and is never passed here; the cast
    // centralises that one node-excluding narrowing. (Drops out in cluster #2
    // once `node` is a registry key.)
    return KIND_REGISTRY[kind as keyof typeof KIND_REGISTRY];
}

/** Ordered kind list for the authoring-form segmented picker. */
export const FIELD_KINDS: (keyof typeof KIND_REGISTRY)[] = ['text-kv', 'enum-kv', 'number-kv', 'single-image'];

export type { KindManifest, FieldRendererProps, ConfigFormProps } from './types';
