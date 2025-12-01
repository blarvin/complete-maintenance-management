/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 * Shows NodeTitle, NodeSubtitle, expandable DataCard with DataFields.
 * Uses FSM state for card expansion (persisted).
 */

import { component$, $, PropFunction } from '@builder.io/qwik';
import { NodeTitle } from '../NodeTitle/NodeTitle';
import { NodeSubtitle } from '../NodeSubtitle/NodeSubtitle';
import { DataCard } from '../DataCard/DataCard';
import { DataField } from '../DataField/DataField';
import { useTreeNodeFields } from './useTreeNodeFields';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import type { DataField as DataFieldRecord } from '../../data/models';
import type { TreeNodeState } from '../../state/appState';
import styles from './TreeNode.module.css';

export type TreeNodeDisplayProps = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    nodeState: TreeNodeState;
    onNodeClick$?: PropFunction<() => void>;
};

export const TreeNodeDisplay = component$((props: TreeNodeDisplayProps) => {
    const appState = useAppState();
    const { toggleCardExpanded$ } = useAppTransitions();
    
    // Get card state from FSM (persisted)
    const cardState = selectors.getDataCardState(appState, props.id);
    const isExpanded = cardState === 'EXPANDED';
    
    const { fields } = useTreeNodeFields({ nodeId: props.id, enabled: true });

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

    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;

    return (
        <>
            <article
                class={[styles.node, isExpanded && styles.nodeExpanded]}
                aria-labelledby={titleId}
            >
                <div
                    class={[styles.nodeBody, isClickable && styles.nodeBodyClickable]}
                    onClick$={props.onNodeClick$}
                    onKeyDown$={handleBodyKeyDown$}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Open ${props.nodeName || 'node'}` : undefined}
                >
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
            <div class={[styles.nodeExpand, isExpanded && styles.nodeExpandOpen]}>
                <div class={styles.nodeExpandClip}>
                    <div class={styles.nodeExpandSlide}>
                        <DataCard>
                            {fields.value?.map((f: DataFieldRecord) => (
                                <DataField
                                    key={f.id}
                                    id={f.id}
                                    fieldName={f.fieldName}
                                    fieldValue={f.fieldValue}
                                />
                            ))}
                        </DataCard>
                    </div>
                </div>
            </div>
        </>
    );
});
