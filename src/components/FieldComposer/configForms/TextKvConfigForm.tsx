/**
 * TextKvConfigForm - knobs for a new text-kv FieldDefinition.
 *  - maxLength (optional number)
 *  - multiline (checkbox)
 *  - placeholder (optional text)
 */

import { component$, $, type PropFunction } from '@builder.io/qwik';
import type { TextKvConfig } from '../../../data/models';
import styles from './ConfigForms.module.css';

export type TextKvConfigFormProps = {
    config: TextKvConfig;
    onChange$: PropFunction<(cfg: TextKvConfig) => void>;
};

export const TextKvConfigForm = component$<TextKvConfigFormProps>((props) => {
    const update$ = $((patch: Partial<TextKvConfig>) => {
        return props.onChange$({ ...props.config, ...patch });
    });

    return (
        <div class={styles.form}>
            <label class={styles.row}>
                <span class={styles.label}>Max length</span>
                <input
                    type="number"
                    min={1}
                    class={styles.input}
                    value={props.config.maxLength ?? ''}
                    placeholder="500"
                    onInput$={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        const n = raw === '' ? undefined : parseInt(raw, 10);
                        update$({ maxLength: Number.isFinite(n) ? n : undefined });
                    }}
                />
            </label>

            <label class={styles.row}>
                <input
                    type="checkbox"
                    class={styles.checkbox}
                    checked={!!props.config.multiline}
                    onChange$={(e) => update$({ multiline: (e.target as HTMLInputElement).checked })}
                />
                <span class={styles.label}>Multiline (textarea)</span>
            </label>

            <label class={styles.row}>
                <span class={styles.label}>Placeholder</span>
                <input
                    type="text"
                    class={styles.input}
                    value={props.config.placeholder ?? ''}
                    onInput$={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        update$({ placeholder: v === '' ? undefined : v });
                    }}
                />
            </label>
        </div>
    );
});
