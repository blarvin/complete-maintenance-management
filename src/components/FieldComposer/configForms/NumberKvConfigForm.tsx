/**
 * NumberKvConfigForm - knobs for a new number-kv FieldDefinition.
 *
 * Progressive disclosure (three tiers):
 *   1. Required (always visible): unitsSymbol.
 *   2. Common ("Display & nominal", expanded by default): unitsLongForm,
 *      affixPosition, decimals, displayFormat (+ conditional currencyCode),
 *      nominalMode (+ conditional range/discrete inputs).
 *   3. Advanced ("Alarms & freshness", collapsed by default): LL/L/H/HH
 *      threshold chain; expectedRefreshSeconds (numeric + unit picker that
 *      resolves to canonical seconds on Save).
 *
 * Live invariant validation: `validateNumberKvConfig` runs on every change.
 * The first broken invariant surfaces inline; Save (the parent's button) is
 * gated by the parent's draft hook re-checking before commit.
 */

import { component$, useSignal, useComputed$, $, type PropFunction } from '@builder.io/qwik';
import type {
    NumberKvAffixPosition,
    NumberKvConfig,
    NumberKvDisplayFormat,
    NumberKvNominalMode,
} from '../../../data/models';
import { validateNumberKvConfig } from '../../DataField/numberKvState';
import formStyles from './ConfigForms.module.css';
import styles from './NumberKvConfigForm.module.css';

export type NumberKvConfigFormProps = {
    config: NumberKvConfig;
    onChange$: PropFunction<(cfg: NumberKvConfig, error: string | null) => void>;
};

const PRECISION_OPTIONS: { value: number; label: string }[] = [
    { value: 0, label: 'XX' },
    { value: 1, label: 'XX.0' },
    { value: 2, label: 'XX.00' },
    { value: 3, label: 'XX.000' },
];

type RefreshUnit = 'sec' | 'min' | 'hr' | 'day';
const UNIT_TO_SECONDS: Record<RefreshUnit, number> = {
    sec: 1,
    min: 60,
    hr: 3600,
    day: 86400,
};

// Pick the largest unit that divides the canonical seconds cleanly, so
// re-opening an authored config restores the user's intent.
function unitFromSeconds(s: number): RefreshUnit {
    if (s > 0 && s % UNIT_TO_SECONDS.day === 0) return 'day';
    if (s > 0 && s % UNIT_TO_SECONDS.hr === 0) return 'hr';
    if (s > 0 && s % UNIT_TO_SECONDS.min === 0) return 'min';
    return 'sec';
}

export const NumberKvConfigForm = component$<NumberKvConfigFormProps>((props) => {
    const commonOpen = useSignal(true);
    const advancedOpen = useSignal(false);

    // Refresh-interval pair (numeric value + unit). Canonical seconds live in
    // config; this local pair just controls the input display.
    const initialRefreshSecs = props.config.expectedRefreshSeconds;
    const initialUnit = initialRefreshSecs !== undefined ? unitFromSeconds(initialRefreshSecs) : 'min';
    const refreshAmount = useSignal<string>(
        initialRefreshSecs !== undefined ? String(initialRefreshSecs / UNIT_TO_SECONDS[initialUnit]) : ''
    );
    const refreshUnit = useSignal<RefreshUnit>(initialUnit);

    const dirty = useSignal(false);
    const selectedPrecision = useSignal(props.config.decimals ?? 2);
    const errorMessage = useComputed$(() => dirty.value ? validateNumberKvConfig(props.config) : null);

    const update$ = $((patch: Partial<NumberKvConfig>) => {
        dirty.value = true;
        const newConfig = { ...props.config, ...patch };
        return props.onChange$(newConfig, validateNumberKvConfig(newConfig));
    });

    const pickDisplayFormat$ = $((fmt: NumberKvDisplayFormat) => {
        const patch: Partial<NumberKvConfig> = { displayFormat: fmt };
        // Switching to currency auto-defaults affixPosition to prefix (per SPEC).
        if (fmt === 'currency' && props.config.affixPosition !== 'prefix') {
            patch.affixPosition = 'prefix';
        }
        // Switching away from currency clears currencyCode (it's required iff
        // displayFormat === currency).
        if (fmt !== 'currency') {
            patch.currencyCode = undefined;
        }
        return update$(patch);
    });

    const pickNominalMode$ = $((mode: NumberKvNominalMode) => {
        const patch: Partial<NumberKvConfig> = { nominalMode: mode };
        // Clear the other mode's fields so stale values don't trip invariants.
        if (mode === 'range') {
            patch.nominalValue = undefined;
            patch.tolerance = undefined;
        } else {
            patch.nominalMin = undefined;
            patch.nominalMax = undefined;
        }
        return update$(patch);
    });

    const setRefresh$ = $((amountStr: string, unit: RefreshUnit) => {
        refreshAmount.value = amountStr;
        refreshUnit.value = unit;
        const n = amountStr === '' ? undefined : parseFloat(amountStr);
        const seconds = n !== undefined && Number.isFinite(n) && n > 0
            ? n * UNIT_TO_SECONDS[unit]
            : undefined;
        return update$({ expectedRefreshSeconds: seconds });
    });

    const fmt = props.config.displayFormat ?? 'decimal';
    const nominalMode: NumberKvNominalMode = props.config.nominalMode ?? 'range';
    const affixPos: NumberKvAffixPosition = props.config.affixPosition
        ?? (fmt === 'currency' ? 'prefix' : 'suffix');

    return (
        <div class={formStyles.form}>
            {/* ── Required ────────────────────────────────────────────────── */}
            <label class={formStyles.row}>
                <span class={formStyles.label}>Units symbol*</span>
                <input
                    type="text"
                    class={formStyles.input}
                    value={props.config.unitsSymbol}
                    placeholder="e.g. kg, °C, psi, $"
                    onInput$={(e) => update$({ unitsSymbol: (e.target as HTMLInputElement).value })}
                    required
                />
            </label>

            {/* ── Common section ──────────────────────────────────────────── */}
            <section class={styles.section}>
                <button
                    type="button"
                    class={styles.sectionHeader}
                    aria-expanded={commonOpen.value}
                    onClick$={() => { commonOpen.value = !commonOpen.value; }}
                >
                    <span class={styles.chevron}>{commonOpen.value ? '▾' : '▸'}</span>
                    Display & nominal
                </button>
                <div class={[styles.sectionBody, !commonOpen.value && styles.sectionBodyCollapsed]}>
                <div class={styles.sectionBodyInner}>
                    <label class={formStyles.row}>
                        <span class={formStyles.label}>Long form</span>
                        <input
                            type="text"
                            class={formStyles.input}
                            value={props.config.unitsLongForm ?? ''}
                            placeholder="e.g. kilograms"
                            onInput$={(e) => {
                                const v = (e.target as HTMLInputElement).value;
                                update$({ unitsLongForm: v === '' ? undefined : v });
                            }}
                        />
                    </label>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Affix position</span>
                        <div class={styles.radioGroup} role="radiogroup" aria-label="Affix position">
                            {(['prefix', 'suffix'] as const).map((pos) => (
                                <label key={pos} class={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="affixPosition"
                                        checked={affixPos === pos}
                                        onChange$={() => update$({ affixPosition: pos })}
                                    />
                                    {pos}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Precision</span>
                        <div class={styles.precisionPicker}>
                            <button type="button"
                                class={[styles.precisionBtn, selectedPrecision.value === 0 && styles.precisionBtnActive]}
                                onClick$={() => { selectedPrecision.value = 0; return update$({ decimals: 0 }); }}
                            >XX</button>
                            <button type="button"
                                class={[styles.precisionBtn, selectedPrecision.value === 1 && styles.precisionBtnActive]}
                                onClick$={() => { selectedPrecision.value = 1; return update$({ decimals: 1 }); }}
                            >XX.0</button>
                            <button type="button"
                                class={[styles.precisionBtn, selectedPrecision.value === 2 && styles.precisionBtnActive]}
                                onClick$={() => { selectedPrecision.value = 2; return update$({ decimals: 2 }); }}
                            >XX.00</button>
                            <button type="button"
                                class={[styles.precisionBtn, selectedPrecision.value === 3 && styles.precisionBtnActive]}
                                onClick$={() => { selectedPrecision.value = 3; return update$({ decimals: 3 }); }}
                            >XX.000</button>
                        </div>
                    </div>

                    <label class={formStyles.row}>
                        <span class={formStyles.label}>Display format</span>
                        <select
                            class={formStyles.input}
                            value={fmt}
                            onChange$={(e) => pickDisplayFormat$((e.target as HTMLSelectElement).value as NumberKvDisplayFormat)}
                        >
                            <option value="decimal">decimal</option>
                            <option value="scientific">scientific</option>
                            <option value="engineering">engineering</option>
                            <option value="percent">percent</option>
                            <option value="currency">currency</option>
                        </select>
                    </label>

                    {fmt === 'currency' && (
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Currency code*</span>
                            <input
                                type="text"
                                class={formStyles.input}
                                value={props.config.currencyCode ?? ''}
                                placeholder="e.g. USD, EUR"
                                maxLength={6}
                                onInput$={(e) => {
                                    const v = (e.target as HTMLInputElement).value;
                                    update$({ currencyCode: v === '' ? undefined : v });
                                }}
                            />
                        </label>
                    )}

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Nominal mode</span>
                        <div class={styles.radioGroup} role="radiogroup" aria-label="Nominal mode">
                            {(['range', 'discrete'] as const).map((m) => (
                                <label key={m} class={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="nominalMode"
                                        checked={nominalMode === m}
                                        onChange$={() => pickNominalMode$(m)}
                                    />
                                    {m}
                                </label>
                            ))}
                        </div>
                    </div>

                    {nominalMode === 'range' && (
                        <>
                            <label class={formStyles.row}>
                                <span class={formStyles.label}>Nominal min</span>
                                <NumericInput
                                    value={props.config.nominalMin}
                                    onChange$={$((n: number | undefined) => update$({ nominalMin: n }))}
                                />
                            </label>
                            <label class={formStyles.row}>
                                <span class={formStyles.label}>Nominal max</span>
                                <NumericInput
                                    value={props.config.nominalMax}
                                    onChange$={$((n: number | undefined) => update$({ nominalMax: n }))}
                                />
                            </label>
                        </>
                    )}

                    {nominalMode === 'discrete' && (
                        <>
                            <label class={formStyles.row}>
                                <span class={formStyles.label}>Nominal value</span>
                                <NumericInput
                                    value={props.config.nominalValue}
                                    onChange$={$((n: number | undefined) => update$({ nominalValue: n }))}
                                />
                            </label>
                            <label class={formStyles.row}>
                                <span class={formStyles.label}>Tolerance (±)</span>
                                <NumericInput
                                    value={props.config.tolerance}
                                    min={0}
                                    onChange$={$((n: number | undefined) => update$({ tolerance: n }))}
                                />
                            </label>
                        </>
                    )}
                </div>
                </div>
            </section>

            {/* ── Advanced section ─────────────────────────────────────────── */}
            <section class={styles.section}>
                <button
                    type="button"
                    class={styles.sectionHeader}
                    aria-expanded={advancedOpen.value}
                    onClick$={() => { advancedOpen.value = !advancedOpen.value; }}
                >
                    <span class={styles.chevron}>{advancedOpen.value ? '▾' : '▸'}</span>
                    Alarms & freshness
                </button>
                <div class={[styles.sectionBody, !advancedOpen.value && styles.sectionBodyCollapsed]}>
                <div class={styles.sectionBodyInner}>
                    <div class={styles.thresholdChain} aria-label="Threshold chain LL ≤ L ≤ … ≤ H ≤ HH">
                        <ThresholdInput
                            label="LL"
                            value={props.config.lowLow}
                            onChange$={$((n: number | undefined) => update$({ lowLow: n }))}
                        />
                        <span class={styles.chainSep}>≤</span>
                        <ThresholdInput
                            label="L"
                            value={props.config.low}
                            onChange$={$((n: number | undefined) => update$({ low: n }))}
                        />
                        <span class={styles.chainSep}>≤ … ≤</span>
                        <ThresholdInput
                            label="H"
                            value={props.config.high}
                            onChange$={$((n: number | undefined) => update$({ high: n }))}
                        />
                        <span class={styles.chainSep}>≤</span>
                        <ThresholdInput
                            label="HH"
                            value={props.config.highHigh}
                            onChange$={$((n: number | undefined) => update$({ highHigh: n }))}
                        />
                    </div>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Expected refresh</span>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            class={[formStyles.input, styles.refreshAmount]}
                            value={refreshAmount.value}
                            placeholder="e.g. 5"
                            onInput$={(e) => setRefresh$((e.target as HTMLInputElement).value, refreshUnit.value)}
                        />
                        <select
                            class={[formStyles.input, styles.refreshUnit]}
                            value={refreshUnit.value}
                            onChange$={(e) => setRefresh$(refreshAmount.value, (e.target as HTMLSelectElement).value as RefreshUnit)}
                        >
                            <option value="sec">seconds</option>
                            <option value="min">minutes</option>
                            <option value="hr">hours</option>
                            <option value="day">days</option>
                        </select>
                    </div>
                </div>
                </div>
            </section>

            {errorMessage.value && (
                <div class={styles.invariantError} role="alert" aria-invalid="true">
                    {errorMessage.value}
                </div>
            )}
        </div>
    );
});

// ── Small input helpers ────────────────────────────────────────────────────

const NumericInput = component$<{
    value: number | undefined;
    min?: number;
    onChange$: PropFunction<(n: number | undefined) => void>;
}>((props) => {
    return (
        <input
            type="number"
            step="any"
            min={props.min}
            class={formStyles.input}
            value={props.value ?? ''}
            onInput$={(e) => {
                const raw = (e.target as HTMLInputElement).value;
                const n = raw === '' ? undefined : parseFloat(raw);
                props.onChange$(Number.isFinite(n) ? n : undefined);
            }}
        />
    );
});

const ThresholdInput = component$<{
    label: string;
    value: number | undefined;
    onChange$: PropFunction<(n: number | undefined) => void>;
}>((props) => {
    return (
        <label class={styles.thresholdCell}>
            <span class={styles.thresholdLabel}>{props.label}</span>
            <input
                type="number"
                step="any"
                class={styles.thresholdInput}
                value={props.value ?? ''}
                onInput$={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    const n = raw === '' ? undefined : parseFloat(raw);
                    props.onChange$(Number.isFinite(n) ? n : undefined);
                }}
            />
        </label>
    );
});
