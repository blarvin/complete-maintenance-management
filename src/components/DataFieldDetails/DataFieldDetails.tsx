/**
 * DataFieldDetails - Expandable details section for a DataField.
 * Shows "Last Edit" info (who, when, "created" if first entry) and delete button.
 * Includes inline DataFieldHistory accordion for viewing and reverting to previous values.
 */

import { component$, useSignal, useVisibleTask$, $, PropFunction } from '@builder.io/qwik';
import { fieldService } from '../../data/services/fieldService';
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
    const isLoading = useSignal(true);
    const isHistoryOpen = useSignal(false);

    // Load history on mount
    useVisibleTask$(async () => {
        try {
            const h = await fieldService.getFieldHistory(props.fieldId);
            history.value = h;
        } catch (e) {
            console.error('Failed to load field history:', e);
        } finally {
            isLoading.value = false;
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
            const h = await fieldService.getFieldHistory(props.fieldId);
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

    // Get the creation entry (rev 0) and the latest entry for "Last Edit"
    const creationEntry = history.value.find(h => h.action === 'create');
    const latestEntry = history.value.length > 0 
        ? history.value[history.value.length - 1] 
        : null;

    // Determine if this is the original creation (only one entry)
    const isCreatedOnly = history.value.length === 1 && creationEntry;
    
    const displayEntry = latestEntry;
    const editAt = displayEntry?.updatedAt ? formatTimestampShort(displayEntry.updatedAt) : 'unknown';
    const editBy = displayEntry?.updatedBy ?? 'unknown';

    return (
        <div class={styles.details}>
            {isLoading.value ? (
                <span class={styles.loading}>Loading...</span>
            ) : (
                <>
                    {/* Edit info row with history controls on the right */}
                    <div class={styles.editInfoRow}>
                        {/* Only show "Last Edit" text when history is collapsed */}
                        {!isHistoryOpen.value && (
                            <div class={styles.editInfo}>
                                <span class={styles.editText}>
                                    Last Edit {editAt} by {editBy}
                                </span>
                                {isCreatedOnly && (
                                    <span class={styles.editCreated}>(created)</span>
                                )}
                            </div>
                        )}
                        {/* When history is open, let it take the full width */}
                        {isHistoryOpen.value && <div class={styles.spacer} />}
                        <DataFieldHistory
                            fieldId={props.fieldId}
                            history={history.value}
                            isOpen={isHistoryOpen.value}
                            onToggle$={toggleHistory$}
                            onPreviewChange$={handlePreviewChange$}
                            onRevert$={handleRevert$}
                        />
                    </div>
                    <button 
                        type="button" 
                        class={styles.deleteButton}
                        onClick$={handleDelete$}
                        aria-label="Delete this field"
                    >
                        Delete Field
                    </button>
                </>
            )}
        </div>
    );
});
