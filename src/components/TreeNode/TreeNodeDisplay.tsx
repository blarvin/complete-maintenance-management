/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 * 
 * Orchestrates the NodeHeader and DataCard.
 * Field logic is delegated to FieldList component.
 */

import { component$, $, PropFunction } from '@builder.io/qwik';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList } from '../FieldList/FieldList';
import { TreeNodeDetails } from '../TreeNodeDetails/TreeNodeDetails';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
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
    const { toggleCardExpanded$, toggleNodeDetailsExpanded$ } = useAppTransitions();

    // Get card state from FSM (persisted)
    const cardState = selectors.getDataCardState(appState, props.id);
    const isExpanded = cardState === 'EXPANDED';

    // Get node details state from FSM (persisted)
    const detailsState = selectors.getNodeDetailsState(appState, props.id);
    const isDetailsExpanded = detailsState === 'EXPANDED';

    const toggleExpand$ = $((e?: Event) => {
        e?.stopPropagation();
        toggleCardExpanded$(props.id);
    });

    const toggleDetailsExpand$ = $(() => {
        toggleNodeDetailsExpanded$(props.id);
    });

    const titleId = `node-title-${props.id}`;
    const isClickable = !!props.onNodeClick$;
    const isParent = props.nodeState === 'PARENT';
    const isChild = props.nodeState === 'CHILD';
    const indentVar = isChild ? '18px' : '50px';

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar }}>
            <TreeNodeDetails nodeId={props.id} isOpen={isDetailsExpanded}>
                <div>
                    <h3 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); font-weight: 600;">
                        Node Details
                    </h3>
                    <div style="color: var(--text-muted); font-size: var(--text-sm);">
                        {/* Future: Metadata section */}
                        {/* CreatedAt, UpdatedAt, UpdatedBy */}

                        {/* Future: Breadcrumb hierarchy */}
                        {/* Path: Root > Parent > Current */}

                        {/* Future: Action buttons */}
                        {/* DELETE, COPY (template), COPY (full node) */}

                        <p style="margin: 0;">Placeholder for future features</p>
                    </div>
                </div>
            </TreeNodeDetails>
            <NodeHeader
                id={props.id}
                titleId={titleId}
                isExpanded={isExpanded}
                isDetailsExpanded={isDetailsExpanded}
                isParent={isParent}
                isClickable={isClickable}
                nodeName={props.nodeName}
                nodeSubtitle={props.nodeSubtitle}
                parentId={props.parentId}
                onNodeClick$={props.onNodeClick$}
                onNavigateUp$={props.onNavigateUp$}
                onExpand$={toggleExpand$}
                onDetailsToggle$={toggleDetailsExpand$}
            />
            <DataCard isOpen={isExpanded} nodeId={props.id}>
                <FieldList nodeId={props.id} isConstruction={false} />
            </DataCard>
        </div>
    );
});
