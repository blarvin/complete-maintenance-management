/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 *
 * Orchestrates the NodeHeader and DataCard.
 * Field logic is delegated to FieldList component.
 */

import { Show } from 'solid-js';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList } from '../FieldList/FieldList';
import { LensRollup } from '../LensRollup/LensRollup';
import { TreeNodeDetails } from '../TreeNodeDetails/TreeNodeDetails';
import { TreeBreadcrumbs } from '../Breadcrumbs/TreeBreadcrumbs';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { canHaveChildren } from '../../kinds/childrenPolicy';
import { nodeRenderMode } from '../../kinds/renderMode';
import type { DisplayNodeState } from './types';
import type { Kind } from '../../data/models';
import styles from './TreeNode.module.css';
import detailsStyles from '../TreeNodeDetails/TreeNodeDetails.module.css';

export type TreeNodeDisplayProps = {
    id: string;
    name: string;
    subtitle: string;
    nodeState: DisplayNodeState;
    kind: Kind;
    parentId?: string | null;
    onNodeClick?: () => void;
    onNavigateUp?: (parentId: string | null) => void;
};

export const TreeNodeDisplay = (props: TreeNodeDisplayProps) => {
    const appState = useAppState();
    const { toggleCardExpanded, toggleNodeDetailsExpanded } = useAppTransitions();

    // Card / node-details state from the FSM (persisted)
    const isExpanded = () => selectors.getDataCardState(appState, props.id) === 'EXPANDED';
    const isDetailsExpanded = () => selectors.getNodeDetailsState(appState, props.id) === 'EXPANDED';

    const toggleExpand = (e?: Event) => {
        e?.stopPropagation();
        toggleCardExpanded(props.id);
    };

    const handleDeleteNode = async () => {
        const nodeId = props.id;
        const parentId = props.parentId;
        const ok = await commitWithUndo({
            message: 'Node deleted',
            execute: () => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id: nodeId } }),
            undo: () => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id: nodeId } }),
        });
        if (ok) {
            props.onNavigateUp?.(parentId ?? null);
        }
    };

    const titleId = () => `node-title-${props.id}`;
    const isClickable = () => !!props.onNodeClick;
    const isParent = () => props.nodeState === 'PARENT';
    const isChild = () => props.nodeState === 'CHILD';
    const indentVar = () => (isChild() ? '18px' : '50px');

    // Manifest-aware shell (#5): the DataCard is *display chrome*, orthogonal to
    // physical ownership. It renders for a kind that owns children (Children →
    // FieldList) OR that derives a typed rollup (a lens → LensRollup). The `jobs`
    // container is both: its own DataFields plus the "Jobs (N)" rollup.
    const renderMode = () => nodeRenderMode(props.kind);
    const lensTargetKind = () => {
        const rm = renderMode();
        return rm.mode === 'lens' ? rm.targetKind : undefined;
    };
    const isLens = () => renderMode().mode === 'lens';
    const ownsChildren = () => canHaveChildren(props.kind);
    const showDataCard = () => ownsChildren() || isLens();

    return (
        <div class={styles.nodeWrapper} style={{ '--datacard-indent': indentVar() }}>
            <TreeNodeDetails nodeId={props.id} isOpen={isDetailsExpanded()}>
                <div>
                    <TreeBreadcrumbs nodeId={props.id} />
                    <h3 style={{ margin: '0 0 var(--space-3) 0', 'font-size': 'var(--text-base)', 'font-weight': 600 }}>
                        Node Details
                    </h3>
                    <div style={{ color: 'var(--text-muted)', 'font-size': 'var(--text-sm)' }}>
                        {/* Future: Metadata section */}
                        {/* CreatedAt, UpdatedAt, UpdatedBy */}

                        {/* Future: Breadcrumb hierarchy */}
                        {/* Path: Root > Parent > Current */}
                    </div>
                    <div class={detailsStyles.actionsRow}>
                        <button
                            type="button"
                            class={detailsStyles.deleteButton}
                            onClick={() => void handleDeleteNode()}
                            aria-label="Delete this asset"
                        >
                            Delete Asset
                        </button>
                    </div>
                </div>
            </TreeNodeDetails>
            <NodeHeader
                id={props.id}
                titleId={titleId()}
                isExpanded={isExpanded()}
                isDetailsExpanded={isDetailsExpanded()}
                isParent={isParent()}
                isClickable={isClickable()}
                name={props.name}
                subtitle={props.subtitle}
                parentId={props.parentId}
                onNodeClick={props.onNodeClick}
                onNavigateUp={props.onNavigateUp}
                onExpand={showDataCard() ? toggleExpand : undefined}
                onDetailsToggle={() => toggleNodeDetailsExpanded(props.id)}
                showChevron={showDataCard()}
            />
            <Show when={showDataCard()}>
                <DataCard isOpen={isExpanded()}>
                    <Show when={ownsChildren()}>
                        <FieldList nodeId={props.id} isConstruction={false} />
                    </Show>
                    {/* The compact in-card rollup is the lens's CHILD (under-a-node)
                        summary only. Re-rooted (PARENT), the jobs render as Node-like
                        CHILD cards via BranchView, so the lens's own card stays its
                        own DataFields (field details / history). */}
                    <Show when={isLens() && !isParent()}>
                        <LensRollup lensId={props.id} targetKind={lensTargetKind()!} />
                    </Show>
                </DataCard>
            </Show>
        </div>
    );
};
