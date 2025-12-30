/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 * Shows NodeTitle, NodeSubtitle, expandable DataCard with DataFields.
 */

import { component$, $, PropFunction } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';
import { DataField } from '../DataField/DataField';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { UpButton } from '../UpButton/UpButton';
import { useTreeNodeFields } from './useTreeNodeFields';
import { usePendingForms } from '../../hooks/usePendingForms';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import type { DataField as DataFieldRecord } from '../../data/models';
import type { DisplayNodeState } from './types';
import styles from './TreeNode.module.css';

export type TreeNodeDisplayProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    nodeState: DisplayNodeState;
    parentId?: string | null;
    onNodeClick$?: PropFunction<() => void>;
    onNavigateUp$?: PropFunction<(parentId: string | null) => void>;
};

export const TreeNodeDisplay = component$((props: TreeNodeDisplayProps) => {
    const appState = useAppState();
    const { toggleCardExpanded$ } = useAppTransitions();
    
    // Get card state from FSM (persisted)
    const cardState = selectors.getDataCardState(appState, props.id);
    const isExpanded = cardState === 'EXPANDED';
    
    // Persisted fields from DB
    const { fields, reload$ } = useTreeNodeFields({ nodeId: props.id, enabled: true });

    // Pending forms (forms being added, not yet saved)
    const { forms: pendingForms, add$, save$, cancel$, change$ } = usePendingForms({
        nodeId: props.id,
        onSaved$: reload$,
    });

    const toggleExpand$ = $((e?: Event) => {
        e?.stopPropagation();
        toggleCardExpanded$(props.id);
    });

    const handleBodyKeyDown$ = $((e: KeyboardEvent) => {
        if (props.onNodeClick$ && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            props.onNodeClick$();
        }
    });

    const handleExpandKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleExpand$();
        }
    });

    const handleFieldDeleted$ = $(() => {
        reload$();
    });

    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;
    const isParent = props.nodeState === 'PARENT';
    const isChild = props.nodeState === 'CHILD';
    const indentVar = isChild ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar }}>
            <article
                class={[styles.node, isExpanded && styles.nodeExpanded, isParent && styles.nodeParent]}
                aria-labelledby={titleId}
                data-node-id={props.id}
            >
                <div
                    class={[styles.nodeBody, isClickable && styles.nodeBodyClickable, isClickable && 'no-caret']}
                    onClick$={props.onNodeClick$}
                    onKeyDown$={handleBodyKeyDown$}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Open ${props.nodeName || 'node'}` : undefined}
                >
                    {isParent && props.onNavigateUp$ && (
                        <div class={styles.upButtonWrapper}>
                            <UpButton
                                parentId={props.parentId ?? null}
                                onNavigate$={props.onNavigateUp$}
                            />
                        </div>
                    )}
                    <div>
                        <NodeTitle nodeName={props.nodeName} id={titleId} />
                        <NodeSubtitle nodeSubtitle={props.nodeSubtitle} />
                    </div>
                    <button
                        type="button"
                        class={styles.nodeChevron}
                        onClick$={toggleExpand$}
                        onKeyDown$={handleExpandKeyDown$}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded ? '▾' : '◂'}
                    </button>
                </div>
            </article>
            <DataCard 
                isOpen={isExpanded} 
                nodeId={props.id} 
                pendingCount={pendingForms.value.length}
                onAddField$={add$}
            >
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
            </DataCard>
        </div>
    );
});
