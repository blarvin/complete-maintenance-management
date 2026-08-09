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
 * gutter. Tapping it dispatches UPDATE_ELEMENT_VALUE with that entry's value
 * and shows a snackbar with Undo. The button is hidden when the selected
 * entry matches the live value (would be a no-op) or when it's an empty value
 * — emptying a field is done by deleting its value, not by reverting to a
 * prior empty entry. A no-op gate in revert stays as a defensive guard.
 */

import { Show, For, createSignal, createMemo } from 'solid-js';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { getInlineManifest } from '../../kinds/registry';
import { formatTimestampShort } from '../../utils/time';
import type { Kind, ElementHistory, DataFieldValue, DefinitionConfig } from '../../data/models';
import styles from './DataFieldHistory.module.css';

export type DataFieldHistoryProps = {
    fieldId: string;
    history: ElementHistory[];
    kind: Kind;
    config?: DefinitionConfig;
    isOpen: boolean;
};

export const DataFieldHistory = (props: DataFieldHistoryProps) => {
    const [selectedId, setSelectedId] = createSignal<string | null>(null);

    // Drop the most recent entry — it duplicates the live row's current value.
    // History is sorted ascending (oldest first), so the last element is the
    // current value.
    const visibleAscending = createMemo(() => props.history.slice(0, -1));
    const allEntries = createMemo(() => [...visibleAscending()].reverse());

    // Latest entry's newValue is the live current value.
    const liveValue = createMemo<DataFieldValue | null>(() =>
        props.history.length > 0
            ? (props.history[props.history.length - 1].newValue as DataFieldValue | null)
            : null,
    );

    const hasHistory = () => allEntries().length > 0;

    const toggleSelect = (entryId: string) => {
        setSelectedId(selectedId() === entryId ? null : entryId);
    };

    const revert = async (targetValue: DataFieldValue | null) => {
        const fieldId = props.fieldId;
        const prevValue = liveValue();
        // No-op gate: if reverting to the same value, do nothing.
        if (targetValue === prevValue) {
            setSelectedId(null);
            return;
        }
        const ok = await commitWithUndo({
            message: 'Field reverted',
            execute: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: targetValue } }),
            undo: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prevValue } }),
        });
        if (ok) {
            setSelectedId(null);
        }
    };

    return (
        <div classList={{ [styles.historyWrapper]: true, 'no-caret': true }}>
            <Show when={props.isOpen && hasHistory()}>
                <div classList={{ [styles.historyList]: true, 'no-caret': true }} role="list" aria-label="Field value history">
                    <For each={allEntries()}>
                        {(entry) => {
                            const formatted = getInlineManifest(props.kind).displayPreview(entry.newValue as DataFieldValue | null, props.config) ?? '';
                            const isSelected = () => selectedId() === entry.id;
                            return (
                                <div
                                    classList={{
                                        [styles.historyRow]: true,
                                        [styles.historyRowSelected]: isSelected(),
                                    }}
                                    role="listitem"
                                    onClick={() => toggleSelect(entry.id)}
                                >
                                    <Show when={isSelected() && formatted !== '' && entry.newValue !== liveValue()}>
                                        <button
                                            type="button"
                                            class={styles.revertButton}
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                void revert(entry.newValue as DataFieldValue | null);
                                            }}
                                            aria-label="Revert to this value"
                                            title="Revert to this value"
                                        >
                                            ↶
                                        </button>
                                    </Show>
                                    <span class={styles.historyValue}>
                                        {formatted || <em>Empty</em>}
                                    </span>
                                    <span class={styles.historyMeta}>
                                        {formatTimestampShort(entry.updatedAt)} {entry.updatedBy}
                                    </span>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
};
