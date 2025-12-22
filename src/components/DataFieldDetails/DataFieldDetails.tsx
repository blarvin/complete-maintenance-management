/**
 * DataFieldDetails - Inline metadata and actions displayed when DataField is expanded.
 * Renders as grid items: metadata text, spacer/revert, history chevron, and actions row.
 * Uses display:contents so items become direct children of parent grid.
 */

import { component$, useSignal, useVisibleTask$, $, PropFunction } from '@builder.io/qwik';
import { getFieldService } from '../../data/services';
import { formatTimestampShort } from '../../utils/time';
import type { DataFieldHistory as HistoryEntry } from '../../data/models';
import { DataFieldHistory } from '../DataFieldHistory/DataFieldHistory';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    fieldName: string;
    currentValue: string | null;
    onDelete$: PropFunction<() => void>;
    onPreviewChange$: PropFunction<(value: string | null) => void>;
    onRevert$: PropFunction<(value: string | null) => void>;
};

export const DataFieldDetails = component$<DataFieldDetailsProps>((props) => {
    const history = useSignal<HistoryEntry[]>([]);
    const isLoaded = useSignal(false);
    const isHistoryOpen = useSignal(false);
    const selectedValue = useSignal<string | null>(null);

    // Load history on mount
    useVisibleTask$(async () => {
        try {
            const h = await getFieldService().getFieldHistory(props.fieldId);
            history.value = h;
        } catch (e) {
            console.error('Failed to load field history:', e);
        } finally {
            isLoaded.value = true;
        }
    });

    const handleDelete$ = $(() => {
        props.onDelete$();
    });

    const handlePreviewChange$ = $((value: string | null) => {
        selectedValue.value = value;
        props.onPreviewChange$(value);
    });

    const handleRevert$ = $(async () => {
        if (selectedValue.value === null) return;
        await props.onRevert$(selectedValue.value);
        // Reload history after revert
        try {
            const h = await getFieldService().getFieldHistory(props.fieldId);
            history.value = h;
        } catch (e) {
            console.error('Failed to reload field history:', e);
        }
        selectedValue.value = null;
        isHistoryOpen.value = false;
    });

    const toggleHistory$ = $(() => {
        isHistoryOpen.value = !isHistoryOpen.value;
        // Clear preview when closing
        if (!isHistoryOpen.value) {
            selectedValue.value = null;
            props.onPreviewChange$(null);
        }
    });

    // Get the latest entry for metadata display
    const latestEntry = history.value.length > 0 
        ? history.value[history.value.length - 1] 
        : null;
    
    const displayEntry = latestEntry;
    const editAt = displayEntry?.updatedAt ? formatTimestampShort(displayEntry.updatedAt) : '';
    const editBy = displayEntry?.updatedBy ?? '';

    // Format the metadata text - show placeholder while loading
    const metadataText = isLoaded.value && editAt 
        ? `${editAt}  ${editBy}`
        : '...';

    const hasHistory = history.value.length > 0;
    const hasSelection = selectedValue.value !== null;

    // Render as grid items using display:contents wrapper
    // Items become direct children of parent 6-column grid
    return (
        <div class={styles.inlineWrapper}>
            {/* Column 4: Metadata (date/time/user) */}
            <span class={styles.metadata}>{metadataText}</span>
            
            {/* Column 5: REVERT button (when selection) or Spacer */}
            {hasSelection ? (
                <button
                    type="button"
                    class={styles.revertButton}
                    onClick$={handleRevert$}
                    aria-label="Revert to selected value"
                >
                    REVERT
                </button>
            ) : (
                <span class={styles.spacer}></span>
            )}
            
            {/* Column 6: History chevron */}
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

            {/* History list - spans all 6 columns, expands below */}
            {isHistoryOpen.value && hasHistory && (
                <div class={styles.historyRow}>
                    <DataFieldHistory
                        fieldId={props.fieldId}
                        history={history.value}
                        isOpen={isHistoryOpen.value}
                        onToggle$={toggleHistory$}
                        onPreviewChange$={handlePreviewChange$}
                    />
                </div>
            )}

            {/* Actions row - spans all 6 columns, flows to new row */}
            <div class={styles.actionsRow}>
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
