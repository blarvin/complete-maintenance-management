/**
 * FieldList - Manages and renders the list of DataFields for a node.
 * 
 * Responsibilities:
 * - Fetches persisted fields from DB (useTreeNodeFields)
 * - Manages pending field forms (usePendingForms)
 * - Renders DataField for persisted fields
 * - Renders CreateDataField for pending forms
 * - Provides "+ Add Field" button
 * 
 * This component owns all field-related logic, making DataCard a pure
 * animation container. Prepares for the DataField component library
 * by centralizing field rendering logic.
 */

import { component$, $ } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useTreeNodeFields } from '../TreeNode/useTreeNodeFields';
import { usePendingForms } from '../../hooks/usePendingForms';
import type { DataField as DataFieldRecord } from '../../data/models';
import styles from './FieldList.module.css';

/** Maximum pending forms allowed per FieldList */
const MAX_PENDING_FORMS = 30;

export type FieldListProps = {
    nodeId: string;
};

export const FieldList = component$<FieldListProps>((props) => {
    // Fetch persisted fields from DB
    const { fields, reload$ } = useTreeNodeFields({ 
        nodeId: props.nodeId, 
        enabled: true 
    });

    // Manage pending forms with localStorage persistence
    const { forms: pendingForms, add$, save$, cancel$, change$ } = usePendingForms({
        nodeId: props.nodeId,
        onSaved$: reload$,
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
            {/* Persisted fields from DB */}
            {fields.value?.map((f: DataFieldRecord) => (
                <DataField
                    key={f.id}
                    id={f.id}
                    fieldName={f.fieldName}
                    fieldValue={f.fieldValue}
                    onDeleted$={handleFieldDeleted$}
                />
            ))}
            
            {/* Pending forms being added */}
            {pendingForms.value.map((form) => (
                <CreateDataField
                    key={form.id}
                    id={form.id}
                    initialName={form.fieldName}
                    initialValue={form.fieldValue}
                    onSave$={save$}
                    onCancel$={cancel$}
                    onChange$={change$}
                />
            ))}
            
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
