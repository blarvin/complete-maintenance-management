/**
 * DataFieldHistory - Inline expandable history showing previous field values.
 * Expands in-place within DataFieldDetails (accordion pattern, not a popover).
 * Shows historical entries in a scrollable list, max ~8 rows.
 * Selection is cancelled by closing history (chevron) or collapsing field details.
 */

import { component$, useSignal, $, PropFunction } from '@builder.io/qwik';
import type { DataFieldHistory as HistoryEntry } from '../../data/models';
import styles from './DataFieldHistory.module.css';

export type DataFieldHistoryProps = {
    fieldId: string;
    history: HistoryEntry[];
    isOpen: boolean;
    onToggle$: PropFunction<() => void>;
    onPreviewChange$: PropFunction<(value: string | null) => void>;
};

export const DataFieldHistory = component$<DataFieldHistoryProps>((props) => {
    const selectedRev = useSignal<number | null>(null);

    // All entries in reverse chronological order (most recent first)
    const allEntries = [...props.history].reverse();

    const selectEntry$ = $((entry: HistoryEntry) => {
        selectedRev.value = entry.rev;
        // Preview the newValue from that history entry
        props.onPreviewChange$(entry.newValue);
    });

    // Format date as dd/mm/yyyy, hh:mm
    const formatDateTime = (ts: number): string => {
        const d = new Date(ts);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${mins}`;
    };

    // Check if we have any history to show
    const hasHistory = props.history.length > 0;

    return (
        <div class={[styles.historyWrapper, 'no-caret']}>
            {/* Scrollable history list */}
            {props.isOpen && hasHistory && (
                <div class={[styles.historyList, 'no-caret']} role="listbox" aria-label="Field value history">
                    {allEntries.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            class={[
                                styles.historyRow,
                                selectedRev.value === entry.rev && styles.historyRowSelected,
                            ]}
                            onClick$={() => selectEntry$(entry)}
                            role="option"
                            aria-selected={selectedRev.value === entry.rev}
                        >
                            <span class={styles.historyValue}>
                                {entry.newValue || <em>Empty</em>}
                            </span>
                            <span class={styles.historyMeta}>
                                {formatDateTime(entry.updatedAt)}  by {entry.updatedBy}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
