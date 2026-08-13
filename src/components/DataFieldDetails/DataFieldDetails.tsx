/**
 * DataFieldDetails - Inline metadata, history viewer, and delete action
 * displayed when a DataField is expanded.
 *
 * Preview/revert from history was removed during the Component split — the
 * preview state is now owned by each Component's renderer via useFieldEdit,
 * and hoisting it across the Component boundary is deferred.
 *
 * Lifecycle lives in component setup (fieldId is a mount-time constant; the
 * panel remounts per expand). Subscribe-before-first-load: the bus
 * subscription is registered before the initial fetch fires, so a write
 * landing between mount and the first fetch can't be missed.
 */

import { Show, createSignal, onCleanup } from 'solid-js';
import { getElementQueries, getDefinitionQueries } from '../../data/queries';
import { formatTimestampShort } from '../../utils/time';
import { storageEventBus } from '../../data/storageEventBus';
import { compareHistory } from '../../data/storage/historyHelpers';
import type { Kind, Definition, ElementHistory } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    definitionId: string;
    kind: Kind;
    onDelete: () => void;
};

export const DataFieldDetails = (props: DataFieldDetailsProps) => {
    const [history, setHistory] = createSignal<ElementHistory[]>([]);
    const [definition, setDefinition] = createSignal<Definition | null>(null);
    const [isLoaded, setIsLoaded] = createSignal(false);
    const [isHistoryOpen, setIsHistoryOpen] = createSignal(false);

    // Only value-edit rows are field-value history (name/subtitle/parentId/
    // siblingOrder edits are not). Sorted ascending (oldest first) so the
    // history viewer can drop the last entry as the live-duplicate.
    // `compareHistory` is the shared order — `rev` alone stopped being a total
    // order once two clients could both mint rev 5 (Tech Debt #4).
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

    const toggleHistory = () => setIsHistoryOpen(!isHistoryOpen());

    const latestEntry = () => (history().length > 0 ? history()[history().length - 1] : null);

    const metadataText = () => {
        const entry = latestEntry();
        const editAt = entry?.updatedAt ? formatTimestampShort(entry.updatedAt) : '';
        const editBy = entry?.updatedBy ?? '';
        return isLoaded() && editAt ? `${editAt}  ${editBy}` : '...';
    };

    // The most recent entry duplicates the live value and is hidden by
    // DataFieldHistory; require at least 2 entries before enabling the chevron.
    const hasHistory = () => history().length > 1;

    return (
        <div classList={{ [styles.inlineWrapper]: true, 'no-caret': true }}>
            <span classList={{ [styles.metadata]: true, 'no-caret': true }}>{metadataText()}</span>

            <button
                type="button"
                classList={{
                    [styles.historyChevron]: true,
                    [styles.historyChevronDown]: isHistoryOpen(),
                    [styles.historyChevronLeft]: !isHistoryOpen(),
                }}
                onClick={toggleHistory}
                aria-expanded={isHistoryOpen()}
                aria-label={isHistoryOpen() ? 'Close field history' : 'Open field history'}
                disabled={!hasHistory()}
                title={!hasHistory() ? 'No history available' : 'View field history'}
            />

            <Show when={isHistoryOpen() && hasHistory()}>
                <DataFieldHistory
                    fieldId={props.fieldId}
                    history={history()}
                    kind={props.kind}
                    config={definition()?.config}
                    isOpen={isHistoryOpen()}
                />
            </Show>

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
        </div>
    );
};
