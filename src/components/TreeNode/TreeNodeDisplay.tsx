/**
 * TreeNodeDisplay - Read-only display mode for TreeNode.
 *
 * Orchestrates the NodeHeader and DataCard.
 * Field logic is delegated to FieldList component.
 */

import { Show, createResource, createSignal } from 'solid-js';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { FieldList } from '../FieldList/FieldList';
import { LensRollup } from '../LensRollup/LensRollup';
import { TreeNodeDetails } from '../TreeNodeDetails/TreeNodeDetails';
import { DeletedFields } from '../TreeNodeDetails/DeletedFields';
import { ElementIdRow } from '../ElementIdRow/ElementIdRow';
import { TreeBreadcrumbs } from '../Breadcrumbs/TreeBreadcrumbs';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useRevealOnArrival } from '../../hooks/useRevealOnArrival';
import { getCommandBus } from '../../data/commands';
import { getElementQueries } from '../../data/queries';
import { compareHistory } from '../../data/storage/historyHelpers';
import { formatTimestampShort } from '../../utils/time';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { canHaveChildren } from '../../kinds/childrenPolicy';
import { isLibraryChrome } from '../../data/libraryChrome';
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

    /**
     * The node's own metadata, read from its history: the `create` row dates it,
     * the newest row says who touched it last and when, and that row's `rev` is
     * the version. Sourced here rather than from the Element because the Element
     * carries no `createdAt` and no revision at all — both live only in the log.
     *
     * **Gated on the panel being open.** `TreeNodeDetails` animates rather than
     * unmounts, so its children are mounted for every node on screen; an ungated
     * fetch would be one history read per visible node per paint of the tree.
     * Error-catching fetcher, the idiom the field renderers use: a failed read
     * degrades to "—", never to an unhandled rejection.
     */
    const [meta] = createResource(
        () => (isDetailsExpanded() ? props.id : null),
        async (id) => {
            try {
                const rows = (await getElementQueries().getElementHistory(id)).sort(compareHistory);
                return {
                    createdAt: rows.find((r) => r.action === 'create')?.updatedAt ?? null,
                    latest: rows.length ? rows[rows.length - 1] : null,
                };
            } catch {
                return null;
            }
        },
    );

    const stamp = (at: number | null | undefined) => (at ? formatTimestampShort(at) : '—');

    const handleDeleteNode = async () => {
        const nodeId = props.id;
        const parentId = props.parentId;
        const ok = await commitWithUndo({
            message: 'Node deleted',
            execute: () => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id: nodeId } }),
            undo: () => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id: nodeId } }),
            // Same deferral as a Field delete: the tombstone is immediate, the
            // audit row waits out the undo window (SPEC → Undo semantics).
            onExpire: () => getCommandBus().execute({ type: 'LOG_ELEMENT_DELETE', payload: { id: nodeId } }),
        });
        if (ok) {
            props.onNavigateUp?.(parentId ?? null);
        }
    };

    /**
     * The first production caller of `UPDATE_ELEMENT_NAME`. Registered since the
     * command bus landed and exercised only by `elementCommands.test.ts`, which
     * also means this is the first time an `internal-link`'s live pin has a
     * rename to follow (ISSUES → *Renaming an Element*).
     *
     * Undo is the same command with the previous text, captured here — the
     * closure-based undo the Snackbar contract asks for, no snapshot.
     */
    const renameNode = async (next: string) => {
        const id = props.id;
        const prev = props.name;
        await commitWithUndo({
            message: 'Node renamed',
            execute: () => getCommandBus().execute({
                type: 'UPDATE_ELEMENT_NAME',
                payload: { id, name: next },
            }),
            undo: () => getCommandBus().execute({
                type: 'UPDATE_ELEMENT_NAME',
                payload: { id, name: prev },
            }),
        });
    };

    const resubtitleNode = async (next: string) => {
        const id = props.id;
        const prev = props.subtitle;
        await commitWithUndo({
            message: 'Subtitle updated',
            execute: () => getCommandBus().execute({
                type: 'UPDATE_ELEMENT_SUBTITLE',
                payload: { id, subtitle: next },
            }),
            undo: () => getCommandBus().execute({
                type: 'UPDATE_ELEMENT_SUBTITLE',
                payload: { id, subtitle: prev },
            }),
        });
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
    // Library chrome bears no DataCard (its children arrive by re-rooting, and
    // the index lenses gather rather than own) and no Delete Asset row.
    const isChrome = () => isLibraryChrome(props.kind);
    const showDataCard = () => !isChrome() && (ownsChildren() || isLens());

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
                    {/* A compact block, not one row per fact: the byline, then
                        both dates and the last hand on one line. The id and the
                        version pair up on the row below, which was already
                        there. */}
                    <div class={detailsStyles.metaBlock}>
                        <Show when={props.subtitle}>
                            <div class={detailsStyles.metaByline}>{props.subtitle}</div>
                        </Show>
                        <div>
                            {`Created ${stamp(meta()?.createdAt)} · Updated ${stamp(meta()?.latest?.updatedAt)}`}
                            <Show when={meta()?.latest?.updatedBy}>
                                {(by) => ` by ${by()}`}
                            </Show>
                        </div>
                    </div>
                    <div class={detailsStyles.idRow}>
                        <ElementIdRow id={props.id} version={meta()?.latest?.rev} />
                    </div>
                    {/* Renders nothing unless this node has deleted Fields, so
                        a clean node's panel is unchanged. */}
                    <Show when={!isChrome()}>
                        <DeletedFields nodeId={props.id} />
                    </Show>
                    <Show when={!isChrome()}>
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
                onRenameName={isChrome() ? undefined : renameNode}
                onRenameSubtitle={isChrome() ? undefined : resubtitleNode}
            />
            <Show when={showDataCard()}>
                <DataCard isOpen={isExpanded()}>
                    <Show when={ownsChildren()}>
                        <FieldList nodeId={props.id} kind={props.kind} isConstruction={false} />
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
