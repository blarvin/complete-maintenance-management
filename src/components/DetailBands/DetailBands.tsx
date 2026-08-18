/**
 * DetailBands — the expandable band region beneath a Field row.
 *
 * One list of bands, each a heading (or a heading that is its own toggle) plus a
 * body. Two surfaces render it: a persisted Field's Details (History · Config ·
 * Tools) and the Add Surface's draft row (Config · Kind · Tools). Shared
 * deliberately — SPEC → The Add Surface says the two are the *same* row shell
 * differing only in what fills each slot, and two copies of the band chrome
 * would make that a resemblance rather than a fact.
 *
 * **Stacking is deliberately unsettled** (SPEC → *Stacking is open*), which is
 * why bands are a list rather than N nested components: changing which ones
 * collapse is editing `collapsible` at one call site.
 *
 * **Load-bearing: this component is `display: contents`.** Both hosts sit in
 * `FieldList`'s subgrid, and their band bodies (History entries especially) must
 * land as *direct* subgrid children of the row wrapper. A real wrapper element
 * here breaks the History layout.
 *
 * **Open/closed state is device-local view state, not component state** — it
 * lives in `uiPrefs` beside card and field-details expansion (SPEC → *Manifest →
 * chrome*: expand/collapse is device-local view state). It has to: the details
 * region remounts on every collapse (`<Show>` in DataField), so a signal here
 * dropped the user's band choices every time they shut the field. What is stored
 * is the **override**, not the value — a band nobody has touched follows
 * whatever `defaultOpen` currently says, which is what keeps the working
 * defaults editable while stacking is unsettled.
 *
 * A host declares its bands' defaults and a `persistKey` to scope them by.
 */

import { For, Show } from 'solid-js';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import chevron from '../../styles/disclosure.module.css';
import styles from './DetailBands.module.css';

export type DetailBand = {
    id: string;
    /** Heading text, or `null` for a band that shows none. Only a
     *  non-collapsible band may omit it — for a collapsible one the heading
     *  *is* the toggle. */
    title: string | null;
    present: boolean;
    /** Working default; the one line to edit when experimenting with stacking. */
    collapsible: boolean;
    defaultOpen: boolean;
    body: () => unknown;
};

export type DetailBandsProps = {
    bands: DetailBand[];
    /**
     * Scopes this row's band state in `uiPrefs` (stored as `${persistKey}:${id}`).
     * A persisted Field uses its own id; the Add Surface keys by *node* instead,
     * because its draft row has no persistent identity and a per-draft key would
     * strand an entry on every Create.
     */
    persistKey: string;
};

export const DetailBands = (props: DetailBandsProps) => {
    const appState = useAppState();
    const { toggleBandOpen } = useAppTransitions();

    const bandKey = (id: string) => `${props.persistKey}:${id}`;

    const isOpen = (id: string, defaultOpen: boolean) =>
        selectors.isBandToggled(appState, bandKey(id)) ? !defaultOpen : defaultOpen;
    const toggle = (id: string) => toggleBandOpen(bandKey(id));

    return (
        <div class={styles.bands}>
            <For each={props.bands.filter((b) => b.present)}>
                {(band) => (
                    <>
                        <Show
                            when={band.collapsible}
                            fallback={
                                <Show when={band.title}>
                                    <div class={styles.sectionHeading}>{band.title}</div>
                                </Show>
                            }
                        >
                            <button
                                type="button"
                                classList={{
                                    [styles.sectionHeading]: true,
                                    [styles.sectionToggle]: true,
                                }}
                                aria-expanded={isOpen(band.id, band.defaultOpen)}
                                onClick={() => toggle(band.id)}
                            >
                                <span
                                    classList={{
                                        [styles.sectionChevron]: true,
                                        [chevron.glyph]: true,
                                        [chevron.glyphDown]: isOpen(band.id, band.defaultOpen),
                                        [chevron.glyphRight]: !isOpen(band.id, band.defaultOpen),
                                    }}
                                    aria-hidden="true"
                                />
                                {band.title}
                            </button>
                        </Show>
                        <Show when={!band.collapsible || isOpen(band.id, band.defaultOpen)}>
                            {band.body() as never}
                        </Show>
                    </>
                )}
            </For>
        </div>
    );
};
