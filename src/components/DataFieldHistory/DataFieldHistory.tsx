/**
 * DataFieldHistory - Inline expandable history showing previous field values.
 * Expands in-place within DataFieldDetails (accordion pattern, not a popover).
 * Shows historical entries in a scrollable list, max ~8 rows.
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
    onRevert$: PropFunction<(value: string | null) => void>;
};

export const DataFieldHistory = component$<DataFieldHistoryProps>((props) => {
    const selectedRev = useSignal<number | null>(null);

    // All entries in reverse chronological order (most recent first)
    const allEntries = [...props.history].reverse();

    const hasSelection = selectedRev.value !== null;

    const selectEntry$ = $((entry: HistoryEntry) => {
        selectedRev.value = entry.rev;
        // Preview the newValue from that history entry
        props.onPreviewChange$(entry.newValue);
    });

    const handleCancel$ = $(() => {
        selectedRev.value = null;
        props.onPreviewChange$(null);
    });

    const handleRevert$ = $(async () => {
        if (selectedRev.value === null) return;
        const entry = props.history.find(h => h.rev === selectedRev.value);
        if (entry) {
            await props.onRevert$(entry.newValue);
        }
        selectedRev.value = null;
    });

    const handleToggle$ = $(() => {
        // Clear selection when closing
        if (props.isOpen) {
            selectedRev.value = null;
            props.onPreviewChange$(null);
        }
        props.onToggle$();
    });

    const handleChevronKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle$();
        }
    });

    // Format date as mm/dd/yyyy
    const formatDate = (ts: number): string => {
        const d = new Date(ts);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Check if we have any history to show (more than just the create entry)
    const hasHistory = props.history.length > 0;

    return (
        <div class={styles.historyWrapper}>
            {/* Control row: Cancel, Revert, Chevron */}
            <div class={styles.controlRow}>
                <button
                    type="button"
                    class={[styles.actionButton, styles.cancelButton]}
                    disabled={!hasSelection}
                    onClick$={handleCancel$}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class={[styles.actionButton, styles.revertButton]}
                    disabled={!hasSelection}
                    onClick$={handleRevert$}
                >
                    REVERT
                </button>
                <button
                    type="button"
                    class={styles.chevronButton}
                    onClick$={handleToggle$}
                    onKeyDown$={handleChevronKeyDown$}
                    aria-expanded={props.isOpen}
                    aria-label={props.isOpen ? 'Close field history' : 'Open field history'}
                    disabled={!hasHistory}
                    title={!hasHistory ? 'No history available' : 'View field history'}
                >
                    <span class={[styles.chevron, props.isOpen && styles.chevronOpen]}></span>
                </button>
            </div>

            {/* Inline expandable history list */}
            {props.isOpen && hasHistory && (
                <div class={styles.historyList} role="listbox" aria-label="Field value history">
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
                                {formatDate(entry.updatedAt)} {entry.updatedBy}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
