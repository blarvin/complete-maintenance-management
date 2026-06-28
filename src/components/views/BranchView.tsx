/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, useComputed$, useTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { useAppState, useAppTransitions } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useElementChildren, useElementById } from '../../hooks/useElementChildren';
import { isReRoot } from '../../kinds/placement';

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
                        parentId={parentNode.value.parentId}
                        onNavigateUp$={navigateUp$}
                    />
                </div>
            </div>

            {/* Children container with indent */}
            <div class="branch-children">
                {/* Filter out UC node to prevent dual rendering */}
                {children.value
                    .filter(child => !ucNode || child.id !== ucNode.id)
                    .map((child) => (
                    <TreeNode
                        key={child.id}
                        id={child.id}
                        name={child.name}
                        subtitle={child.subtitle ?? ''}
                        nodeState="CHILD"
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

                <CreateNodeButton variant="child" onClick$={start$} />
            </div>
        </main>
    );
});
