/**
 * DataFieldDetails - Inline metadata, history viewer (read-only for now), and
 * delete action displayed when a DataField is expanded.
 *
 * Preview/revert from history was removed during the Component split — the
 * preview state is now owned by each Component's renderer via useFieldEdit,
 * and hoisting it across the Component boundary is deferred.
 */

import { component$, useSignal, useVisibleTask$, $, type PropFunction } from '@builder.io/qwik';
import { getFieldQueries, getTemplateQueries } from '../../data/queries';
import { formatTimestampShort } from '../../utils/time';
import type { ComponentType, DataFieldHistory as HistoryEntry, DataFieldTemplate, MeasurementKvConfig } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    fieldName: string;
    templateId: string;
    componentType: ComponentType;
    currentValue: string | null;
    onDelete$: PropFunction<() => void>;
};

export const DataFieldDetails = component$<DataFieldDetailsProps>((props) => {
    const history = useSignal<HistoryEntry[]>([]);
    const template = useSignal<DataFieldTemplate | null>(null);
    const isLoaded = useSignal(false);
    const isHistoryOpen = useSignal(false);

    useVisibleTask$(async () => {
        try {
            const [h, tpl] = await Promise.all([
                getFieldQueries().getFieldHistory(props.fieldId),
                getTemplateQueries().getTemplateById(props.templateId),
            ]);
            history.value = h;
            template.value = tpl;
        } catch (e) {
            console.error('Failed to load field details:', e);
        } finally {
            isLoaded.value = true;
        }
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

    const hasHistory = history.value.length > 0;

    const units = template.value?.componentType === 'measurement-kv'
        ? (template.value.config as MeasurementKvConfig).units
        : '';

    return (
        <div class={[styles.inlineWrapper, 'no-caret']}>
            <span class={[styles.spacer, 'no-caret']}></span>

            <span class={[styles.metadata, 'no-caret']}>{metadataText}</span>

            <button
                type="button"
                class={styles.historyChevron}
                onClick$={toggleHistory$}
                aria-expanded={isHistoryOpen.value}
                aria-label={isHistoryOpen.value ? 'Close field history' : 'Open field history'}
                disabled={!hasHistory}
                title={!hasHistory ? 'No history available' : 'View field history'}
            >
                {isHistoryOpen.value ? '▾' : '◂'}
            </button>

            {isHistoryOpen.value && hasHistory && (
                <div class={[styles.historyRow, 'no-caret']}>
                    <DataFieldHistory
                        fieldId={props.fieldId}
                        history={history.value}
                        componentType={props.componentType}
                        units={units}
                        isOpen={isHistoryOpen.value}
                    />
                </div>
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
