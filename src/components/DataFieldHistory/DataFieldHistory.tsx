/**
 * DataFieldHistory - Read-only history list with single-row selection and a
 * revert affordance.
 *
 * Selection: tap a row to select it; tapping again (or another row) toggles.
 * The currently-live value is NOT shown here — it's already displayed in the
 * live field row above, so we hide the most recent history entry to avoid
 * the redundant duplicate.
 *
 * Revert: when a row is selected, a small dot button appears in the left
 * gutter. Tapping it dispatches UPDATE_FIELD_VALUE with that entry's value
 * and shows a snackbar with Undo. We skip the dispatch entirely if the
 * selected entry's value already matches the live value (no-op gate).
 */

import { component$, useSignal, $ } from '@builder.io/qwik';
import { getCommandBus } from '../../data/commands';
import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../../data/storage/storageErrors';
import type { ComponentType, DataFieldHistory as HistoryEntry, DataFieldValue } from '../../data/models';
import styles from './DataFieldHistory.module.css';

export type DataFieldHistoryProps = {
    fieldId: string;
    history: HistoryEntry[];
    componentType: ComponentType;
    units?: string;
    isOpen: boolean;
};

function formatHistoryValue(entry: HistoryEntry, units: string): string {
    if (entry.newValue === null || entry.newValue === undefined) return '';
    switch (entry.componentType) {
        case 'text-kv':
        case 'enum-kv':
            return String(entry.newValue);
        case 'measurement-kv':
            return `${entry.newValue} ${units}`.trim();
        case 'single-image':
            return '[image]';
    }
}

export const DataFieldHistory = component$<DataFieldHistoryProps>((props) => {
    const selectedId = useSignal<string | null>(null);

    // Drop the most recent entry — it duplicates the live row's current value.
    // History is sorted ascending (oldest first), so the last element is the
    // current value.
    const visibleAscending = props.history.slice(0, -1);
    const allEntries = [...visibleAscending].reverse();

    // Latest entry's newValue is the live current value.
    const liveValue: DataFieldValue | null =
        props.history.length > 0 ? props.history[props.history.length - 1].newValue : null;

    const formatDateTime = (ts: number): string => {
        const d = new Date(ts);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${mins}`;
    };

    const hasHistory = allEntries.length > 0;
    const units = props.units ?? '';

    const toggleSelect$ = $((entryId: string) => {
        selectedId.value = selectedId.value === entryId ? null : entryId;
    });

    const revert$ = $(async (targetValue: DataFieldValue | null) => {
        const fieldId = props.fieldId;
        const prevValue = liveValue;
        // No-op gate: if reverting to the same value, do nothing.
        if (targetValue === prevValue) {
            selectedId.value = null;
            return;
        }
        try {
            await getCommandBus().execute({
                type: 'UPDATE_FIELD_VALUE',
                payload: { fieldId, newValue: targetValue },
            });
            selectedId.value = null;
            getSnackbarService().show({
                message: 'Field reverted',
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await getCommandBus().execute({
                            type: 'UPDATE_FIELD_VALUE',
                            payload: { fieldId, newValue: prevValue },
                        });
                    }),
                },
            });
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: describeForUser(toStorageError(err)),
            });
        }
    });

    return (
        <div class={[styles.historyWrapper, 'no-caret']}>
            {props.isOpen && hasHistory && (
                <div class={[styles.historyList, 'no-caret']} role="list" aria-label="Field value history">
                    {allEntries.map((entry) => {
                        const formatted = formatHistoryValue(entry, units);
                        const isSelected = selectedId.value === entry.id;
                        return (
                            <div
                                key={entry.id}
                                class={[styles.historyRow, isSelected && styles.historyRowSelected]}
                                role="listitem"
                                onClick$={() => toggleSelect$(entry.id)}
                            >
                                {isSelected && (
                                    <button
                                        type="button"
                                        class={styles.revertButton}
                                        onClick$={(ev) => {
                                            ev.stopPropagation();
                                            revert$(entry.newValue);
                                        }}
                                        aria-label="Revert to this value"
                                        title="Revert to this value"
                                    >
                                        ↶
                                    </button>
                                )}
                                <span class={styles.historyValue}>
                                    {formatted || <em>Empty</em>}
                                </span>
                                <span class={styles.historyMeta}>
                                    {formatDateTime(entry.updatedAt)} {entry.updatedBy}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
