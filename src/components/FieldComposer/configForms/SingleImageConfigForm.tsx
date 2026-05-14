/**
 * SingleImageConfigForm - knobs for a new single-image FieldDefinition.
 *  - maxSizeMB (number, default 5)
 *  - requireCaption (checkbox)
 *  - aspectHint (free text, e.g. "4:3")
 */

import { component$, $, type PropFunction } from '@builder.io/qwik';
import type { SingleImageConfig } from '../../../data/models';
import styles from './ConfigForms.module.css';

export type SingleImageConfigFormProps = {
    config: SingleImageConfig;
    onChange$: PropFunction<(cfg: SingleImageConfig) => void>;
};

export const SingleImageConfigForm = component$<SingleImageConfigFormProps>((props) => {
    const update$ = $((patch: Partial<SingleImageConfig>) => {
        return props.onChange$({ ...props.config, ...patch });
    });

    return (
        <div class={styles.form}>
            <label class={styles.row}>
                <span class={styles.label}>Max size (MB)</span>
                <input
                    type="number"
                    min={1}
                    class={styles.input}
                    value={props.config.maxSizeMB ?? 5}
                    onInput$={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        const n = raw === '' ? undefined : parseFloat(raw);
                        update$({ maxSizeMB: Number.isFinite(n) ? n : undefined });
                    }}
                />
            </label>

            <label class={styles.row}>
                <input
                    type="checkbox"
                    class={styles.checkbox}
                    checked={!!props.config.requireCaption}
                    onChange$={(e) => update$({ requireCaption: (e.target as HTMLInputElement).checked })}
                />
                <span class={styles.label}>Require caption</span>
            </label>

            <label class={styles.row}>
                <span class={styles.label}>Aspect hint</span>
                <input
                    type="text"
                    class={styles.input}
                    value={props.config.aspectHint ?? ''}
                    placeholder="e.g. 4:3"
                    onInput$={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        update$({ aspectHint: v === '' ? undefined : v });
                    }}
                />
            </label>
        </div>
    );
});
