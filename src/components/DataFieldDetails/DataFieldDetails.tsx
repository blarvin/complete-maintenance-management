/**
 * DataFieldDetails - Inline metadata, history viewer (read-only for now), and
 * delete action displayed when a DataField is expanded.
 *
 * Preview/revert from history was removed during the Component split — the
 * preview state is now owned by each Component's renderer via useFieldEdit,
 * and hoisting it across the Component boundary is deferred.
 */

import { component$, useSignal, useVisibleTask$, $, type PropFunction } from '@builder.io/qwik';
import { getElementQueries, getFieldDefinitionQueries } from '../../data/queries';
import { formatTimestampShort } from '../../utils/time';
import { storageEventBus } from '../../data/storageEventBus';
import type { ComponentType, DataFieldHistory as HistoryEntry, FieldDefinition, NumberKvConfig, ElementHistory, DataFieldValue } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    fieldName: string;
    fieldDefinitionId: string;
    componentType: ComponentType;
    currentValue: string | null;
    onDelete$: PropFunction<() => void>;
};

export const DataFieldDetails = component$<DataFieldDetailsProps>((props) => {
    const history = useSignal<HistoryEntry[]>([]);
    const definition = useSignal<FieldDefinition | null>(null);
    const isLoaded = useSignal(false);
    const isHistoryOpen = useSignal(false);

    const fetchHistory$ = $(async (): Promise<HistoryEntry[]> => {
        const rows = await getElementQueries().getElementHistory(props.fieldId);
        return projectValueHistory(rows, props.componentType, props.fieldId);
    });

    useVisibleTask$(async () => {
        try {
            const [h, def] = await Promise.all([
                fetchHistory$(),
                getFieldDefinitionQueries().getFieldDefinitionById(props.fieldDefinitionId),
            ]);
            history.value = h;
            definition.value = def;
        } catch (e) {
            console.error('Failed to load field details:', e);
        } finally {
            isLoaded.value = true;
        }
    });

    useVisibleTask$(({ cleanup }) => {
        const unsubscribe = storageEventBus.subscribe(async (event) => {
            if (event.type !== 'ELEMENT_WRITTEN') return;
            if (event.element.id !== props.fieldId) return;
            try {
                history.value = await fetchHistory$();
            } catch (e) {
                console.error('Failed to refresh field history:', e);
            }
        });
        cleanup(() => unsubscribe());
    });

    const handleDelete$ = $(() => {
        props.onDelete$();
    });

    const toggleHistory$ = $(() => {
        isHistoryOpen.value = !isHistoryOpen.value;
    });

    const latestEntry = history.value.length > 0
        ? history.value[history.value.length - 1]
        : null;

    const editAt = latestEntry?.updatedAt ? formatTimestampShort(latestEntry.updatedAt) : '';
    const editBy = latestEntry?.updatedBy ?? '';

    const metadataText = isLoaded.value && editAt
        ? `${editAt}  ${editBy}`
        : '...';

    // The most recent entry duplicates the live value and is hidden by
    // DataFieldHistory; require at least 2 entries before enabling the chevron.
    const hasHistory = history.value.length > 1;

    const units = definition.value?.componentType === 'number-kv'
        ? (definition.value.config as NumberKvConfig).unitsSymbol
        : '';

    return (
        <div class={[styles.inlineWrapper, 'no-caret']}>
            <span class={[styles.metadata, 'no-caret']}>{metadataText}</span>

            <button
                type="button"
                class={[
                    styles.historyChevron,
                    isHistoryOpen.value ? styles.historyChevronDown : styles.historyChevronLeft,
                ]}
                onClick$={toggleHistory$}
                aria-expanded={isHistoryOpen.value}
                aria-label={isHistoryOpen.value ? 'Close field history' : 'Open field history'}
                disabled={!hasHistory}
                title={!hasHistory ? 'No history available' : 'View field history'}
            />

            {isHistoryOpen.value && hasHistory && (
                <DataFieldHistory
                    fieldId={props.fieldId}
                    history={history.value}
                    componentType={props.componentType}
                    units={units}
                    isOpen={isHistoryOpen.value}
                />
            )}

            <div class={[styles.actionsRow, 'no-caret']}>
                <button
                    type="button"
                    class={styles.deleteButton}
                    onClick$={handleDelete$}
                    aria-label="Delete this field"
                >
                    Delete Field
                </button>
            </div>
        </div>
    );
});

/**
 * Project ElementHistory rows into the legacy DataFieldHistory shape the
 * history viewer expects. Only value-property rows survive — name/subtitle/
 * parentId/siblingOrder edits are not field-value history.
 */
function projectValueHistory(
    rows: ElementHistory[],
    componentType: ComponentType,
    elementId: string,
): HistoryEntry[] {
    return rows
        .filter(r => r.property === 'value')
        .sort((a, b) => a.rev - b.rev)
        .map(r => ({
            id: r.id,
            dataFieldId: elementId,
            action: r.action,
            property: 'value',
            componentType,
            prevValue: r.prevValue as DataFieldValue | null,
            newValue: r.newValue as DataFieldValue | null,
            updatedBy: r.updatedBy,
            updatedAt: r.updatedAt,
            rev: r.rev,
        }) as HistoryEntry);
}
