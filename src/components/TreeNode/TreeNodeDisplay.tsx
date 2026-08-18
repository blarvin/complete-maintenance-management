/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 *
 * Orchestrates the NodeHeader and DataCard.
 * Field logic is delegated to FieldList component.
 */

import { Show, createSignal } from 'solid-js';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList } from '../FieldList/FieldList';
import { LensRollup } from '../LensRollup/LensRollup';
import { TreeNodeDetails } from '../TreeNodeDetails/TreeNodeDetails';
import { ElementIdRow } from '../ElementIdRow/ElementIdRow';
import { TreeBreadcrumbs } from '../Breadcrumbs/TreeBreadcrumbs';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useRevealOnArrival } from '../../hooks/useRevealOnArrival';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { canHaveChildren } from '../../kinds/childrenPolicy';
import { nodeRenderMode } from '../../kinds/renderMode';
import { LIBRARY_ROOT_ID } from '../../data/definitionIds';
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
    /** Self-referential on a FieldDefinition — see `TreeNodeDisplayProps` in ./types. */
    definitionId?: string | null;
    onNodeClick?: () => void;
    onNavigateUp?: (parentId: string | null) => void;
};

export const TreeNodeDisplay = (props: TreeNodeDisplayProps) => {
    const appState = useAppState();
    const { toggleCardExpanded, toggleNodeDetailsExpanded } = useAppTransitions();

    // Reveal target: a link pointing at this node brings it into view and
    // flashes it here, leaving the tap that re-roots to the user.
    const [wrapperEl, setWrapperEl] = createSignal<HTMLElement>();
    const isRevealed = useRevealOnArrival(() => props.id, wrapperEl);

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
    /** A FieldDefinition: the Node points at itself (SPEC → *What identifies a
     *  Definition*). Its card's Fields are its config. */
    const isDefinition = () => !!props.definitionId && props.definitionId === props.id;
    const isLibraryRoot = () => props.id === LIBRARY_ROOT_ID;

    /**
     * Delete is admin-only across the Library (SPEC → *Edit / Delete Semantics*):
     * end users cannot remove a Definition — not their own, not others' — because
     * one is shared meaning that other people's Fields are bound to, and the
     * Library Node itself is not user-created either.
     *
     * **Non-deletability is a permissions concern, not a kind.** When permissions
     * land this becomes a property available to any Element; until then it is
     * simply an affordance these Nodes do not draw.
     */
    const canDelete = () => !isDefinition() && !isLibraryRoot();

    const renderMode = () => nodeRenderMode(props.kind);
    const lensTargetKind = () => {
        const rm = renderMode();
        return rm.mode === 'lens' ? rm.targetKind : undefined;
    };
    const isLens = () => renderMode().mode === 'lens';
    const ownsChildren = () => canHaveChildren(props.kind);
    const showDataCard = () => ownsChildren() || isLens();

    return (
        <div
            ref={setWrapperEl}
            classList={{
                [styles.nodeWrapper]: true,
                [styles.nodeWrapperRevealed]: isRevealed(),
            }}
            style={{ '--datacard-indent': indentVar() }}
        >
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
                    <div class={detailsStyles.idRow}>
                        <ElementIdRow id={props.id} />
                    </div>
                    <Show when={canDelete()}>
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
                    </Show>
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
                        <FieldList
                            nodeId={props.id}
                            kind={props.kind}
                            isDefinition={isDefinition()}
                            isConstruction={false}
                        />
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
