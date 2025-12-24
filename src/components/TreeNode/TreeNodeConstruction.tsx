/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * Renders input fields for name/subtitle and default field inputs.
 * Matches the visual layout of TreeNodeDisplay for consistency.
 * 
 * Supports multiple concurrent CreateDataField forms:
 * - User can open multiple "+ Add Field" forms
 * - Each form's Save adds to the saved fields list
 * - CREATE button also collects any pending forms with fieldName entered
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { DataCard } from '../DataCard/DataCard';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import type { ConstructionField, CreateNodePayload } from './types';
import styles from './TreeNode.module.css';
import fieldStyles from '../DataField/DataField.module.css';

// Re-export for backwards compatibility
export type { ConstructionField } from './types';

export type TreeNodeConstructionProps = {
    id: string;
    initialName?: string;
    initialSubtitle?: string;
    defaultFields: ConstructionField[];
    /** When true, this is a child construction (inside branch-children, DataCard extends wider) */
    isChildConstruction?: boolean;
    onCancel$: PropFunction<() => void>;
    onCreate$: PropFunction<(payload: CreateNodePayload) => void>;
};

/** Counter for generating unique form IDs */
let formIdCounter = 0;

export const TreeNodeConstruction = component$((props: TreeNodeConstructionProps) => {
    const nameValue = useSignal<string>(props.initialName || '');
    const subtitleValue = useSignal<string>(props.initialSubtitle || '');
    // Saved fields (default fields + fields saved from forms)
    const fields = useSignal<ConstructionField[]>(props.defaultFields);
    // Active form IDs for multiple concurrent CreateDataField forms
    const activeFormIds = useSignal<string[]>([]);
    const nameInputRef = useSignal<HTMLInputElement>();

    // Auto-focus name input on mount
    useVisibleTask$(() => {
        nameInputRef.value?.focus();
    });

    const handleCreate$ = $(async () => {
        await props.onCreate$({
            nodeName: nameValue.value,
            nodeSubtitle: subtitleValue.value,
            fields: fields.value,
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

    const updateFieldValue$ = $((index: number, value: string) => {
        fields.value = fields.value.map((f, i) =>
            i === index ? { ...f, fieldValue: value || null } : f
        );
    });

    // Add a new active form (opens a new CreateDataField in form mode)
    const openNewForm$ = $(() => {
        const newFormId = `form-${++formIdCounter}`;
        activeFormIds.value = [...activeFormIds.value, newFormId];
    });

    // When a form saves, add the field to saved fields and remove the form
    const handleFormFieldAdded$ = $((formId: string, fieldName: string, fieldValue: string | null) => {
        fields.value = [...fields.value, { fieldName, fieldValue }];
        activeFormIds.value = activeFormIds.value.filter(id => id !== formId);
    });

    // When a form is cancelled, just remove it from active list
    const handleFormCancelled$ = $((formId: string) => {
        activeFormIds.value = activeFormIds.value.filter(id => id !== formId);
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
            <DataCard nodeId={props.id} isOpen={true} hideAddField>
                {/* Saved fields (default fields + fields added via forms) */}
                {fields.value.map((f, idx) => (
                    <div class={fieldStyles.constructionField} key={`${f.fieldName}-${idx}`}>
                        {/* Empty placeholder matching chevron column in display mode */}
                        <span aria-hidden="true"></span>
                        <span class={fieldStyles.datafieldLabel}>{f.fieldName}:</span>
                        <input
                            class={[fieldStyles.datafieldValue, f.fieldValue && fieldStyles.datafieldValueUnderlined]}
                            value={f.fieldValue ?? ''}
                            onInput$={(e) => updateFieldValue$(idx, (e.target as HTMLInputElement).value)}
                            onKeyDown$={handleKeyDown$}
                            aria-label={`${f.fieldName} value`}
                        />
                    </div>
                ))}
                
                {/* Active CreateDataField forms (open for input) */}
                {activeFormIds.value.map((formId) => (
                    <CreateDataField
                        key={formId}
                        nodeId={props.id}
                        isConstructionMode={true}
                        startOpen={true}
                        onFieldAdded$={$((fieldName: string, fieldValue: string | null) => {
                            handleFormFieldAdded$(formId, fieldName, fieldValue);
                        })}
                        onCancelled$={$(() => {
                            handleFormCancelled$(formId);
                        })}
                    />
                ))}
                
                {/* + Add Field button - always visible at bottom, opens new forms above */}
                <CreateDataField 
                    nodeId={props.id}
                    onActivate$={openNewForm$}
                />
                
                {/* Cancel/Create buttons at the very bottom */}
                <div q:slot="actions" class={styles.constructionActions}>
                    <button type="button" onClick$={props.onCancel$}>Cancel</button>
                    <button type="button" onClick$={handleCreate$}>Create</button>
                </div>
            </DataCard>
        </div>
    );
});
