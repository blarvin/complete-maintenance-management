/**
 * Renderer-registry types — the seam that collapses the per-kind `switch`
 * statements (renderer selection, config-form selection, default config,
 * value preview) into one manifest per kind.
 *
 * `KindManifest` is a `placement`-discriminated union: `inline` (field-like)
 * kinds carry the full renderer/authoring surface; `re-root` (node-like) kinds
 * carry identity only — their rendering is framework-owned (TreeNode) until the
 * chrome-entailment cluster routes it through a manifest Renderer. Both arms share
 * the capability descriptors the SPEC catalogues (ownValue/children/edges/…,
 * SourceSpec, provision) via `CapabilitySet`; they are a **structural seam only**
 * — carried per kind but read by no consumer yet (the lens / node-like kinds are
 * the first readers, the cascade arbiter the second).
 */

import type { Component, PropFunction, QRL, Signal } from '@builder.io/qwik';
import type { Kind, DataFieldValue, FieldDefinitionConfig } from '../data/models';

/**
 * Disposition of a config sub-field under inherit-unless-override (SPEC → Config
 * is Elements). **Encoded only in this cluster** — nothing honors it yet:
 *  - `owned`     — copied to the instance at mint; Definition edits don't propagate.
 *  - `delegated` — absent at mint, read live from the Definition (current behaviour).
 *  - `pinned`    — delegated with instance override disabled.
 * Copy-at-mint + override-disable land with the cascade arbiter (cluster 7).
 */
export type Disposition = 'owned' | 'delegated' | 'pinned';

/**
 * One config knob of a field kind, expressed as a child sub-field Element of the
 * Definition (config-as-Elements). The set of these for a kind is its
 * `configSchema` and drives serialize/assemble in `configElements.ts`.
 *
 * `pack`/`unpack` bridge the flat in-memory config object to a sub-field's stored
 * value. They default to `config[key]` ⇄ `{ [key]: value }`; only the compound
 * thresholds entry overrides them (4 flat fields ⇄ one `{LL,L,H,HH}` object).
 */
export type ConfigSubField = {
    /** Stable machine key; child id is `${defId}::cfg::${key}`. */
    key: string;
    /** Human label (the sub-field Element's `name`). */
    label: string;
    /** Sub-field kind (reuses field kinds; `flag`/`compound`/`string-list` for the rest). */
    kind: Kind;
    disposition: Disposition;
    /** Fresh default at mint (documentation/forward-use; not consumed in encode-only). */
    default?: DataFieldValue | null;
    /** Fixed option vocabulary for `enum-kv` sub-fields (e.g. affixPosition prefix/suffix). */
    options?: string[];
    /** Coherence guard for the sub-field's own value (e.g. threshold ordering). */
    validate?: (value: DataFieldValue | null) => string | null;
    /** config → stored value. Defaults to `config[key]`. Return `undefined` to omit. */
    pack?: (config: Record<string, unknown>) => DataFieldValue | null | undefined;
    /** stored value → partial config. Defaults to `{ [key]: value }`. */
    unpack?: (value: DataFieldValue | null) => Record<string, unknown>;
};

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Capability descriptors — the closed vocabulary every kind composes from
 * (SPEC → "The six capabilities", §551-577). **Structural seam only**: these
 * types and the per-manifest subsets that carry them are not yet read by any
 * consumer. The lens / node-like kinds (#6 on the code-work-map) are the first
 * readers; the cascade arbiter (#7) is the second. Until then a kind's capability
 * set is documentation the type system enforces, plus the input to `coherence`.
 * ──────────────────────────────────────────────────────────────────────────── */

// ── Tier A: descriptors #6 imminently consumes — full SPEC shape ──

/**
 * OwnValue descriptor (field-like core). Minimal here — a value-validation hook.
 * The `scalar | block | stream | composite` value-shape vocabulary that drives
 * layout is the chrome-entailment cluster's (#5); it is deliberately NOT
 * introduced here, so `ValueSpec` stays a thin marker for "this kind bears a value".
 */
export type ValueSpec = {
    validate?: (value: DataFieldValue | null) => string | null;
};

/** `template` = fixed core; `open` = user-grown (always allowlist-constrained). */
export type ChildrenMode = 'template' | 'open';

/** Children descriptor — `open` is type-constrained (`open(allowlist)`, never `open(any)`). */
export type ChildrenSpec = {
    mode: ChildrenMode;
    allowedKinds: Kind[];
    cardinality?: 'one' | 'many';
};

/** Edges descriptor — `internal` (value is an Element id) vs `external` (`{ url }`). */
export type TargetSpec = {
    scope: 'internal' | 'external';
    pin?: 'live' | 'revision';
    appearance?: 'citation' | 'portal';
    allowedKinds?: Kind[];
};

/**
 * Derivation descriptor — a relation×reach matched to a target kind:
 * `children/transitive` = subtree rollup (the lens gather); `ancestors/transitive`
 * = inheritance (nearest-first); `edges/direct` = curated membership.
 */
export type SourceSpec = {
    relation: 'children' | 'ancestors' | 'edges';
    reach: 'direct' | 'transitive';
};

/**
 * Provisioning descriptor (node-oriented; rides on the six) — declarative,
 * framework-reconciled materialization: ensure exactly one node per target place,
 * keyed by a deterministic id so concurrent creates converge. `trigger`/`idScheme`
 * are placeholder string vocabularies, firmed up with the lens (#6).
 */
export type ProvisionSpec = {
    trigger: string;
    target: SourceSpec;
    idScheme: string;
};

/** Membership mode (node-oriented) — physical (Children/`parentId`, cascade) | logical (Edges). */
export type Container = 'physical' | 'logical';

// ── Tier B: capabilities no current kind composes — minimal placeholders ──

/** Action is built last and likely never user-authorable (SPEC §565). Placeholder. */
export type ActionSpec = { idempotencyKey?: string; confirm?: boolean };
/** Arbitration of a contending capability pair belongs to the cascade (#7). Placeholder. */
export type ArbiterSpec = Record<string, never>;
/** Whether a pinned edge still counts belongs to the cascade (#7). Placeholder. */
export type ValiditySpec = Record<string, never>;

/**
 * The composed capability subset + node-oriented descriptors a kind draws from.
 * Each capability is optional; absence = origin in that axis (SPEC §527). Shared
 * by inline (field-like) and re-root (node-like) manifests alike — they are one
 * composition space, not two systems. **Not yet read by any consumer.**
 */
export type CapabilitySet = {
    ownValue?: ValueSpec;
    children?: { spec: ChildrenSpec };
    edges?: { target: TargetSpec };
    /**
     * Derivation gather. `targetKind` filters the gathered set to one kind — the
     * lens's "→ job" / "→ log-entry" axis (SourceSpec carries relation×reach only).
     * Omitted = gather every descendant (e.g. `org`'s untyped rollup count).
     */
    derivation?: { source: SourceSpec; targetKind?: Kind };
    action?: { spec: ActionSpec };
    reads?: { resolver?: boolean; historyStream?: boolean };
    // node-oriented descriptors (ride on the six; not new capabilities)
    provision?: ProvisionSpec;
    container?: Container;
    // cross-capability + meta
    arbiter?: ArbiterSpec;
};

/**
 * Identity shared by every kind, node-like or field-like. `placement` is the
 * discriminant that selects the rest of the manifest shape; the intersected
 * `CapabilitySet` is the composed behaviour both arms carry.
 */
type ManifestIdentity = {
    kind: Kind;
    /** Label for the authoring-form segmented picker. */
    pickerLabel: string;
    /**
     * Which create affordance offers this kind (SPEC §registry & manifest).
     * `config-only` kinds (`flag`/`compound`/`string-list`) are registered and
     * renderable but exist solely inside config subtrees — never offered as a new
     * Definition in the composer picker (which lists `composer` kinds only).
     * `provision` kinds (`jobs`) are materialized by the framework (the lens
     * provisioned per node), never offered in any user create affordance.
     */
    mintVia: 'composer' | 'node-create' | 'config-only' | 'provision';
    /** Where this kind draws its surface — separates node-like from field-like. */
    placement: 'inline' | 're-root';
    /**
     * Reject incoherent capability subsets (SPEC §589). Optional per-kind override;
     * the global cross-capability rules live in `checkCoherence` (coherence.ts) and
     * run over every registry entry in the registry test. Empty array = coherent.
     */
    coherence?: (caps: CapabilitySet) => string[];
} & CapabilitySet;

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
    /**
     * How this kind's config decomposes into child sub-field Elements
     * (config-as-Elements). Drives serialize/assemble in `configElements.ts`.
     * Absent/empty for kinds with no config (incl. the `config-only` sub-field
     * kinds themselves — their config would terminate the recursion, SPEC §601).
     */
    configSchema?: ConfigSubField[];
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
