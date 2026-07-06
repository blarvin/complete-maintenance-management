/**
 * LogbookConfigForm - knobs for a logbook policy Definition (the first re-root
 * kind carrying the Definition-authoring contract).
 *  - entryLabel (the word for one new entry, e.g. "Entry")
 *  - staleness (seconds after the newest entry before the rollup shows stale)
 *
 * Seed-only this pass: no authoring surface mounts it yet (the composer picker
 * lists FIELD_KINDS only) — it exists so the lifted placement-agnostic contract
 * has a real re-root instance.
 */

import { component$, $ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import type { LogbookConfig } from '../../../data/models';
import styles from './ConfigForms.module.css';

export type LogbookConfigFormProps = {
    config: LogbookConfig;
    onChange$: PropFunction<(cfg: LogbookConfig) => void>;
};

export const LogbookConfigForm = component$<LogbookConfigFormProps>((props) => {
    const update$ = $((patch: Partial<LogbookConfig>) => {
        return props.onChange$({ ...props.config, ...patch });
    });

    return (
        <div class={styles.form}>
            <label class={styles.row}>
                <span class={styles.label}>Entry label</span>
                <input
                    type="text"
                    class={styles.input}
                    value={props.config.entryLabel ?? ''}
                    placeholder="Entry"
                    onInput$={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        update$({ entryLabel: v === '' ? undefined : v });
                    }}
                />
            </label>

            <label class={styles.row}>
                <span class={styles.label}>Staleness (seconds)</span>
                <input
                    type="number"
                    min={0}
                    class={styles.input}
                    value={props.config.staleness ?? ''}
                    placeholder="604800"
                    onInput$={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        const n = raw === '' ? undefined : parseInt(raw, 10);
                        update$({ staleness: Number.isFinite(n) ? n : undefined });
                    }}
                />
            </label>
        </div>
    );
});
