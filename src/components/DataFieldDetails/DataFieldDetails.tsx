/**
 * DataFieldDetails - Expandable details section for a DataField.
 * Shows "Last Edit" info (who, when, "created" if first entry) and delete button.
 * Expands/collapses with a simple chevron toggle.
 */

import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { fieldService } from '../../data/services/fieldService';
import { formatTimestampShort } from '../../utils/time';
import type { DataFieldHistory } from '../../data/models';
import styles from './DataFieldDetails.module.css';

export type DataFieldDetailsProps = {
    fieldId: string;
    onDelete$: () => void;
};

export const DataFieldDetails = component$<DataFieldDetailsProps>((props) => {
    const history = useSignal<DataFieldHistory[]>([]);
    const isLoading = useSignal(true);

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

    // Format: "Last Edit 11/30/2025 10:55 PM by localUser (created)"
    return (
        <div class={styles.details}>
            {isLoading.value ? (
                <span class={styles.loading}>Loading...</span>
            ) : (
                <>
                    <div class={styles.editInfo}>
                        <span class={styles.editText}>
                            Last Edit {editAt} by {editBy}
                        </span>
                        {isCreatedOnly && (
                            <span class={styles.editCreated}>(created)</span>
                        )}
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

