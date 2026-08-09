/**
 * NumberKvConfigForm - knobs for a new number-kv Definition.
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

import { For, Show, createMemo, createSignal } from 'solid-js';
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
    onChange: (cfg: NumberKvConfig, error: string | null) => void;
};

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

export const NumberKvConfigForm = (props: NumberKvConfigFormProps) => {
    const [commonOpen, setCommonOpen] = createSignal(true);
    const [advancedOpen, setAdvancedOpen] = createSignal(false);

    // Refresh-interval pair (numeric value + unit). Canonical seconds live in
    // config; this local pair just controls the input display.
    // eslint-disable-next-line solid/reactivity -- mount-time seed; the form remounts per kind pick via <Dynamic>
    const initialRefreshSecs = props.config.expectedRefreshSeconds;
    const initialUnit = initialRefreshSecs !== undefined ? unitFromSeconds(initialRefreshSecs) : 'min';
    const [refreshAmount, setRefreshAmount] = createSignal<string>(
        initialRefreshSecs !== undefined ? String(initialRefreshSecs / UNIT_TO_SECONDS[initialUnit]) : ''
    );
    const [refreshUnit, setRefreshUnit] = createSignal<RefreshUnit>(initialUnit);

    const [dirty, setDirty] = createSignal(false);
    // eslint-disable-next-line solid/reactivity -- mount-time seed; the form remounts per kind pick via <Dynamic>
    const [selectedPrecision, setSelectedPrecision] = createSignal(props.config.decimals ?? 2);
    const errorMessage = createMemo(() => dirty() ? validateNumberKvConfig(props.config) : null);

    const update = (patch: Partial<NumberKvConfig>) => {
        setDirty(true);
        const newConfig = { ...props.config, ...patch };
        props.onChange(newConfig, validateNumberKvConfig(newConfig));
    };

    const pickDisplayFormat = (fmt: NumberKvDisplayFormat) => {
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
        update(patch);
    };

    const pickNominalMode = (mode: NumberKvNominalMode) => {
        const patch: Partial<NumberKvConfig> = { nominalMode: mode };
        // Clear the other mode's fields so stale values don't trip invariants.
        if (mode === 'range') {
            patch.nominalValue = undefined;
            patch.tolerance = undefined;
        } else {
            patch.nominalMin = undefined;
            patch.nominalMax = undefined;
        }
        update(patch);
    };

    const setRefresh = (amountStr: string, unit: RefreshUnit) => {
        setRefreshAmount(amountStr);
        setRefreshUnit(unit);
        const n = amountStr === '' ? undefined : parseFloat(amountStr);
        const seconds = n !== undefined && Number.isFinite(n) && n > 0
            ? n * UNIT_TO_SECONDS[unit]
            : undefined;
        update({ expectedRefreshSeconds: seconds });
    };

    const fmt = () => props.config.displayFormat ?? 'decimal';
    const nominalMode = (): NumberKvNominalMode => props.config.nominalMode ?? 'range';
    const affixPos = (): NumberKvAffixPosition => props.config.affixPosition
        ?? (fmt() === 'currency' ? 'prefix' : 'suffix');

    return (
        <div class={formStyles.form}>
            <label class={formStyles.row}>
                <span class={formStyles.label}>Units symbol</span>
                <input
                    type="text"
                    class={formStyles.input}
                    value={props.config.unitsSymbol ?? ''}
                    placeholder="e.g. kg, °C, psi, $"
                    onInput={(e) => {
                        const v = e.currentTarget.value;
                        update({ unitsSymbol: v || undefined });
                    }}
                />
            </label>

            {/* ── Common section ──────────────────────────────────────────── */}
            <section class={styles.section}>
                <button
                    type="button"
                    class={styles.sectionHeader}
                    aria-expanded={commonOpen()}
                    onClick={() => setCommonOpen(!commonOpen())}
                >
                    <span class={styles.chevron}>{commonOpen() ? '▾' : '▸'}</span>
                    Display & nominal
                </button>
                <div classList={{ [styles.sectionBody]: true, [styles.sectionBodyCollapsed]: !commonOpen() }}>
                <div class={styles.sectionBodyInner}>
                    <label class={formStyles.row}>
                        <span class={formStyles.label}>Long form</span>
                        <input
                            type="text"
                            class={formStyles.input}
                            value={props.config.unitsLongForm ?? ''}
                            placeholder="e.g. kilograms"
                            onInput={(e) => {
                                const v = e.currentTarget.value;
                                update({ unitsLongForm: v === '' ? undefined : v });
                            }}
                        />
                    </label>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Affix position</span>
                        <div class={styles.radioGroup} role="radiogroup" aria-label="Affix position">
                            <For each={['prefix', 'suffix'] as const}>
                                {(pos) => (
                                    <label class={styles.radioLabel}>
                                        <input
                                            type="radio"
                                            name="affixPosition"
                                            checked={affixPos() === pos}
                                            onChange={() => update({ affixPosition: pos })}
                                        />
                                        {pos}
                                    </label>
                                )}
                            </For>
                        </div>
                    </div>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Precision</span>
                        <div class={styles.precisionPicker}>
                            <button type="button"
                                classList={{ [styles.precisionBtn]: true, [styles.precisionBtnActive]: selectedPrecision() === 0 }}
                                onClick={() => { setSelectedPrecision(0); update({ decimals: 0 }); }}
                            >XX</button>
                            <button type="button"
                                classList={{ [styles.precisionBtn]: true, [styles.precisionBtnActive]: selectedPrecision() === 1 }}
                                onClick={() => { setSelectedPrecision(1); update({ decimals: 1 }); }}
                            >XX.0</button>
                            <button type="button"
                                classList={{ [styles.precisionBtn]: true, [styles.precisionBtnActive]: selectedPrecision() === 2 }}
                                onClick={() => { setSelectedPrecision(2); update({ decimals: 2 }); }}
                            >XX.00</button>
                            <button type="button"
                                classList={{ [styles.precisionBtn]: true, [styles.precisionBtnActive]: selectedPrecision() === 3 }}
                                onClick={() => { setSelectedPrecision(3); update({ decimals: 3 }); }}
                            >XX.000</button>
                        </div>
                    </div>

                    <label class={formStyles.row}>
                        <span class={formStyles.label}>Display format</span>
                        <select
                            class={formStyles.input}
                            value={fmt()}
                            onChange={(e) => pickDisplayFormat(e.currentTarget.value as NumberKvDisplayFormat)}
                        >
                            <option value="decimal">decimal</option>
                            <option value="scientific">scientific</option>
                            <option value="engineering">engineering</option>
                            <option value="percent">percent</option>
                            <option value="currency">currency</option>
                        </select>
                    </label>

                    <Show when={fmt() === 'currency'}>
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Currency code*</span>
                            <input
                                type="text"
                                class={formStyles.input}
                                value={props.config.currencyCode ?? ''}
                                placeholder="e.g. USD, EUR"
                                maxLength={6}
                                onInput={(e) => {
                                    const v = e.currentTarget.value;
                                    update({ currencyCode: v === '' ? undefined : v });
                                }}
                            />
                        </label>
                    </Show>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Nominal mode</span>
                        <div class={styles.radioGroup} role="radiogroup" aria-label="Nominal mode">
                            <For each={['range', 'discrete'] as const}>
                                {(m) => (
                                    <label class={styles.radioLabel}>
                                        <input
                                            type="radio"
                                            name="nominalMode"
                                            checked={nominalMode() === m}
                                            onChange={() => pickNominalMode(m)}
                                        />
                                        {m}
                                    </label>
                                )}
                            </For>
                        </div>
                    </div>

                    <Show when={nominalMode() === 'range'}>
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Nominal min</span>
                            <NumericInput
                                value={props.config.nominalMin}
                                onChange={(n) => update({ nominalMin: n })}
                            />
                        </label>
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Nominal max</span>
                            <NumericInput
                                value={props.config.nominalMax}
                                onChange={(n) => update({ nominalMax: n })}
                            />
                        </label>
                    </Show>

                    <Show when={nominalMode() === 'discrete'}>
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Nominal value</span>
                            <NumericInput
                                value={props.config.nominalValue}
                                onChange={(n) => update({ nominalValue: n })}
                            />
                        </label>
                        <label class={formStyles.row}>
                            <span class={formStyles.label}>Tolerance (±)</span>
                            <NumericInput
                                value={props.config.tolerance}
                                min={0}
                                onChange={(n) => update({ tolerance: n })}
                            />
                        </label>
                    </Show>
                </div>
                </div>
            </section>

            {/* ── Advanced section ─────────────────────────────────────────── */}
            <section class={styles.section}>
                <button
                    type="button"
                    class={styles.sectionHeader}
                    aria-expanded={advancedOpen()}
                    onClick={() => setAdvancedOpen(!advancedOpen())}
                >
                    <span class={styles.chevron}>{advancedOpen() ? '▾' : '▸'}</span>
                    Alarms & freshness
                </button>
                <div classList={{ [styles.sectionBody]: true, [styles.sectionBodyCollapsed]: !advancedOpen() }}>
                <div class={styles.sectionBodyInner}>
                    <div class={styles.thresholdChain} aria-label="Threshold chain LL ≤ L ≤ … ≤ H ≤ HH">
                        <ThresholdInput
                            label="LL"
                            value={props.config.lowLow}
                            onChange={(n) => update({ lowLow: n })}
                        />
                        <span class={styles.chainSep}>≤</span>
                        <ThresholdInput
                            label="L"
                            value={props.config.low}
                            onChange={(n) => update({ low: n })}
                        />
                        <span class={styles.chainSep}>≤ … ≤</span>
                        <ThresholdInput
                            label="H"
                            value={props.config.high}
                            onChange={(n) => update({ high: n })}
                        />
                        <span class={styles.chainSep}>≤</span>
                        <ThresholdInput
                            label="HH"
                            value={props.config.highHigh}
                            onChange={(n) => update({ highHigh: n })}
                        />
                    </div>

                    <div class={formStyles.row}>
                        <span class={formStyles.label}>Expected refresh</span>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            classList={{ [formStyles.input]: true, [styles.refreshAmount]: true }}
                            value={refreshAmount()}
                            placeholder="e.g. 5"
                            onInput={(e) => setRefresh(e.currentTarget.value, refreshUnit())}
                        />
                        <select
                            classList={{ [formStyles.input]: true, [styles.refreshUnit]: true }}
                            value={refreshUnit()}
                            onChange={(e) => setRefresh(refreshAmount(), e.currentTarget.value as RefreshUnit)}
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

            <Show when={errorMessage()}>
                <div class={styles.invariantError} role="alert" aria-invalid="true">
                    {errorMessage()}
                </div>
            </Show>
        </div>
    );
};

// ── Small input helpers ────────────────────────────────────────────────────

const NumericInput = (props: {
    value: number | undefined;
    min?: number;
    onChange: (n: number | undefined) => void;
}) => {
    return (
        <input
            type="number"
            step="any"
            min={props.min}
            class={formStyles.input}
            value={props.value ?? ''}
            onInput={(e) => {
                const raw = e.currentTarget.value;
                const n = raw === '' ? undefined : parseFloat(raw);
                props.onChange(Number.isFinite(n) ? n : undefined);
            }}
        />
    );
};

const ThresholdInput = (props: {
    label: string;
    value: number | undefined;
    onChange: (n: number | undefined) => void;
}) => {
    return (
        <label class={styles.thresholdCell}>
            <span class={styles.thresholdLabel}>{props.label}</span>
            <input
                type="number"
                step="any"
                class={styles.thresholdInput}
                value={props.value ?? ''}
                onInput={(e) => {
                    const raw = e.currentTarget.value;
                    const n = raw === '' ? undefined : parseFloat(raw);
                    props.onChange(Number.isFinite(n) ? n : undefined);
                }}
            />
        </label>
    );
};
