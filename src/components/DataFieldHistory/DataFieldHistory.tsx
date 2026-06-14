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
 * and shows a snackbar with Undo. The button is hidden when the selected
 * entry matches the live value (would be a no-op) or when it's an empty value
 * — emptying a field is done by deleting its value, not by reverting to a
 * prior empty entry. A no-op gate in revert$ stays as a defensive guard.
 */

import { component$, useSignal, $ } from '@builder.io/qwik';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { getKindManifest } from '../../kinds/registry';
import { formatTimestampShort } from '../../utils/time';
import type { ComponentType, ElementHistory, DataFieldValue, FieldDefinitionConfig } from '../../data/models';
import styles from './DataFieldHistory.module.css';

export type DataFieldHistoryProps = {
    fieldId: string;
    history: ElementHistory[];
    kind: ComponentType;
    config?: FieldDefinitionConfig;
    isOpen: boolean;
};

export const DataFieldHistory = component$<DataFieldHistoryProps>((props) => {
    const selectedId = useSignal<string | null>(null);

    // Drop the most recent entry — it duplicates the live row's current value.
    // History is sorted ascending (oldest first), so the last element is the
    // current value.
    const visibleAscending = props.history.slice(0, -1);
    const allEntries = [...visibleAscending].reverse();

    // Latest entry's newValue is the live current value.
    const liveValue: DataFieldValue | null =
        props.history.length > 0 ? (props.history[props.history.length - 1].newValue as DataFieldValue | null) : null;

    const hasHistory = allEntries.length > 0;

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
        const ok = await commitWithUndo({
            message: 'Field reverted',
            execute$: $(() => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: targetValue } })),
            undo$: $(() => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prevValue } })),
        });
        if (ok) {
            selectedId.value = null;
        }
    });

    return (
        <div class={[styles.historyWrapper, 'no-caret']}>
            {props.isOpen && hasHistory && (
                <div class={[styles.historyList, 'no-caret']} role="list" aria-label="Field value history">
                    {allEntries.map((entry) => {
                        const formatted = getKindManifest(props.kind).displayPreview(entry.newValue as DataFieldValue | null, props.config) ?? '';
                        const isSelected = selectedId.value === entry.id;
                        return (
                            <div
                                key={entry.id}
                                class={[styles.historyRow, isSelected && styles.historyRowSelected]}
                                role="listitem"
                                onClick$={() => toggleSelect$(entry.id)}
                            >
                                {isSelected && formatted !== '' && entry.newValue !== liveValue && (
                                    <button
                                        type="button"
                                        class={styles.revertButton}
                                        onClick$={(ev) => {
                                            ev.stopPropagation();
                                            revert$(entry.newValue as DataFieldValue | null);
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
                                    {formatTimestampShort(entry.updatedAt)} {entry.updatedBy}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
