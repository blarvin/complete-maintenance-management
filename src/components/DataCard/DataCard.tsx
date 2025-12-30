/**
 * DataCard - Expandable container for DataFields and field forms.
 * 
 * Renders:
 * - Children (persisted DataField components OR CreateDataField forms from parent)
 * - "+ Add Field" button at the bottom
 * - Optional "actions" slot for UC mode buttons (Cancel/Create)
 * 
 * Parent manages:
 * - Persisted fields (fetch from DB)
 * - Pending forms (local state or LS)
 * - Persistence logic (when to write to DB)
 */

import { Slot, component$, PropFunction, $ } from '@builder.io/qwik';
import styles from './DataCard.module.css';

/** Maximum pending forms allowed per DataCard */
const MAX_PENDING_FORMS = 30;

export type DataCardProps = {
    nodeId: string;
    isOpen?: boolean;
    /** Hide the "+ Add Field" button (for UC mode where parent shows it inline) */
    hideAddField?: boolean;
    /** Current count of pending forms (to enforce limit) */
    pendingCount?: number;
    /** Called when user clicks "+ Add Field" */
    onAddField$?: PropFunction<() => void>;
    children?: any;
};

export const DataCard = component$<DataCardProps>((props) => {
    const canAddMore = (props.pendingCount ?? 0) < MAX_PENDING_FORMS;

    const handleAddField$ = $(() => {
        if (props.onAddField$ && canAddMore) {
            props.onAddField$();
        }
    });

    return (
        <div class={[styles.wrapper, props.isOpen && styles.wrapperOpen]}>
            <div class={styles.inner}>
                <div
                    class={[styles.datacard, props.isOpen && styles.datacardOpen, 'no-caret']}
                    role="region"
                    aria-label="Node details"
                >
                    <Slot />
                    {!props.hideAddField && (
                        <button
                            type="button"
                            class={styles.datacardAdd}
                            onClick$={handleAddField$}
                            disabled={!canAddMore}
                            aria-label={canAddMore ? "Add new field" : "Maximum fields reached"}
                        >
                            + Add Field
                        </button>
                    )}
                    <Slot name="actions" />
                </div>
            </div>
        </div>
    );
});
