/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * Renders input fields for name/subtitle and uses CreateDataField for all fields.
 * Matches the visual layout of TreeNodeDisplay for consistency.
 * 
 * All fields (defaults + user-added) are rendered as CreateDataField forms.
 * On CREATE: all forms with non-empty names are saved with the node.
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { DataCard } from '../DataCard/DataCard';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import type { ConstructionField, CreateNodePayload } from './types';
import { generateId } from '../../utils/id';
import { DEFAULT_DATAFIELD_NAMES } from '../../constants';
import styles from './TreeNode.module.css';

// Re-export for backwards compatibility
export type { ConstructionField } from './types';

/** Form state for a field being constructed */
type FieldForm = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
    /** Whether the user has clicked "Save" on this form (validated) */
    confirmed: boolean;
};

/** Maximum pending forms allowed */
const MAX_PENDING_FORMS = 30;

export type TreeNodeConstructionProps = {
    id: string;
    initialName?: string;
    initialSubtitle?: string;
    /** When true, this is a child construction (inside branch-children, DataCard extends wider) */
    isChildConstruction?: boolean;
    onCancel$: PropFunction<() => void>;
    onCreate$: PropFunction<(payload: CreateNodePayload) => void>;
};

export const TreeNodeConstruction = component$((props: TreeNodeConstructionProps) => {
    const nameValue = useSignal<string>(props.initialName || '');
    const subtitleValue = useSignal<string>(props.initialSubtitle || '');
    const nameInputRef = useSignal<HTMLInputElement>();

    // All field forms (defaults + user-added)
    const fieldForms = useSignal<FieldForm[]>([]);

    // Initialize with default fields on mount
    useVisibleTask$(() => {
        const defaults: FieldForm[] = DEFAULT_DATAFIELD_NAMES.map(name => ({
            id: generateId(),
            fieldName: name,
            fieldValue: null,
            confirmed: false,
        }));
        fieldForms.value = defaults;
        nameInputRef.value?.focus();
    });

    const handleCreate$ = $(async () => {
        // Filter: only include forms with non-empty field names
        const validFields: ConstructionField[] = fieldForms.value
            .filter(f => f.fieldName.trim())
            .map(f => ({
                fieldName: f.fieldName.trim(),
                fieldValue: f.fieldValue,
            }));

        await props.onCreate$({
            nodeName: nameValue.value,
            nodeSubtitle: subtitleValue.value,
            fields: validFields,
        });
    });

    const handleKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            props.onCancel$();
        }
    });

    // Add a new field form
    const handleAddField$ = $(() => {
        if (fieldForms.value.length >= MAX_PENDING_FORMS) return;
        const newForm: FieldForm = {
            id: generateId(),
            fieldName: '',
            fieldValue: null,
            confirmed: false,
        };
        fieldForms.value = [...fieldForms.value, newForm];
    });

    // Save a field form (validate and mark as confirmed)
    const handleFormSave$ = $((formId: string, fieldName: string, fieldValue: string | null) => {
        const name = fieldName.trim();
        if (!name) {
            // Empty name - remove the form
            fieldForms.value = fieldForms.value.filter(f => f.id !== formId);
            return;
        }
        // Update and mark as confirmed
        fieldForms.value = fieldForms.value.map(f =>
            f.id === formId
                ? { ...f, fieldName: name, fieldValue, confirmed: true }
                : f
        );
    });

    // Cancel a field form
    const handleFormCancel$ = $((formId: string) => {
        fieldForms.value = fieldForms.value.filter(f => f.id !== formId);
    });

    // Update form values (for tracking, not used for LS in UC mode)
    const handleFormChange$ = $((formId: string, fieldName: string, fieldValue: string | null) => {
        fieldForms.value = fieldForms.value.map(f =>
            f.id === formId ? { ...f, fieldName, fieldValue } : f
        );
    });

    const titleId = `node-title-${props.id}`;
    // Match the DataCard indent: 18px for child construction, 50px for root construction
    const indentVar = props.isChildConstruction ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar }}>
            <article class={[styles.node, styles.nodeExpanded]} aria-labelledby={titleId}>
                <div class={styles.nodeBody}>
                    <div>
                        <input
                            class={styles.nodeTitle}
                            ref={nameInputRef}
                            placeholder="Name"
                            value={nameValue.value}
                            onInput$={(e) => (nameValue.value = (e.target as HTMLInputElement).value)}
                            onKeyDown$={handleKeyDown$}
                            aria-label="Node name"
                            id={titleId}
                        />
                        <input
                            class={styles.nodeSubtitle}
                            placeholder="Subtitle / Location / Short description"
                            value={subtitleValue.value}
                            onInput$={(e) => (subtitleValue.value = (e.target as HTMLInputElement).value)}
                            onKeyDown$={handleKeyDown$}
                            aria-label="Node subtitle"
                        />
                    </div>
                    <button
                        type="button"
                        class={styles.nodeChevron}
                        aria-expanded={true}
                        aria-label="Collapse details"
                        disabled
                    >
                        ▾
                    </button>
                </div>
            </article>
            <DataCard 
                nodeId={props.id} 
                isOpen={true} 
                pendingCount={fieldForms.value.length}
                onAddField$={handleAddField$}
            >
                {/* All fields as CreateDataField forms */}
                {fieldForms.value.map((form) => (
                    <CreateDataField
                        key={form.id}
                        id={form.id}
                        initialName={form.fieldName}
                        initialValue={form.fieldValue}
                        onSave$={handleFormSave$}
                        onCancel$={handleFormCancel$}
                        onChange$={handleFormChange$}
                    />
                ))}
                {/* Cancel/Create buttons at the very bottom */}
                <div q:slot="actions" class={styles.constructionActions}>
                    <button type="button" onClick$={props.onCancel$}>Cancel</button>
                    <button type="button" onClick$={handleCreate$}>Create</button>
                </div>
            </DataCard>
        </div>
    );
});
