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

import type { ConfigSubField } from './types';
import type { CompoundValue, Kind, NumberKvConfig } from '../data/models';
import { packThresholds, validateThresholds } from '../components/DataField/numberKvState';

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

export const NUMBER_KV_CONFIG_SCHEMA: ConfigSubField[] = [
    { key: 'unitsSymbol', label: 'Units symbol', kind: 'text-kv', disposition: 'owned' },
    { key: 'unitsLongForm', label: 'Units (long form)', kind: 'text-kv', disposition: 'owned' },
    { key: 'affixPosition', label: 'Affix position', kind: 'enum-kv', disposition: 'delegated', options: ['prefix', 'suffix'] },
    { key: 'decimals', label: 'Decimals', kind: 'number-kv', disposition: 'owned' },
    { key: 'displayFormat', label: 'Display format', kind: 'enum-kv', disposition: 'delegated', options: ['decimal', 'scientific', 'engineering', 'percent', 'currency'] },
    { key: 'currencyCode', label: 'Currency code', kind: 'text-kv', disposition: 'owned' },
    { key: 'nominalMode', label: 'Nominal mode', kind: 'enum-kv', disposition: 'owned', options: ['range', 'discrete'] },
    { key: 'nominalMin', label: 'Nominal min', kind: 'number-kv', disposition: 'owned' },
    { key: 'nominalMax', label: 'Nominal max', kind: 'number-kv', disposition: 'owned' },
    { key: 'nominalValue', label: 'Nominal value', kind: 'number-kv', disposition: 'owned' },
    { key: 'tolerance', label: 'Tolerance', kind: 'number-kv', disposition: 'owned' },
    {
        // The one object-valued residue: {LL,L,H,HH} co-vary, so they bundle into
        // a single atomic compound sub-field with its own ordering guard.
        key: 'thresholds', label: 'Thresholds', kind: 'compound', disposition: 'owned',
        pack: (c) => {
            const t = packThresholds(c as unknown as NumberKvConfig);
            return Object.keys(t).length ? t : undefined;
        },
        unpack: (v) => (v ? { ...(v as CompoundValue) } : {}),
        validate: (v) => validateThresholds(v as CompoundValue | null),
    },
    { key: 'expectedRefreshSeconds', label: 'Refresh seconds', kind: 'number-kv', disposition: 'delegated' },
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
