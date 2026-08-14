/**
 * NumberKvField - Renderer for `number-kv` DataFields.
 *
 * Numeric value with semantic units, optional display formatting
 * (decimal / scientific / engineering / percent / currency), nominal band
 * (range or discrete + tolerance), ISA-18.2 alarm thresholds (L/LL/H/HH),
 * and a freshness expectation that flips the row to a stale state when the
 * value's `updatedAt` is older than `expectedRefreshSeconds`.
 *
 * Wrapper/Body split: the Body owns the `useFieldEdit` call so config is a
 * mount-time constant it may capture (formatEdit/parseEdit/makeValidate).
 */

import { Show, createMemo, createResource, type Accessor } from 'solid-js';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { getDefinitionQueries } from '../../data/queries';
import type { NumberKvConfig } from '../../data/models';
import { computeNumberKvState, formatNumberKvDisplay, parseNumber } from './numberKvState';
import styles from './DataField.module.css';
import numberStyles from './NumberKvField.module.css';

export type NumberKvFieldProps = {
    id: string;
    definitionId: string;
    value: number | null;
    /** Epoch ms when the value was last written. Drives stale state when the
     *  Definition sets `expectedRefreshSeconds`. Pass 0 to disable stale
     *  (composer pendingMode does this — pending values are about to be
     *  written, never stale). */
    updatedAt?: number;
    rootRef: Accessor<HTMLElement | undefined>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange. */
    pendingMode?: { onChange: (value: number | null) => void | Promise<void>; autoFocus?: boolean };
};

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

export const NumberKvField = (props: NumberKvFieldProps) => {
    // Error-catching fetcher: never enters the throwing state (no ErrorBoundary);
    // missing/wrong-kind/failed def degrades to null → the "—" fallback.
    const [config] = createResource(
        () => props.definitionId,
        async (definitionId): Promise<NumberKvConfig | null> => {
            try {
                const def = await getDefinitionQueries().getDefinitionById(definitionId);
                if (!def || def.kind !== 'number-kv') return null;
                return def.config as NumberKvConfig;
            } catch {
                return null;
            }
        },
    );

    return (
        <Show when={!config.loading} fallback={<span class={styles.datafieldValue}>…</span>}>
            <Show when={config()} keyed fallback={<span class={styles.datafieldValue}>—</span>}>
                {(cfg) => <NumberKvBody {...props} config={cfg} />}
            </Show>
        </Show>
    );
};

const NumberKvBody = (props: NumberKvFieldProps & { config: NumberKvConfig }) => {
    // eslint-disable-next-line solid/reactivity -- mount-time constant; the Body remounts per config (<Show keyed>)
    const config = props.config;
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

    /* eslint-disable solid/reactivity -- mount-time constants; rows remount per field (<For> reference-keyed) */
    const {
        isEditing,
        hasValue,
        editValue,
        currentValue,
        setCurrentValue,
        setEditInputRef,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    } = useFieldEdit<number>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatEdit, // edit buffer shows bare number (×100 for percent), units affix sits outside
        parse: parseEdit,
        validate: makeValidate(config),
        rootRef: props.rootRef,
        pendingMode: props.pendingMode,
    });

    useFieldValueSync<number>(props.id, setCurrentValue);
    /* eslint-enable solid/reactivity */

    const labelId = () => `field-label-${props.id}`;
    const helper = buildHelperText(config);

    const affixPos = config.affixPosition
        ?? (config.displayFormat === 'currency' ? 'prefix' : 'suffix');

    // Display-mode derivations.
    const state = createMemo(() => computeNumberKvState(currentValue(), config, props.updatedAt ?? 0));
    const shown = () => currentValue() === null || currentValue() === undefined
        ? ''
        : formatNumberKvDisplay(currentValue()!, config);

    return (
        <Show
            when={isEditing()}
            fallback={
                <div
                    classList={{
                        [styles.datafieldValue]: true,
                        [styles.datafieldValueUnderlined]: hasValue(),
                        [styles.datafieldValueEditable]: true,
                        [numberStyles[`state_${state()}`]]: true,
                        'no-caret': true,
                    }}
                    data-state={state()}
                    onPointerDown={valuePointerDown}
                    onKeyDown={valueKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-labelledby={labelId()}
                    aria-description="Press Enter to edit"
                >
                    {shown() || <span class={styles.datafieldPlaceholder}>Empty</span>}
                </div>
            }
        >
            <span style={{ display: 'contents' }}>
                {affixPos === 'prefix' && config.unitsSymbol && (
                    <span class={numberStyles.affix}>{config.unitsSymbol}</span>
                )}
                <input
                    ref={setEditInputRef}
                    type="text"
                    inputMode="decimal"
                    classList={{
                        [styles.datafieldValue]: true,
                        [numberStyles.input]: true,
                    }}
                    value={editValue()}
                    onInput={(e) => inputChange(e.currentTarget.value)}
                    onPointerDown={inputPointerDown}
                    onBlur={inputBlur}
                    onKeyDown={inputKeyDown}
                    aria-labelledby={labelId()}
                    aria-describedby={helper ? `${labelId()}-helper` : undefined}
                    autofocus
                />
                {affixPos === 'suffix' && config.unitsSymbol && (
                    <span class={numberStyles.affix}>{config.unitsSymbol}</span>
                )}
                {helper && (
                    <span id={`${labelId()}-helper`} class={numberStyles.helper}>{helper}</span>
                )}
            </span>
        </Show>
    );
};
