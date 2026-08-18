/**
 * ConfigSummary — a Definition's config, read-only.
 *
 * One component for the two surfaces that show config without editing it: the
 * Library picker's row peek (where it disambiguates two same-named Definitions)
 * and a Field's Details → Config section (where it says what the field *means*).
 * Shared deliberately — they render the same thing for the same reason, and two
 * copies would drift.
 *
 * **Read-only by construction.** Values go through each kind's `displayPreview`,
 * never its `Renderer`: a Renderer *is* the editable surface, so mounting
 * `TextKvField` for a Definition's `placeholder` would make it double-tap
 * editable inside a picker. It is also what Phase 1 owes — every config
 * sub-field is `delegated`, so an instance shows what its Definition says and
 * the override is the cascade arbiter's job (SPEC → Field Details).
 *
 * Config *is* Elements, so this reads the Definition's child subtree rather than
 * an assembled blob.
 */

import { For, Show } from 'solid-js';
import { useElementChildren } from '../../hooks/useElementChildren';
import { getInlineManifest } from '../../kinds/registry';
import styles from './ConfigSummary.module.css';

export type ConfigSummaryProps = {
    definitionId: string;
    /**
     * Where these values come from — the Definition's label. Rendered as a
     * provenance line so a reader can tell that the config belongs to the
     * Definition rather than to this instance. Omitted by the picker, where the
     * rows already sit inside the Definition's own row.
     */
    source?: string;
};

export const ConfigSummary = (props: ConfigSummaryProps) => {
    const { children: subFields } = useElementChildren(() => props.definitionId, 'fields');

    return (
        <div class={styles.summary} role="group">
            <Show
                when={subFields().length > 0}
                fallback={<span class={styles.empty}>No configuration</span>}
            >
                <For each={subFields()}>
                    {(sub) => (
                        <div class={styles.row}>
                            <span class={styles.label}>{sub.name}</span>
                            <span class={styles.value}>
                                {getInlineManifest(sub.kind).displayPreview(sub.value) ?? '—'}
                            </span>
                        </div>
                    )}
                </For>
                <Show when={props.source}>
                    <div class={styles.source}>from {props.source}</div>
                </Show>
            </Show>
        </div>
    );
};
