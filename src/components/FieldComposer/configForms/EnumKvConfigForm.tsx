/**
 * EnumKvConfigForm - knobs for a new enum-kv Definition.
 *  - options (string list; required non-empty)
 *  - allowOther (checkbox)
 *  - default (select among options)
 */

import { For, Index } from 'solid-js';
import type { EnumKvConfig } from '../../../data/models';
import styles from './ConfigForms.module.css';

export type EnumKvConfigFormProps = {
    config: EnumKvConfig;
    onChange: (cfg: EnumKvConfig, error: string | null) => void;
};

export const EnumKvConfigForm = (props: EnumKvConfigFormProps) => {
    const update = (patch: Partial<EnumKvConfig>) => {
        const newConfig = { ...props.config, ...patch };
        const error = !newConfig.options || newConfig.options.length === 0
            ? 'At least one option is required'
            : null;
        props.onChange(newConfig, error);
    };

    const setOptionAt = (index: number, value: string) => {
        const next = [...props.config.options];
        next[index] = value;
        update({ options: next });
    };

    const removeOptionAt = (index: number) => {
        const next = props.config.options.filter((_, i) => i !== index);
        // If we just removed the default, clear it.
        const removed = props.config.options[index];
        const nextDefault = props.config.default === removed ? undefined : props.config.default;
        update({ options: next, default: nextDefault });
    };

    const addOption = () => {
        update({ options: [...props.config.options, ''] });
    };

    return (
        <div class={styles.form}>
            <div class={styles.row}>
                <span class={styles.label}>Options</span>
                <div class={styles.optionsList}>
                    {/* <Index> keys by position: per-keystroke edits patch the value
                        in place instead of remounting (and blurring) the input. */}
                    <Index each={props.config.options}>
                        {(opt, i) => (
                            <div class={styles.optionRow}>
                                <input
                                    type="text"
                                    class={styles.input}
                                    value={opt()}
                                    placeholder="Option label"
                                    onInput={(e) => setOptionAt(i, e.currentTarget.value)}
                                />
                                <button
                                    type="button"
                                    class={styles.removeBtn}
                                    onClick={() => removeOptionAt(i)}
                                    aria-label={`Remove option ${i + 1}`}
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </Index>
                    <button type="button" class={styles.addBtn} onClick={addOption}>
                        + Add option
                    </button>
                </div>
            </div>

            <label class={styles.row}>
                <input
                    type="checkbox"
                    class={styles.checkbox}
                    checked={!!props.config.allowOther}
                    onChange={(e) => update({ allowOther: e.currentTarget.checked })}
                />
                <span class={styles.label}>Allow "Other…" entry</span>
            </label>

            <label class={styles.row}>
                <span class={styles.label}>Default option</span>
                <select
                    class={styles.input}
                    value={props.config.default ?? ''}
                    onChange={(e) => {
                        const v = e.currentTarget.value;
                        update({ default: v === '' ? undefined : v });
                    }}
                >
                    <option value="">— none —</option>
                    <For each={props.config.options.filter(o => o.trim() !== '')}>
                        {(o) => <option value={o}>{o}</option>}
                    </For>
                </select>
            </label>
        </div>
    );
};
