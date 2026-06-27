/**
 * Renderer-registry types — the seam that collapses the per-kind `switch`
 * statements (renderer selection, config-form selection, default config,
 * value preview) into one manifest per kind.
 *
 * `KindManifest` is a `placement`-discriminated union: `inline` (field-like)
 * kinds carry the full renderer/authoring surface; `re-root` (node-like) kinds
 * carry identity only — their rendering is framework-owned (TreeNode) until the
 * chrome-entailment cluster routes it through a manifest Renderer. The capability
 * descriptors the SPEC catalogues (ownValue/children/edges/…, SourceSpec,
 * provision) are intentionally absent until the kinds that consume them land.
 */

import type { Component, PropFunction, QRL, Signal } from '@builder.io/qwik';
import type { Kind, DataFieldValue, FieldDefinitionConfig } from '../data/models';

/**
 * Uniform prop contract every field renderer is invoked with. The concrete
 * components declare narrower `value`/`pendingMode` types per kind and are
 * bridged into this shape by a localized cast in each manifest — the runtime
 * value is always correct because the registry is keyed by the same
 * discriminant (`kind`) that determines the value type.
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
 * Identity shared by every kind, node-like or field-like. `placement` is the
 * discriminant that selects the rest of the manifest shape.
 */
type ManifestIdentity = {
    kind: Kind;
    /** Label for the authoring-form segmented picker. */
    pickerLabel: string;
    /** Which create affordance offers this kind (SPEC §registry & manifest). */
    mintVia: 'composer' | 'node-create';
    /** Where this kind draws its surface — separates node-like from field-like. */
    placement: 'inline' | 're-root';
};

/**
 * Inline (field-like) kinds: drawn as a DataField row, authored via the composer.
 * Carries everything the framework needs to render and author one field kind.
 */
export type InlineManifest = ManifestIdentity & {
    placement: 'inline';
    /** Value renderer (display + composer pendingMode). */
    Renderer: Component<FieldRendererProps>;
    /** Authoring sub-form for a new FieldDefinition of this kind. */
    ConfigForm: Component<ConfigFormProps>;
    /** Fresh default config at mint time. */
    defaultConfig: () => FieldDefinitionConfig;
    /** Uniform string preview of a value (null → null). Config is consulted by
     *  kinds whose display formatting depends on it (e.g. number-kv decimals /
     *  affix); the other kinds ignore it and a 1-arg function stays assignable. */
    displayPreview: (value: DataFieldValue | null, config?: FieldDefinitionConfig) => string | null;
    /** Suppress the dispatcher-rendered field label (e.g. single-image owns its own heading). */
    hideLabel: boolean;
    /** Value occupies a tall block rather than an inline run — pins the row chevron to the top. */
    blockValueLayout: boolean;
};

/**
 * Re-root (node-like) kinds: drawn as a navigable view. Identity only for now —
 * `node`'s recursion/navigation are framework-owned (TreeNode); routing them
 * through a manifest Renderer is the chrome-entailment cluster.
 */
export type ReRootManifest = ManifestIdentity & {
    placement: 're-root';
};

/**
 * Everything the framework needs to render and author one kind. Replaces the
 * scattered switches; assembled into KIND_REGISTRY in registry.ts.
 */
export type KindManifest = InlineManifest | ReRootManifest;
