/**
 * DataFieldDetails — the Field's own Data Card (SPEC → Field Details).
 *
 * A Field is an Element with `placement: inline`, so its Details region is not a
 * special panel: it is the same three-region card any Element gets — **History,
 * Config, Tools** — with *which* regions exist entailed by the kind's manifest
 * rather than fixed. One section per source of content a Field has: its own
 * value over time (a read), its children (data), and things done to it (chrome,
 * and later `Action`). A fourth must earn its place the way a kind earns the
 * registry.
 *
 * The band chrome itself (headings, chevrons, open/closed state) lives in
 * `DetailBands`, shared with the Add Surface's draft row — SPEC says the two are
 * the same row shell, so the bands are the same code. This module owns only
 * *which* bands a persisted Field has and what goes in them. The working default
 * is History open and uncollapsible, Config and Tools behind their own chevrons.
 *
 * Layout note: `.inlineWrapper` is `display: contents`, so everything here lands
 * as a grid item of the parent DataField's subgrid — and `DetailBands` is
 * `display: contents` for the same reason. `DataFieldHistory` entries depend on
 * being *direct* subgrid children, so the History band deliberately has no
 * wrapper element — a div around it would break that contract.
 *
 * Lifecycle lives in component setup (fieldId is a mount-time constant; the
 * panel remounts per expand). Subscribe-before-first-load: the bus subscription
 * is registered before the initial fetch fires, so a write landing between mount
 * and the first fetch can't be missed.
 */

import { Show, createSignal, onCleanup } from 'solid-js';
import { getElementQueries, getDefinitionQueries } from '../../data/queries';
import { formatTimestampShort } from '../../utils/time';
import { storageEventBus } from '../../data/storageEventBus';
import { compareHistory } from '../../data/storage/historyHelpers';
import { storesOwnValue } from '../../kinds/childrenPolicy';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import type { Kind, Definition, ElementHistory } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import { ConfigSummary } from '../ConfigSummary/ConfigSummary';
import { ElementIdRow } from '../ElementIdRow/ElementIdRow';
import { DetailBands, type DetailBand } from '../DetailBands/DetailBands';
import bands from '../DetailBands/DetailBands.module.css';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    definitionId: string;
    kind: Kind;
    onDelete: () => void;
};

/** Whether this kind has config at all. Genuinely discriminating today: the two
 *  link kinds declare no schema, so they show two sections rather than an empty
 *  third one. */
const hasConfig = (kind: Kind): boolean => (CONFIG_SCHEMAS[kind]?.length ?? 0) > 0;

export const DataFieldDetails = (props: DataFieldDetailsProps) => {
    const [history, setHistory] = createSignal<ElementHistory[]>([]);
    const [definition, setDefinition] = createSignal<Definition | null>(null);
    const [isLoaded, setIsLoaded] = createSignal(false);

    // Only value-edit rows are field-value history (name/subtitle/parentId/
    // siblingOrder edits are not). Sorted ascending (oldest first) so the
    // history viewer can drop the last entry as the live-duplicate.
    // `compareHistory` is the shared order — `rev` alone stopped being a total
    // order once two clients could both mint rev 5 (IMPLEMENTATION.md →
    // *History ID Scheme*).
    const fetchHistory = async (): Promise<ElementHistory[]> => {
        const rows = await getElementQueries().getElementHistory(props.fieldId);
        return rows.filter(r => r.property === 'value').sort(compareHistory);
    };

    // Shared stale-async guard for the subscription callback and initial load.
    let disposed = false;
    /* eslint-disable solid/reactivity -- mount-time constants; the panel remounts per expand (<Show> in DataField) */
    const unsubscribe = storageEventBus.subscribe(async (event) => {
        if (event.type !== 'ELEMENT_WRITTEN') return;
        if (event.element.id !== props.fieldId) return;
        try {
            const h = await fetchHistory();
            if (!disposed) setHistory(h);
        } catch (e) {
            console.error('Failed to refresh field history:', e);
        }
    });
    onCleanup(() => {
        disposed = true;
        unsubscribe();
    });

    void (async () => {
        try {
            const [h, def] = await Promise.all([
                fetchHistory(),
                getDefinitionQueries().getDefinitionById(props.definitionId),
            ]);
            if (!disposed) {
                setHistory(h);
                setDefinition(def);
            }
        } catch (e) {
            console.error('Failed to load field details:', e);
        } finally {
            if (!disposed) setIsLoaded(true);
        }
    })();
    /* eslint-enable solid/reactivity */

    const latestEntry = () => (history().length > 0 ? history()[history().length - 1] : null);

    const metadataText = () => {
        const entry = latestEntry();
        const editAt = entry?.updatedAt ? formatTimestampShort(entry.updatedAt) : '';
        const editBy = entry?.updatedBy ?? '';
        return isLoaded() && editAt ? `${editAt}  ${editBy}` : '...';
    };

    // The most recent entry duplicates the live value and is hidden by
    // DataFieldHistory, so a single entry means nothing to show.
    const hasHistoryEntries = () => history().length > 1;

    const sections = (): DetailBand[] => [
        {
            id: 'history',
            // No heading: the entries are self-evidently the value over time,
            // and the section is always open, so a label only adds noise above
            // the field's own name.
            title: null,
            present: storesOwnValue(props.kind),
            collapsible: false,
            defaultOpen: true,
            body: () => (
                <Show
                    when={hasHistoryEntries()}
                    fallback={<div class={bands.sectionNote}>No changes yet</div>}
                >
                    {/* No wrapper: entries must stay direct subgrid children. */}
                    <DataFieldHistory
                        fieldId={props.fieldId}
                        history={history()}
                        kind={props.kind}
                        config={definition()?.config}
                        isOpen
                    />
                </Show>
            ),
        },
        {
            id: 'config',
            title: 'Config',
            present: hasConfig(props.kind),
            collapsible: true,
            defaultOpen: false,
            // Inert on purpose. Every config sub-field is `delegated` in Phase 1:
            // it lives on the Definition and is read live, so an instance shows
            // what its Definition says and the override is the cascade arbiter's
            // job (SPEC → Field Details). Do not "fix" this into editable rows
            // without the arbiter — an edit here would mutate shared meaning.
            body: () => (
                <div class={bands.sectionBody}>
                    <ConfigSummary
                        definitionId={props.definitionId}
                        source={definition()?.label}
                    />
                </div>
            ),
        },
        {
            id: 'tools',
            title: 'Tools',
            present: true,
            collapsible: true,
            defaultOpen: false,
            body: () => (
                <>
                    {/* The id spans the same tracks the actions row does, rather
                        than sitting in one column: it is a line of text, not an
                        action pinned to a track. */}
                    <div classList={{ [styles.idRow]: true, 'no-caret': true }}>
                        <ElementIdRow id={props.fieldId} />
                    </div>
                    <div classList={{ [styles.actionsRow]: true, 'no-caret': true }}>
                        <button
                            type="button"
                            class={styles.deleteButton}
                            onClick={() => props.onDelete()}
                            aria-label="Delete this field"
                        >
                            Delete Field
                        </button>
                    </div>
                </>
            ),
        },
    ];

    return (
        <div classList={{ [styles.inlineWrapper]: true, 'no-caret': true }}>
            <span classList={{ [styles.metadata]: true, 'no-caret': true }}>{metadataText()}</span>

            <DetailBands bands={sections()} persistKey={props.fieldId} />
        </div>
    );
};
