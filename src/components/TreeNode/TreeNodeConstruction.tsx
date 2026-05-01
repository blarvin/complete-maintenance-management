/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 *
 * Renders inputs for name/subtitle and uses FieldList (composer-mode) for the
 * field batch. On Save:
 *   1. props.onCreate$ creates the empty node.
 *   2. Inside its `afterNodeCreated$` callback we run FieldList handle commitAll$
 *      so the in-flight composer rows become real DataFields against the new
 *      node id while the FieldList is still mounted.
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList, type FieldListHandle } from '../FieldList/FieldList';
import type { CreateNodePayload } from './types';
import { TEMPLATE_IDS } from '../../data/services/seedTemplates';
import styles from './TreeNode.module.css';

const DEFAULT_TEMPLATE_IDS = [
    TEMPLATE_IDS.typeOf,
    TEMPLATE_IDS.description,
    TEMPLATE_IDS.tags,
] as const;

// Re-export for backwards compatibility
export type { ConstructionField } from './types';

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
    const nameInputRef = useSignal<HTMLInputElement>();
    const subtitleInputRef = useSignal<HTMLInputElement>();
    const fieldListHandle = useSignal<FieldListHandle | null>(null);

    useVisibleTask$(() => {
        nameInputRef.value?.focus();
    });

    const handleCreate$ = $(async () => {
        const nodeName = nameInputRef.value?.value || '';
        const nodeSubtitle = subtitleInputRef.value?.value || '';

        const handle = fieldListHandle.value;
        const afterNodeCreated$ = handle
            ? $(async () => {
                  await handle.commitAll$(-1);
              })
            : undefined;

        await props.onCreate$({
            nodeName,
            nodeSubtitle,
            afterNodeCreated$,
        });
    });

    const handleCancel$ = $(async () => {
        if (fieldListHandle.value) {
            await fieldListHandle.value.discardAll$();
        }
        await props.onCancel$();
    });

    const handleKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel$();
        }
    });

    const titleId = `node-title-${props.id}`;
    const indentVar = props.isChildConstruction ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar }}>
            <NodeHeader
                id={props.id}
                titleId={titleId}
                isExpanded={true}
                isParent={false}
                isClickable={false}
                nodeName={props.initialName || ''}
                nodeSubtitle={props.initialSubtitle || ''}
                isConstruction={true}
                nameInputRef={nameInputRef}
                subtitleInputRef={subtitleInputRef}
                onKeyDown$={handleKeyDown$}
                chevronDisabled={true}
            />
            <DataCard isOpen={true}>
                <FieldList
                    nodeId={props.id}
                    handleRef={fieldListHandle}
                    isConstruction={true}
                    initialTemplateIds={DEFAULT_TEMPLATE_IDS}
                />

                <div q:slot="actions" class={styles.constructionActions}>
                    <button type="button" onClick$={handleCancel$}>Cancel</button>
                    <button type="button" onClick$={handleCreate$}>Create</button>
                </div>
            </DataCard>
        </div>
    );
});
