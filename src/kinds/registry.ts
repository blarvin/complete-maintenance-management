/**
 * KIND_REGISTRY — the single, exhaustiveness-checked seam mapping each
 * value-bearing kind to its renderer, config form, default config, and value
 * preview. Adding a kind here (and to the `ComponentType` union) is the only
 * place the framework learns about it; `satisfies Record<ComponentType, …>`
 * makes a missing kind a compile error.
 *
 * The `"node"` kind is deliberately absent — see types.ts.
 */

import type { ComponentType } from '../data/models';
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
} satisfies Record<ComponentType, KindManifest>;

export function getKindManifest(type: ComponentType): KindManifest {
    return KIND_REGISTRY[type];
}

/** Ordered kind list for the authoring-form segmented picker. */
export const FIELD_KINDS: ComponentType[] = ['text-kv', 'enum-kv', 'number-kv', 'single-image'];

export type { KindManifest, FieldRendererProps, ConfigFormProps } from './types';
