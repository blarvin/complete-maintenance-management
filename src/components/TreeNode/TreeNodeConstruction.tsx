/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * Renders input fields for name/subtitle and default field inputs.
 * Matches the visual layout of TreeNodeDisplay for consistency.
 * 
 * DataField creation during construction:
 * - Single CreateDataField handles its own form state
 * - When saved, field is added to local state and form resets to button
 * - Button is always visible (as button or form) for adding more fields
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

export const TreeNodeConstruction = component$((props: TreeNodeConstructionProps) => {
    const nameValue = useSignal<string>(props.initialName || '');
    const subtitleValue = useSignal<string>(props.initialSubtitle || '');
    // Saved fields (default fields + fields saved from forms)
    const fields = useSignal<ConstructionField[]>(props.defaultFields);
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

    // When CreateDataField saves, add field to local state
    const handleFieldAdded$ = $((fieldName: string, fieldValue: string | null) => {
        fields.value = [...fields.value, { fieldName, fieldValue }];
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
                
                {/* + Add Field - manages its own form state, resets to button after save */}
                <CreateDataField 
                    nodeId={props.id}
                    isConstructionMode={true}
                    onFieldAdded$={handleFieldAdded$}
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
