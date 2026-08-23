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
import { LIBRARY_CHROME_IDS, kindArchetypeId } from '../../data/definitionIds';
import { getInlineManifest, getKindManifest } from '../../kinds/registry';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import { configChildId } from '../../kinds/configElements';
import type { Kind } from '../../data/models';
import styles from './ConfigSummary.module.css';

export type ConfigSummaryProps = {
    definitionId: string;
    /**
     * The Definition's kind — the other half of the provenance line, and always
     * known: a Field's kind *is* its Definition's kind. Named by the manifest's
     * `pickerLabel` ("Text"), the same word the Add Surface offered when the
     * Definition was picked, rather than the raw slug the Kind card wears as a
     * subtitle.
     */
    kind: Kind;
    /**
     * The Definition's label — the second half of the provenance line. Omitted
     * where the Definition is *where you already are* (the Library's own
     * preview), which leaves the line naming only the Kind: a link back to the
     * row drawing it would go nowhere (ISSUES #55).
     */
    source?: string;
    /**
     * Schema-complete mode (the Library's Definition preview): render one row
     * per entry of the kind's config schema, with "—" where the Definition
     * stores no sub-field — instead of only the stored sub-fields. Display-level
     * only; nothing is materialized into storage.
     */
    schemaComplete?: boolean;
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

    /**
     * The same travel, one lens over: the Kinds index, where the archetype this
     * Definition was cut from lives. `kindArchetypeId` rather than an Element id
     * — a kind has no row in storage — and the reveal does not care, since it
     * matches on a string.
     */
    const showKindInLibrary = () => {
        revealElement({
            elementId: kindArchetypeId(props.kind),
            branchId: LIBRARY_CHROME_IDS.kinds,
        });
    };

    const kindLabel = () => getKindManifest(props.kind).pickerLabel;

    const rows = createMemo((): SummaryRow[] => {
        const stored = subFields();
        if (!props.schemaComplete) {
            return stored.map((sub) => ({
                label: sub.name,
                text: getInlineManifest(sub.kind).displayPreview(sub.value) ?? '—',
            }));
        }
        // Schema-complete: every knob the kind declares, stored value or "—".
        const byId = new Map(stored.map((sub) => [sub.id, sub]));
        return (CONFIG_SCHEMAS[props.kind] ?? []).map((entry) => {
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
            {/* Provenance, and the two ways back — *from Text / Description*.
                Both halves are links because both name somewhere that exists:
                the Kind's archetype card and the Definition's own card, one
                Library lens apart. Making only one of them travel would leave
                the same word clickable in one lens and inert in another.

                Outside the rows gate on purpose. A Definition that stores no
                config sub-field is still a Definition, and those are precisely
                the Fields that most need the way back to it: `serializeConfig`
                writes a child only for a knob that is set, and `text-kv`'s
                `defaultConfig()` is `{}`, so every text-kv Definition authored
                without opening the Config band has an empty subtree. Gating the
                line on the rows meant "No configuration" also meant "no way
                back", which is the one case where provenance is all there is. */}
            <div class={styles.provenance}>
                {/* Explicit space expressions, not literal whitespace between
                    JSX elements: that whitespace is trimmed at the newline, so
                    the separators have to be written as text to survive. */}
                {'from '}
                <button
                    type="button"
                    class={styles.sourceLink}
                    onClick={showKindInLibrary}
                    aria-label={`Show the ${kindLabel()} kind in the Field Library`}
                >
                    {kindLabel()}
                </button>
                <Show when={props.source}>
                    {(source) => (
                        <>
                            {' / '}
                            <button
                                type="button"
                                class={styles.sourceLink}
                                onClick={showInLibrary}
                                aria-label={`Show ${source()} in the Field Library`}
                            >
                                {source()}
                            </button>
                        </>
                    )}
                </Show>
            </div>
        </div>
    );
};
