/**
 * TreeNodeConstruction - Under-construction mode UI for TreeNode.
 * 
 * Renders input fields for name/subtitle and uses FieldList for all fields.
 * Matches the visual layout of TreeNodeDisplay for consistency.
 * 
 * Fields are managed by FieldList (same as display mode). When the user
 * clicks "Save" on a field, it persists to DB immediately. This provides
 * immediate visual feedback and consistent behavior with existing nodes.
 * 
 * On CREATE: any unsaved pending fields are saved first, then node name/subtitle
 * are updated in DB.
 */

import { component$, useSignal, $, PropFunction, useVisibleTask$ } from '@builder.io/qwik';
import { DataCard } from '../DataCard/DataCard';
import { FieldList, type FieldListHandle } from '../FieldList/FieldList';
import type { CreateNodePayload } from './types';
import { DEFAULT_DATAFIELD_NAMES } from '../../constants';
import styles from './TreeNode.module.css';

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
    const nameValue = useSignal<string>(props.initialName || '');
    const subtitleValue = useSignal<string>(props.initialSubtitle || '');
    const nameInputRef = useSignal<HTMLInputElement>();
    const fieldListHandle = useSignal<FieldListHandle | null>(null);

    // Focus name input on mount
    useVisibleTask$(() => {
        nameInputRef.value?.focus();
    });

    const handleCreate$ = $(async () => {
        // Save any unsaved pending fields first
        if (fieldListHandle.value) {
            await fieldListHandle.value.saveAllPending$();
        }
        
        // Update node name/subtitle
        await props.onCreate$({
            nodeName: nameValue.value,
            nodeSubtitle: subtitleValue.value,
            fields: [], // Fields are handled by FieldList, not passed here
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
            <DataCard nodeId={props.id} isOpen={true}>
                {/* FieldList handles all field management - same as display mode */}
                <FieldList 
                    nodeId={props.id} 
                    initialFieldNames={DEFAULT_DATAFIELD_NAMES}
                    handleRef={fieldListHandle}
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
