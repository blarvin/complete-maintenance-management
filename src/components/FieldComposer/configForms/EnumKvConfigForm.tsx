/**
 * EnumKvConfigForm - knobs for a new enum-kv FieldDefinition.
 *  - options (string list; required non-empty)
 *  - allowOther (checkbox)
 *  - default (select among options)
 */

import { component$, $, type PropFunction } from '@builder.io/qwik';
import type { EnumKvConfig } from '../../../data/models';
import styles from './ConfigForms.module.css';

export type EnumKvConfigFormProps = {
    config: EnumKvConfig;
    onChange$: PropFunction<(cfg: EnumKvConfig, error: string | null) => void>;
};

export const EnumKvConfigForm = component$<EnumKvConfigFormProps>((props) => {
    const update$ = $((patch: Partial<EnumKvConfig>) => {
        const newConfig = { ...props.config, ...patch };
        const error = !newConfig.options || newConfig.options.length === 0
            ? 'At least one option is required'
            : null;
        return props.onChange$(newConfig, error);
    });

    const setOptionAt$ = $((index: number, value: string) => {
        const next = [...props.config.options];
        next[index] = value;
        return update$({ options: next });
    });

    const removeOptionAt$ = $((index: number) => {
        const next = props.config.options.filter((_, i) => i !== index);
        // If we just removed the default, clear it.
        const removed = props.config.options[index];
        const nextDefault = props.config.default === removed ? undefined : props.config.default;
        return update$({ options: next, default: nextDefault });
    });

    const addOption$ = $(() => {
        return update$({ options: [...props.config.options, ''] });
    });

    return (
        <div class={styles.form}>
            <div class={styles.row}>
                <span class={styles.label}>Options</span>
                <div class={styles.optionsList}>
                    {props.config.options.map((opt, i) => (
                        <div key={i} class={styles.optionRow}>
                            <input
                                type="text"
                                class={styles.input}
                                value={opt}
                                placeholder="Option label"
                                onInput$={(e) => setOptionAt$(i, (e.target as HTMLInputElement).value)}
                            />
                            <button
                                type="button"
                                class={styles.removeBtn}
                                onClick$={() => removeOptionAt$(i)}
                                aria-label={`Remove option ${i + 1}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button type="button" class={styles.addBtn} onClick$={addOption$}>
                        + Add option
                    </button>
                </div>
            </div>

            <label class={styles.row}>
                <input
                    type="checkbox"
                    class={styles.checkbox}
                    checked={!!props.config.allowOther}
                    onChange$={(e) => update$({ allowOther: (e.target as HTMLInputElement).checked })}
                />
                <span class={styles.label}>Allow "Other…" entry</span>
            </label>

            <label class={styles.row}>
                <span class={styles.label}>Default option</span>
                <select
                    class={styles.input}
                    value={props.config.default ?? ''}
                    onChange$={(e) => {
                        const v = (e.target as HTMLSelectElement).value;
                        update$({ default: v === '' ? undefined : v });
                    }}
                >
                    <option value="">— none —</option>
                    {props.config.options
                        .filter(o => o.trim() !== '')
                        .map((o) => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                </select>
            </label>
        </div>
    );
});
