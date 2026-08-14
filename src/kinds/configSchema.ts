/**
 * Per-kind config schemas (config-as-Elements) — the `ChildrenSpec` over config
 * sub-field kinds for each field-like kind. Kept **component-free** (no `.tsx`
 * imports) so the storage layer (`configElements`, the IDB adapter, the seed)
 * can consume them without dragging the renderer components — and the JSX that
 * would need transforming — into Node-only contexts like Vitest.
 *
 * The manifests re-expose these as `manifest.configSchema`; `configElements`
 * reads `CONFIG_SCHEMAS` directly. Both reference the same arrays (single source).
 */

import type { ConfigGroup, ConfigSubField } from './types';
import type { CompoundValue, DefinitionConfig, EnumKvConfig, Kind, NumberKvConfig } from '../data/models';
import {
    packThresholds,
    validateThresholds,
    validateNumberKvConfig,
} from '../components/DataField/numberKvState';

/** Group labels, named once so the schema and the group list cannot drift. */
const DISPLAY_AND_NOMINAL = 'Display & nominal';
const ALARMS_AND_FRESHNESS = 'Alarms & freshness';

const isCurrency = (c: Record<string, unknown>) => c.displayFormat === 'currency';
/** `nominalMode` defaults to `range` when unset (ELEMENT-MODEL → number-kv). */
const isRangeMode = (c: Record<string, unknown>) => (c.nominalMode ?? 'range') === 'range';
const isDiscreteMode = (c: Record<string, unknown>) => c.nominalMode === 'discrete';

export const TEXT_KV_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'maxLength', label: 'Max length', kind: 'number-kv', disposition: 'owned' },
    { key: 'multiline', label: 'Multiline', kind: 'flag', disposition: 'delegated' },
    { key: 'placeholder', label: 'Placeholder', kind: 'text-kv', disposition: 'delegated' },
    { key: 'maxWords', label: 'Max words', kind: 'number-kv', disposition: 'owned' },
];

export const ENUM_KV_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'options', label: 'Options', kind: 'string-list', disposition: 'owned' },
    { key: 'allowOther', label: 'Allow other', kind: 'flag', disposition: 'delegated' },
    { key: 'default', label: 'Default', kind: 'text-kv', disposition: 'delegated' },
];

/**
 * `number-kv` is the deliberately rich kind, and its three authoring tiers
 * (ELEMENT-MODEL → number-kv → *progressive disclosure*) are expressed as tree
 * depth: `unitsSymbol` is required and sits at the top level, everything else
 * lives in one of the two groups below.
 */
export const NUMBER_KV_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'unitsSymbol', label: 'Units symbol', kind: 'text-kv', disposition: 'owned' },
    { key: 'unitsLongForm', label: 'Units (long form)', kind: 'text-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL },
    { key: 'affixPosition', label: 'Affix position', kind: 'enum-kv', disposition: 'delegated', options: ['prefix', 'suffix'], group: DISPLAY_AND_NOMINAL },
    { key: 'decimals', label: 'Decimals', kind: 'number-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL },
    { key: 'displayFormat', label: 'Display format', kind: 'enum-kv', disposition: 'delegated', options: ['decimal', 'scientific', 'engineering', 'percent', 'currency'], group: DISPLAY_AND_NOMINAL },
    { key: 'currencyCode', label: 'Currency code', kind: 'text-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL, visibleWhen: isCurrency },
    { key: 'nominalMode', label: 'Nominal mode', kind: 'enum-kv', disposition: 'owned', options: ['range', 'discrete'], group: DISPLAY_AND_NOMINAL },
    // `nominalMode` selects which pair is authorable; the other is hidden rather
    // than disabled, so the form never shows two contradictory nominals at once.
    { key: 'nominalMin', label: 'Nominal min', kind: 'number-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL, visibleWhen: isRangeMode },
    { key: 'nominalMax', label: 'Nominal max', kind: 'number-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL, visibleWhen: isRangeMode },
    { key: 'nominalValue', label: 'Nominal value', kind: 'number-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL, visibleWhen: isDiscreteMode },
    { key: 'tolerance', label: 'Tolerance', kind: 'number-kv', disposition: 'owned', group: DISPLAY_AND_NOMINAL, visibleWhen: isDiscreteMode },
    {
        // The one object-valued residue: {LL,L,H,HH} co-vary, so they bundle into
        // a single atomic compound sub-field with its own ordering guard.
        // `members` are the same flat draft keys `pack` reads — authoring renders
        // them one level deeper; storage still writes the single packed object.
        key: 'thresholds', label: 'Thresholds', kind: 'compound', disposition: 'owned',
        group: ALARMS_AND_FRESHNESS,
        members: [
            { key: 'lowLow', label: 'Low low', kind: 'number-kv' },
            { key: 'low', label: 'Low', kind: 'number-kv' },
            { key: 'high', label: 'High', kind: 'number-kv' },
            { key: 'highHigh', label: 'High high', kind: 'number-kv' },
        ],
        pack: (c) => {
            const t = packThresholds(c as unknown as NumberKvConfig);
            return Object.keys(t).length ? t : undefined;
        },
        unpack: (v) => (v ? { ...(v as CompoundValue) } : {}),
        validate: (v) => validateThresholds(v as CompoundValue | null),
    },
    { key: 'expectedRefreshSeconds', label: 'Refresh seconds', kind: 'number-kv', disposition: 'delegated', group: ALARMS_AND_FRESHNESS },
];

export const SINGLE_IMAGE_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'maxSizeMB', label: 'Max size (MB)', kind: 'number-kv', disposition: 'delegated' },
    { key: 'requireCaption', label: 'Require caption', kind: 'flag', disposition: 'delegated' },
    { key: 'aspectHint', label: 'Aspect hint', kind: 'text-kv', disposition: 'delegated' },
];

/** The first re-root policy schema (logbook, the binding seam's forcing kind).
 *  Both knobs are lens-surface policy read live from the Definition (delegated). */
export const LOGBOOK_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'entryLabel', label: 'Entry label', kind: 'text-kv', disposition: 'delegated' },
    { key: 'staleness', label: 'Staleness (seconds)', kind: 'number-kv', disposition: 'delegated' },
];

/** Config schema by kind. Kinds with no config (node, config-only kinds) are absent. */
export const CONFIG_SCHEMAS: Partial<Record<Kind, ConfigSubField[]>> = {
    'text-kv': TEXT_KV_CONFIG_SCHEMA,
    'enum-kv': ENUM_KV_CONFIG_SCHEMA,
    'number-kv': NUMBER_KV_CONFIG_SCHEMA,
    'single-image': SINGLE_IMAGE_CONFIG_SCHEMA,
    logbook: LOGBOOK_CONFIG_SCHEMA,
};

/**
 * Collapsible groups per kind, in render order — the authoring tree's depth.
 * Declared here rather than inferred from the sub-fields so order and
 * open-by-default are each stated once instead of repeated on every member.
 * A kind with no entry renders every sub-field at its top level.
 */
export const CONFIG_GROUPS: Partial<Record<Kind, ConfigGroup[]>> = {
    'number-kv': [
        { label: DISPLAY_AND_NOMINAL, defaultOpen: true },
        { label: ALARMS_AND_FRESHNESS, defaultOpen: false },
    ],
};

/**
 * Cross-field config invariants — the rules that span sub-fields and so belong
 * to no single one of them. This is what a per-kind `ConfigForm` used to exist
 * for: authoring is rows now, so an invariant is validation rather than a
 * bespoke component.
 *
 * A sub-field's *own* guard stays on its `validate` (thresholds' internal
 * ordering); this is only for rules that read more than one key.
 */
export const CONFIG_VALIDATORS: Partial<Record<Kind, (config: DefinitionConfig) => string | null>> = {
    // Nominal-vs-threshold ordering, currency ⇒ currencyCode, decimals ≥ 0,
    // refresh > 0 — already written and already component-free.
    'number-kv': (config) => validateNumberKvConfig(config as NumberKvConfig),

    // `options` is the vocabulary `default` must belong to, which is exactly why
    // the two cannot be authored as independent rows.
    'enum-kv': (config) => {
        const { options, default: fallback } = config as EnumKvConfig;
        const filled = (options ?? []).filter((o) => o.trim() !== '');
        if (filled.length === 0) return 'At least one option is required';
        if (fallback !== undefined && fallback !== '' && !filled.includes(fallback)) {
            return `Default (${fallback}) must be one of the options`;
        }
        return null;
    },
};
