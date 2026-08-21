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

import { For, Show, createMemo } from 'solid-js';
import { useElementChildren } from '../../hooks/useElementChildren';
import { getInlineManifest } from '../../kinds/registry';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import { configChildId } from '../../kinds/configElements';
import type { Kind } from '../../data/models';
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
    /**
     * Schema-complete mode (the Library's Definition preview): render one row
     * per entry of this kind's config schema, with "—" where the Definition
     * stores no sub-field — instead of only the stored sub-fields. Display-level
     * only; nothing is materialized into storage.
     */
    schemaKind?: Kind;
};

type SummaryRow = { label: string; text: string };

export const ConfigSummary = (props: ConfigSummaryProps) => {
    const { children: subFields } = useElementChildren(() => props.definitionId, 'fields');

    const rows = createMemo((): SummaryRow[] => {
        const stored = subFields();
        if (!props.schemaKind) {
            return stored.map((sub) => ({
                label: sub.name,
                text: getInlineManifest(sub.kind).displayPreview(sub.value) ?? '—',
            }));
        }
        // Schema-complete: every knob the kind declares, stored value or "—".
        const byId = new Map(stored.map((sub) => [sub.id, sub]));
        return (CONFIG_SCHEMAS[props.schemaKind] ?? []).map((entry) => {
            const sub = byId.get(configChildId(props.definitionId, entry.key));
            return {
                label: entry.label,
                text: sub ? (getInlineManifest(sub.kind).displayPreview(sub.value) ?? '—') : '—',
            };
        });
    });

    return (
        <div class={styles.summary} role="group">
            <Show
                when={rows().length > 0}
                fallback={<span class={styles.empty}>No configuration</span>}
            >
                <For each={rows()}>
                    {(row) => (
                        <div class={styles.row}>
                            <span class={styles.label}>{row.label}</span>
                            <span class={styles.value}>{row.text}</span>
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
