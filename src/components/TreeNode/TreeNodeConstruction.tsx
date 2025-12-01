/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * Renders input fields for name/subtitle and default field inputs.
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { DataCard } from '../DataCard/DataCard';
import styles from './TreeNode.module.css';
import fieldStyles from '../DataField/DataField.module.css';

export type ConstructionField = {
    fieldName: string;
    fieldValue: string | null;
};

export type TreeNodeConstructionProps = {
    id: string;
    initialName?: string;
    initialSubtitle?: string;
    defaultFields: ConstructionField[];
    onCancel$?: PropFunction<() => void>;
    onCreate$?: PropFunction<(payload: {
        nodeName: string;
        nodeSubtitle: string;
        fields: ConstructionField[];
    }) => void>;
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
        if (!props.onCreate$) return;
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
        <>
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
            <div class={[styles.nodeExpand, styles.nodeExpandOpen]}>
                <div class={styles.nodeExpandClip}>
                    <div class={styles.nodeExpandSlide}>
                        <DataCard>
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
                </div>
            </div>
        </>
    );
});
