/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * Renders input fields for name/subtitle and default field inputs.
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { DataCard } from '../DataCard/DataCard';
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
    onCancel$: PropFunction<() => void>;
    onCreate$: PropFunction<(payload: CreateNodePayload) => void>;
};

export const TreeNodeConstruction = component$((props: TreeNodeConstructionProps) => {
    const nameValue = useSignal<string>(props.initialName || '');
    const subtitleValue = useSignal<string>(props.initialSubtitle || '');
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

    const updateFieldValue$ = $((index: number, value: string) => {
        fields.value = fields.value.map((f, i) =>
            i === index ? { ...f, fieldValue: value || null } : f
        );
    });

    const titleId = `node-title-${props.id}`;

    return (
        <div class={styles.nodeWrapper}>
            <article class={[styles.node, styles.nodeExpanded]} aria-labelledby={titleId}>
                <div class={styles.nodeBody}>
                    <div>
                        <input
                            class={styles.nodeTitle}
                            ref={nameInputRef}
                            placeholder="Name"
                            value={nameValue.value}
                            onInput$={(e) => (nameValue.value = (e.target as HTMLInputElement).value)}
                            aria-label="Node name"
                            id={titleId}
                        />
                        <input
                            class={styles.nodeSubtitle}
                            placeholder="Subtitle / Location / Short description"
                            value={subtitleValue.value}
                            onInput$={(e) => (subtitleValue.value = (e.target as HTMLInputElement).value)}
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
            <DataCard nodeId={props.id} isOpen={true}>
                {fields.value.map((f, idx) => (
                    <div class={fieldStyles.datafield} key={`${f.fieldName}-${idx}`}>
                        <div class={fieldStyles.datafieldLabel}>{f.fieldName}:</div>
                        <input
                            class={[fieldStyles.datafieldValue, f.fieldValue && fieldStyles.datafieldValueUnderlined]}
                            value={f.fieldValue ?? ''}
                            onInput$={(e) => updateFieldValue$(idx, (e.target as HTMLInputElement).value)}
                            aria-label={`${f.fieldName} value`}
                        />
                    </div>
                ))}
                <div class={styles.constructionActions}>
                    <button type="button" onClick$={props.onCancel$}>Cancel</button>
                    <button type="button" onClick$={handleCreate$}>Create</button>
                </div>
            </DataCard>
        </div>
    );
});
