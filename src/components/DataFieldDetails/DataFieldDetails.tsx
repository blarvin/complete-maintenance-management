/**
 * DataFieldDetails - Inline metadata and actions displayed when DataField is expanded.
 * Renders as grid items: metadata text, spacer, history chevron, and actions row.
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
        props.onPreviewChange$(value);
    });

    const handleRevert$ = $(async (value: string | null) => {
        await props.onRevert$(value);
        // Reload history after revert
        try {
            const h = await getFieldService().getFieldHistory(props.fieldId);
            history.value = h;
        } catch (e) {
            console.error('Failed to reload field history:', e);
        }
        isHistoryOpen.value = false;
    });

    const toggleHistory$ = $(() => {
        isHistoryOpen.value = !isHistoryOpen.value;
        // Clear preview when closing
        if (!isHistoryOpen.value) {
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

    // Render as grid items using display:contents wrapper
    // Items become direct children of parent 6-column grid
    return (
        <div class={styles.inlineWrapper}>
            {/* Column 4: Metadata (date/time/user) */}
            <span class={styles.metadata}>{metadataText}</span>
            
            {/* Column 5: Spacer */}
            <span class={styles.spacer}></span>
            
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

            {/* Hidden controls - keep components but don't display */}
            <div class={styles.hiddenControls}>
                <DataFieldHistory
                    fieldId={props.fieldId}
                    history={history.value}
                    isOpen={isHistoryOpen.value}
                    onToggle$={toggleHistory$}
                    onPreviewChange$={handlePreviewChange$}
                    onRevert$={handleRevert$}
                />
            </div>
        </div>
    );
});
