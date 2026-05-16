/**
 * NumberKvField - Renderer for `number-kv` DataFields.
 *
 * Numeric value with semantic units, optional display formatting
 * (decimal / scientific / engineering / percent / currency), nominal band
 * (range or discrete + tolerance), ISA-18.2 alarm thresholds (L/LL/H/HH),
 * and a freshness expectation that flips the row to a stale state when the
 * value's `updatedAt` is older than `expectedRefreshSeconds`.
 *
 * Authoring of these configs is the next PR (PR 6 — number-kv authoring form);
 * here we just render and validate against whatever the FieldDefinition holds.
 */

import { component$, useResource$, Resource, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { getFieldDefinitionQueries } from '../../data/queries';
import type { NumberKvConfig, NumberKvDisplayFormat } from '../../data/models';
import { computeNumberKvState, type NumberKvState } from './numberKvState';
import styles from './DataField.module.css';
import numberStyles from './NumberKvField.module.css';

export type NumberKvFieldProps = {
    id: string;
    fieldName: string;
    fieldDefinitionId: string;
    value: number | null;
    /** Epoch ms when the value was last written. Drives stale state when the
     *  FieldDefinition sets `expectedRefreshSeconds`. Pass 0 to disable stale
     *  (composer pendingMode does this — pending values are about to be
     *  written, never stale). */
    updatedAt?: number;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange$. */
    pendingMode?: { onChange$: QRL<(value: number | null) => void>; autoFocus?: boolean };
};

function formatNumber(value: number, config: NumberKvConfig): string {
    const decimals = config.decimals ?? 2;
    const fmt: NumberKvDisplayFormat = config.displayFormat ?? 'decimal';
    try {
        switch (fmt) {
            case 'percent':
                return new Intl.NumberFormat(undefined, {
                    style: 'percent',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                }).format(value);
            case 'scientific':
                return new Intl.NumberFormat(undefined, {
                    notation: 'scientific',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                }).format(value);
            case 'engineering':
                return new Intl.NumberFormat(undefined, {
                    notation: 'engineering',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                }).format(value);
            case 'currency':
            case 'decimal':
            default:
                return new Intl.NumberFormat(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                }).format(value);
        }
    } catch {
        // Bad locale / format options — fall back to toFixed.
        return value.toFixed(decimals);
    }
}

function withAffix(formatted: string, config: NumberKvConfig): string {
    const symbol = config.unitsSymbol;
    // `percent` is the one displayFormat where Intl already appends a symbol
    // (locale-aware "%"). Skip the unitsSymbol affix to avoid doubling.
    if (config.displayFormat === 'percent' || !symbol) return formatted;
    const pos = config.affixPosition
        ?? (config.displayFormat === 'currency' ? 'prefix' : 'suffix');
    return pos === 'prefix' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

function parseNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) {
        throw new Error(`"${raw}" is not a valid number`);
    }
    return n;
}

function makeValidate(config: NumberKvConfig) {
    return (value: number | null) => {
        if (value === null) return;
        // Hard rejection thresholds: outside [LL, HH] (range mode) or outside
        // the discrete equivalent. L/H and the nominal band are informational —
        // values there save fine, they just show warn/ok via the state class.
        const { lowLow, highHigh } = config;
        const u = config.unitsSymbol ? ` ${config.unitsSymbol}` : '';
        if (lowLow !== undefined && value < lowLow) {
            throw new Error(`Value must be ≥ ${lowLow}${u}`);
        }
        if (highHigh !== undefined && value > highHigh) {
            throw new Error(`Value must be ≤ ${highHigh}${u}`);
        }
    };
}

function buildHelperText(config: NumberKvConfig): string {
    const mode = config.nominalMode ?? 'range';
    const u = config.unitsSymbol ? ` ${config.unitsSymbol}` : '';
    if (mode === 'range') {
        const { nominalMin, nominalMax } = config;
        if (nominalMin !== undefined && nominalMax !== undefined) {
            return `Nominal ${nominalMin}–${nominalMax}${u}`;
        }
        if (nominalMin !== undefined) return `Nominal ≥ ${nominalMin}${u}`;
        if (nominalMax !== undefined) return `Nominal ≤ ${nominalMax}${u}`;
        return '';
    }
    const { nominalValue, tolerance } = config;
    if (nominalValue === undefined) return '';
    if (tolerance !== undefined && tolerance > 0) {
        return `Nominal ${nominalValue} ±${tolerance}${u}`;
    }
    return `Nominal ${nominalValue}${u}`;
}

export const NumberKvField = component$<NumberKvFieldProps>((props) => {
    const configResource = useResource$(async ({ track }) => {
        track(() => props.fieldDefinitionId);
        const def = await getFieldDefinitionQueries().getFieldDefinitionById(props.fieldDefinitionId);
        if (!def || def.componentType !== 'number-kv') return null;
        return def.config as NumberKvConfig;
    });

    return (
        <Resource
            value={configResource}
            onPending={() => <span class={styles.datafieldValue}>…</span>}
            onRejected={() => <span class={styles.datafieldValue}>—</span>}
            onResolved={(config) => {
                if (!config) return <span class={styles.datafieldValue}>—</span>;
                return <NumberKvBody {...props} config={config} />;
            }}
        />
    );
});

const NumberKvBody = component$<NumberKvFieldProps & { config: NumberKvConfig }>((props) => {
    const { config } = props;
    const decimals = config.decimals ?? 2;
    const isPercent = config.displayFormat === 'percent';

    const formatEdit = (v: number | null): string => {
        if (v === null || v === undefined) return '';
        return isPercent ? (v * 100).toFixed(decimals) : v.toFixed(decimals);
    };

    const parseEdit = (raw: string): number | null => {
        const n = parseNumber(raw);
        return isPercent && n !== null ? n / 100 : n;
    };

    const {
        isEditing,
        hasValue,
        editValue,
        editInputRef,
        currentValue,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
    } = useFieldEdit<number>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatEdit, // edit buffer shows bare number (×100 for percent), units affix sits outside
        parse: parseEdit,
        validate: makeValidate(config),
        rootRef: props.rootRef,
        onUpdated$: props.onUpdated$,
        pendingMode: props.pendingMode,
    });

    useFieldValueSync<number>(props.id, currentValue);

    const labelId = `field-label-${props.id}`;
    const helper = buildHelperText(config);

    const affixPos = config.affixPosition
        ?? (config.displayFormat === 'currency' ? 'prefix' : 'suffix');

    if (isEditing) {
        return (
            <span style="display: contents">
                {affixPos === 'prefix' && config.unitsSymbol && (
                    <span class={numberStyles.affix}>{config.unitsSymbol}</span>
                )}
                <input
                    ref={editInputRef}
                    type="text"
                    inputMode="decimal"
                    class={[styles.datafieldValue, numberStyles.input]}
                    value={editValue.value}
                    onInput$={(e) => inputChange$((e.target as HTMLInputElement).value)}
                    onPointerDown$={inputPointerDown$}
                    onBlur$={inputBlur$}
                    onKeyDown$={inputKeyDown$}
                    aria-labelledby={labelId}
                    aria-describedby={helper ? `${labelId}-helper` : undefined}
                    autoFocus
                />
                {affixPos === 'suffix' && config.unitsSymbol && (
                    <span class={numberStyles.affix}>{config.unitsSymbol}</span>
                )}
                {helper && (
                    <span id={`${labelId}-helper`} class={numberStyles.helper}>{helper}</span>
                )}
            </span>
        );
    }

    // Display mode.
    const stale = props.updatedAt ?? 0;
    const state: NumberKvState = computeNumberKvState(currentValue.value, config, stale);
    const shown = currentValue.value === null || currentValue.value === undefined
        ? ''
        : withAffix(formatNumber(currentValue.value, config), config);

    return (
        <div
            class={[
                styles.datafieldValue,
                hasValue && styles.datafieldValueUnderlined,
                styles.datafieldValueEditable,
                numberStyles[`state_${state}`],
                'no-caret',
            ]}
            data-state={state}
            onPointerDown$={valuePointerDown$}
            onKeyDown$={valueKeyDown$}
            tabIndex={0}
            role="button"
            aria-labelledby={labelId}
            aria-description="Press Enter to edit"
        >
            {shown || <span class={styles.datafieldPlaceholder}>Empty</span>}
        </div>
    );
});
