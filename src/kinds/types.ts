/**
 * Renderer-registry types — the seam that collapses the per-kind `switch`
 * statements (renderer selection, config-form selection, default config,
 * value preview) into one manifest per FieldComponent kind.
 *
 * Phase 1 (pure refactor): keyed by the four value-bearing `ComponentType`s
 * only. The `"node"` kind is privileged — its recursion/navigation lives in
 * the framework (TreeNode), not here. Phase-2 manifest fields (placement,
 * nature, icon, lazy renderers) are intentionally absent until a second
 * non-field surface forces them.
 */

import type { Component, PropFunction, QRL, Signal } from '@builder.io/qwik';
import type { ComponentType, DataFieldValue, FieldDefinitionConfig } from '../data/models';

/**
 * Uniform prop contract every field renderer is invoked with. The concrete
 * components declare narrower `value`/`pendingMode` types per kind and are
 * bridged into this shape by a localized cast in each manifest — the runtime
 * value is always correct because the registry is keyed by the same
 * discriminant (`componentType`) that determines the value type.
 *
 * Some props are kind-specific (`single-image` ignores `fieldDefinitionId`,
 * only `number-kv` reads `updatedAt`); unread props are harmlessly ignored.
 */
export type FieldRendererProps = {
    id: string;
    fieldDefinitionId: string;
    value: DataFieldValue | null;
    rootRef: Signal<HTMLElement | undefined>;
    updatedAt?: number;
    onUpdated$?: PropFunction<() => void>;
    pendingMode?: { onChange$: QRL<(value: DataFieldValue | null) => void>; autoFocus?: boolean };
};

/**
 * Uniform prop contract for a kind's authoring sub-form. The two-arg
 * `onChange$` covers both shapes in the wild: text/single-image forms call it
 * with one arg (error stays undefined → treated as null); enum/number forms
 * pass a validation error string.
 */
export type ConfigFormProps = {
    config: FieldDefinitionConfig;
    onChange$: PropFunction<(cfg: FieldDefinitionConfig, error?: string | null) => void>;
};

/**
 * Everything the framework needs to render and author one field kind. Replaces
 * the scattered switches; assembled into KIND_REGISTRY in registry.ts.
 */
export type KindManifest = {
    componentType: ComponentType;
    /** Label for the authoring-form segmented picker. */
    pickerLabel: string;
    /** Value renderer (display + composer pendingMode). */
    Renderer: Component<FieldRendererProps>;
    /** Authoring sub-form for a new FieldDefinition of this kind. */
    ConfigForm: Component<ConfigFormProps>;
    /** Fresh default config at mint time. */
    defaultConfig: () => FieldDefinitionConfig;
    /** Uniform string preview of a value (null → null). */
    displayPreview: (value: DataFieldValue | null) => string | null;
};
