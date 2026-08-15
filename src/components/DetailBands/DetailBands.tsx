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
 * Open/closed state lives here, keyed by band id, so a host only declares its
 * bands' working defaults.
 */

import { For, Show, createSignal } from 'solid-js';
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
};

export const DetailBands = (props: DetailBandsProps) => {
    const [openBands, setOpenBands] = createSignal<Record<string, boolean>>({});

    const isOpen = (id: string, fallback: boolean) => openBands()[id] ?? fallback;
    const toggle = (id: string, fallback: boolean) =>
        setOpenBands({ ...openBands(), [id]: !isOpen(id, fallback) });

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
                                onClick={() => toggle(band.id, band.defaultOpen)}
                            >
                                <span
                                    classList={{
                                        [styles.sectionChevron]: true,
                                        [styles.sectionChevronDown]: isOpen(band.id, band.defaultOpen),
                                        [styles.sectionChevronRight]: !isOpen(band.id, band.defaultOpen),
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
