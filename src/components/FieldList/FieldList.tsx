/**
 * FieldList - Manages and renders the list of DataFields for a node.
 * 
 * Responsibilities:
 * - Fetches persisted fields from DB (useTreeNodeFields)
 * - Manages pending field forms (usePendingForms)
 * - Renders DataField for persisted fields
 * - Renders CreateDataField for pending forms
 * - Provides "+ Add Field" button
 * - Merges persisted + pending and sorts by cardOrder
 * 
 * This component owns all field-related logic, making DataCard a pure
 * animation container. Works identically for UC and display modes.
 */

import { component$, $, useComputed$, useVisibleTask$, type Signal, type QRL } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useTreeNodeFields } from '../TreeNode/useTreeNodeFields';
import { usePendingForms, type PendingForm } from '../../hooks/usePendingForms';
import type { DataField as DataFieldRecord } from '../../data/models';
import styles from './FieldList.module.css';

/** Maximum pending forms allowed per FieldList */
const MAX_PENDING_FORMS = 30;

/** Unified field item for rendering */
type FieldItem = 
    | { type: 'persisted'; field: DataFieldRecord }
    | { type: 'pending'; form: PendingForm };

/** Handle for external access to FieldList methods */
export type FieldListHandle = {
    saveAllPending$: QRL<() => Promise<number>>;
};

export type FieldListProps = {
    nodeId: string;
    /** Optional default field names to initialize with (for UC mode) */
    initialFieldNames?: readonly string[];
    /** Optional signal to receive the FieldList handle for external control */
    handleRef?: Signal<FieldListHandle | null>;
};

export const FieldList = component$<FieldListProps>((props) => {
    // Fetch persisted fields from DB
    const { fields, reload$ } = useTreeNodeFields({ 
        nodeId: props.nodeId, 
        enabled: true 
    });

    // Calculate max persisted cardOrder for pending form ordering
    const maxPersistedCardOrder = useComputed$(() => {
        if (!fields.value || fields.value.length === 0) return -1;
        return Math.max(...fields.value.map(f => f.cardOrder));
    });

    // Manage pending forms with localStorage persistence
    const { forms: pendingForms, add$, save$, cancel$, change$, saveAllPending$ } = usePendingForms({
        nodeId: props.nodeId,
        onSaved$: reload$,
        initialFieldNames: props.initialFieldNames,
        maxPersistedCardOrder: maxPersistedCardOrder.value,
    });

    // Expose handle for external access (e.g., UC CREATE button)
    useVisibleTask$(() => {
        if (props.handleRef) {
            props.handleRef.value = { saveAllPending$ };
        }
    });

    // Build unified list sorted by cardOrder
    const unifiedList = useComputed$<FieldItem[]>(() => {
        const items: FieldItem[] = [];
        
        // Add persisted fields
        if (fields.value) {
            for (const field of fields.value) {
                items.push({ type: 'persisted', field });
            }
        }
        
        // Add pending forms
        for (const form of pendingForms.value) {
            items.push({ type: 'pending', form });
        }
        
        // Sort by cardOrder
        items.sort((a, b) => {
            const orderA = a.type === 'persisted' ? a.field.cardOrder : a.form.cardOrder;
            const orderB = b.type === 'persisted' ? b.field.cardOrder : b.form.cardOrder;
            return orderA - orderB;
        });
        
        return items;
    });

    const handleFieldDeleted$ = $(() => {
        reload$();
    });

    const handleAddField$ = $(() => {
        if (pendingForms.value.length < MAX_PENDING_FORMS) {
            add$();
        }
    });

    const canAddMore = pendingForms.value.length < MAX_PENDING_FORMS;

    return (
        <div class={styles.fieldList}>
            {/* Unified list sorted by cardOrder */}
            {unifiedList.value.map((item) => {
                if (item.type === 'persisted') {
                    return (
                        <DataField
                            key={item.field.id}
                            id={item.field.id}
                            fieldName={item.field.fieldName}
                            fieldValue={item.field.fieldValue}
                            onDeleted$={handleFieldDeleted$}
                        />
                    );
                } else {
                    return (
                        <CreateDataField
                            key={item.form.id}
                            id={item.form.id}
                            initialName={item.form.fieldName}
                            initialValue={item.form.fieldValue}
                            onSave$={save$}
                            onCancel$={cancel$}
                            onChange$={change$}
                        />
                    );
                }
            })}
            
            {/* Add Field button */}
            <button
                type="button"
                class={styles.addButton}
                onClick$={handleAddField$}
                disabled={!canAddMore}
                aria-label={canAddMore ? "Add new field" : "Maximum fields reached"}
            >
                + Add Field
            </button>
        </div>
    );
});
