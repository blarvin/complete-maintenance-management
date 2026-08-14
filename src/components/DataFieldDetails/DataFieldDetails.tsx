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
 * **Stacking is deliberately unsettled** (SPEC → *Stacking is open*), which is
 * why the sections are a list rather than three nested components: changing
 * which ones collapse is editing `collapsible` in one place. The working default
 * is History open and uncollapsible, Config and Tools behind their own chevrons.
 *
 * Layout note: `.inlineWrapper` is `display: contents`, so everything here lands
 * as a grid item of the parent DataField's subgrid. `DataFieldHistory` entries
 * depend on being *direct* subgrid children, so the History section deliberately
 * has no wrapper element — a div around it would break that contract.
 *
 * Lifecycle lives in component setup (fieldId is a mount-time constant; the
 * panel remounts per expand). Subscribe-before-first-load: the bus subscription
 * is registered before the initial fetch fires, so a write landing between mount
 * and the first fetch can't be missed.
 */

import { For, Show, createSignal, onCleanup } from 'solid-js';
import { getElementQueries, getDefinitionQueries } from '../../data/queries';
import { formatTimestampShort } from '../../utils/time';
import { storageEventBus } from '../../data/storageEventBus';
import { compareHistory } from '../../data/storage/historyHelpers';
import { storesOwnValue } from '../../kinds/childrenPolicy';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import type { Kind, Definition, ElementHistory } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import { ConfigSummary } from '../ConfigSummary/ConfigSummary';
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
    const [openSections, setOpenSections] = createSignal<Record<string, boolean>>({});

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

    const isOpen = (id: string, fallback: boolean) => openSections()[id] ?? fallback;
    const toggle = (id: string, fallback: boolean) =>
        setOpenSections({ ...openSections(), [id]: !isOpen(id, fallback) });

    type Section = {
        id: string;
        title: string;
        present: boolean;
        /** Working default; the one line to edit when experimenting with stacking. */
        collapsible: boolean;
        defaultOpen: boolean;
        body: () => unknown;
    };

    const sections = (): Section[] => [
        {
            id: 'history',
            title: 'History',
            present: storesOwnValue(props.kind),
            collapsible: false,
            defaultOpen: true,
            body: () => (
                <Show
                    when={hasHistoryEntries()}
                    fallback={<div class={styles.sectionNote}>No changes yet</div>}
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
                <div class={styles.sectionBody}>
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
            ),
        },
    ];

    return (
        <div classList={{ [styles.inlineWrapper]: true, 'no-caret': true }}>
            <span classList={{ [styles.metadata]: true, 'no-caret': true }}>{metadataText()}</span>

            <For each={sections().filter((s) => s.present)}>
                {(section) => (
                    <>
                        <Show
                            when={section.collapsible}
                            fallback={<div class={styles.sectionHeading}>{section.title}</div>}
                        >
                            <button
                                type="button"
                                classList={{
                                    [styles.sectionHeading]: true,
                                    [styles.sectionToggle]: true,
                                }}
                                aria-expanded={isOpen(section.id, section.defaultOpen)}
                                onClick={() => toggle(section.id, section.defaultOpen)}
                            >
                                <span
                                    classList={{
                                        [styles.sectionChevron]: true,
                                        [styles.sectionChevronDown]: isOpen(section.id, section.defaultOpen),
                                        [styles.sectionChevronRight]: !isOpen(section.id, section.defaultOpen),
                                    }}
                                    aria-hidden="true"
                                />
                                {section.title}
                            </button>
                        </Show>
                        <Show when={!section.collapsible || isOpen(section.id, section.defaultOpen)}>
                            {section.body() as never}
                        </Show>
                    </>
                )}
            </For>
        </div>
    );
};
