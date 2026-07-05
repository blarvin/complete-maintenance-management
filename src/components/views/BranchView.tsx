/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, useComputed$, useTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { LensCreate } from '../LensCreate/LensCreate';
import { useAppState, useAppTransitions } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useElementChildren, useElementById } from '../../hooks/useElementChildren';
import { useLensGather } from '../../hooks/useLensGather';
import { useLensPolicy } from '../../hooks/useLensPolicy';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { reRootCreateKindsFor } from '../../kinds/registry';
import { nodeRenderMode } from '../../kinds/renderMode';
import type { Kind } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = component$((props: BranchViewProps) => {
    const appState = useAppState();
    const { navigateToNode$, navigateUp$, cancelConstruction$ } = useAppTransitions();

    // Data arrives via the storage event bus; navigation re-triggers loads
    // because the hooks track the parentId signal.
    const parentIdSig = useComputed$(() => props.parentId);
    const { element: parentEl } = useElementById(parentIdSig);
    const { children, isLoading } = useElementChildren(parentIdSig, 'nodes');

    const parentNode = useComputed$(() =>
        parentEl.value && isReRoot(parentEl.value.kind) ? parentEl.value : null);

    // Re-rooted INTO a lens (Provision + typed Derivation, e.g. `jobs`): it "looks
    // like a parent" — the jobs it lenses render as Node-like CHILD cards (each with
    // its own expandable DataCard; clicking re-roots into that job). They are derived
    // (really children of the owning node), so we gather rather than read real
    // children. Generic off the manifest — `logbook` (#6c) inherits this.
    const lensTargetKind = useComputed$<Kind | null>(() => {
        const el = parentEl.value;
        if (!el) return null;
        const mode = nodeRenderMode(el.kind);
        return mode.mode === 'lens' ? mode.targetKind : null;
    });
    const ownerIdSig = useComputed$(() => parentEl.value?.parentId ?? '');
    const derivedJobs = useLensGather(ownerIdSig, lensTargetKind);
    // Re-rooted into a lens, `parentEl` IS the lens Element (carries the bound
    // policy Definition). No-ops to the pickerLabel fallback for plain nodes.
    const lensPolicy = useLensPolicy(parentEl, lensTargetKind);

    // Navigating to a new branch cancels any in-flight construction.
    // (Previously buried in useBranchViewData.load$, where background sync
    // reloads also — wrongly — triggered it.)
    useTask$(({ track }) => {
        track(() => props.parentId);
        if (appState.underConstruction) {
            cancelConstruction$();
        }
    });

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: props.parentId,
    });

    if (isLoading.value || !parentNode.value) {
        return <main class="view-branch">Loading...</main>;
    }

    return (
        <main class="view-branch">
            {/* Parent node row */}
            <div class="branch-parent-row">
                <div class="branch-parent-node">
                    <TreeNode
                        key={parentNode.value.id}
                        id={parentNode.value.id}
                        name={parentNode.value.name}
                        subtitle={parentNode.value.subtitle ?? ''}
                        nodeState="PARENT"
                        kind={parentNode.value.kind}
                        parentId={parentNode.value.parentId}
                        onNavigateUp$={navigateUp$}
                    />
                </div>
            </div>

            {/* Children container with indent */}
            <div class="branch-children">
                {lensTargetKind.value ? (
                    /* Lens parent: the derived jobs as Node-like CHILD cards (each owns
                       its expandable DataCard; click re-roots into that job), plus the
                       inline create. The lens's own DataFields show in the PARENT card
                       above. No global UC here — LensCreate mints directly. */
                    <>
                        {derivedJobs.value.map((job) => (
                            <TreeNode
                                key={job.id}
                                id={job.id}
                                name={job.name}
                                subtitle={job.subtitle ?? ''}
                                nodeState="CHILD"
                                kind={job.kind}
                                onNodeClick$={() => navigateToNode$(job.id)}
                            />
                        ))}
                        <LensCreate
                            ownerId={ownerIdSig.value}
                            targetKind={lensTargetKind.value}
                            entryLabel={lensPolicy.value.entryLabel || undefined}
                        />
                    </>
                ) : (
                    <>
                        {/* Filter out UC node (dual render) + lens-surfaced kinds, which
                            live in their lens rollup, not as loose tree children. */}
                        {children.value
                            .filter(child => !ucNode || child.id !== ucNode.id)
                            .filter(child => !isLensSurfaced(child.kind))
                            .map((child) => (
                            <TreeNode
                                key={child.id}
                                id={child.id}
                                name={child.name}
                                subtitle={child.subtitle ?? ''}
                                nodeState="CHILD"
                                kind={child.kind}
                                onNodeClick$={() => navigateToNode$(child.id)}
                            />
                        ))}

                        {/* Under construction node */}
                        {ucNode ? (
                            <div class="branch-child-row">
                                <TreeNode
                                    // Namespaced key — see RootView's UC TreeNode comment.
                                    key={`uc-${ucNode.id}`}
                                    id={ucNode.id}
                                    name={ucNode.name}
                                    subtitle={ucNode.subtitle}
                                    nodeState="UNDER_CONSTRUCTION"
                                    isChildConstruction={true}
                                    onCancel$={cancel$}
                                    onCreate$={complete$}
                                />
                            </div>
                        ) : null}

                        {/* Normal node-create picker, trimmed of lens-surfaced kinds (jobs are
                            minted from inside the Jobs container, never as loose tree siblings). */}
                        <CreateNodeButton
                            variant="child"
                            availableKinds={reRootCreateKindsFor(parentNode.value.kind).filter((k) => !isLensSurfaced(k))}
                            onClick$={start$}
                        />
                    </>
                )}
            </div>
        </main>
    );
});
