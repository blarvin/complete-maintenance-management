/**
 * ConfigSummary — a Definition's config, read-only.
 *
 * One component for the two surfaces that show config without editing it: the
 * Add Surface's band once a Library Definition is picked, and a Field's
 * Details → Config section (where it says what the field *means*). Shared
 * deliberately — they render the same thing for the same reason, and two copies
 * would drift.
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
import { useAppTransitions } from '../../state/appState';
import { LIBRARY_CHROME_IDS } from '../../data/definitionIds';
import { getInlineManifest } from '../../kinds/registry';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import { configChildId } from '../../kinds/configElements';
import type { Kind } from '../../data/models';
import styles from './ConfigSummary.module.css';

export type ConfigSummaryProps = {
    definitionId: string;
    /**
     * Where these values come from — the Definition's label. Rendered as a
     * provenance line, and *as the link to the Library*: the line already names
     * the Definition, so making it the affordance costs the Config band no new
     * row (it is already deeply nested, ISSUES #38). Optional so a caller with
     * no Definition to name can still show the rows; every caller today has one.
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
    const { revealElement } = useAppTransitions();

    /**
     * Travel to the Definition in the Library's Definitions lens — a reveal, not
     * a re-root to the Library, so it costs nothing if it wasn't what you
     * wanted. The same transition `internal-link`'s `→` uses, hence a button
     * rather than a URL.
     *
     * `branchId` is the `definitions` chrome element, not the Definition's own
     * `parentId`: a Definition is a `library`-tree *root* (parentId null), and
     * null would land on the ROOT view of the business tree instead of the lens
     * that draws it.
     */
    const showInLibrary = () => {
        revealElement({
            elementId: props.definitionId,
            branchId: LIBRARY_CHROME_IDS.definitions,
        });
    };

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
            </Show>
            {/* Outside the rows gate on purpose. A Definition that stores no
                config sub-field is still a Definition, and those are precisely
                the Fields that most need the way back to it: `serializeConfig`
                writes a child only for a knob that is set, and `text-kv`'s
                `defaultConfig()` is `{}`, so every text-kv Definition authored
                without opening the Config band has an empty subtree. Gating the
                line on the rows meant "No configuration" also meant "no way
                back", which is the one case where provenance is all there is. */}
            <Show when={props.source}>
                {(source) => (
                    <button
                        type="button"
                        class={styles.source}
                        onClick={showInLibrary}
                        aria-label={`Show ${source()} in the Field Library`}
                    >
                        from {source()}
                    </button>
                )}
            </Show>
        </div>
    );
};
