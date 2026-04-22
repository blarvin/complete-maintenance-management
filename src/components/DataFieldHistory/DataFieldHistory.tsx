/**
 * DataFieldHistory - Read-only inline history list. Preview/revert were removed
 * during the Component split; restoring them is tracked in ISSUES.md.
 */

import { component$ } from '@builder.io/qwik';
import type { ComponentType, DataFieldHistory as HistoryEntry } from '../../data/models';
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
    const allEntries = [...props.history].reverse();

    const formatDateTime = (ts: number): string => {
        const d = new Date(ts);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${mins}`;
    };

    const hasHistory = props.history.length > 0;
    const units = props.units ?? '';

    return (
        <div class={[styles.historyWrapper, 'no-caret']}>
            {props.isOpen && hasHistory && (
                <div class={[styles.historyList, 'no-caret']} role="list" aria-label="Field value history">
                    {allEntries.map((entry) => {
                        const formatted = formatHistoryValue(entry, units);
                        return (
                            <div
                                key={entry.id}
                                class={styles.historyRow}
                                role="listitem"
                            >
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
