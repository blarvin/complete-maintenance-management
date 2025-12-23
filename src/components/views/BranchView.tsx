/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, $, useSignal, useTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { getNodeService } from '../../data/services';
import { useAppState, useAppTransitions } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = component$((props: BranchViewProps) => {
    const appState = useAppState();
    const { navigateToNode$, navigateUp$, cancelConstruction$ } = useAppTransitions();
    
    const parentNode = useSignal<TreeNodeRecord | null>(null);
    const children = useSignal<TreeNodeRecord[]>([]);

    const loadData$ = $(async (parentId: string) => {
        const result = await getNodeService().getNodeWithChildren(parentId);
        parentNode.value = result.node;
        children.value = result.children;
    });

    // Track parentId changes and reload data
    useTask$(async ({ track }) => {
        const parentId = track(() => props.parentId);
        if (!parentId) return;
        
        // Reset construction state when navigating
        if (appState.underConstruction) {
            cancelConstruction$();
        }
        
        await loadData$(parentId);
    });

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: props.parentId,
        onCreated$: $(async () => {
            await loadData$(props.parentId);
        }),
    });

    if (!parentNode.value) {
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
                        nodeName={parentNode.value.nodeName}
                        nodeSubtitle={parentNode.value.nodeSubtitle ?? ''}
                        nodeState="PARENT"
                        parentId={parentNode.value.parentId}
                        onNavigateUp$={navigateUp$}
                    />
                </div>
            </div>

            {/* Children container with indent */}
            <div class="branch-children">
                {children.value.map((child) => (
                    <TreeNode
                        key={child.id}
                        id={child.id}
                        nodeName={child.nodeName}
                        nodeSubtitle={child.nodeSubtitle ?? ''}
                        nodeState="CHILD"
                        onNodeClick$={() => navigateToNode$(child.id)}
                    />
                ))}

                {/* Under construction node */}
                {ucNode ? (
                    <div class="branch-child-row">
                        <TreeNode
                            key={ucNode.id}
                            id={ucNode.id}
                            nodeName={ucNode.nodeName}
                            nodeSubtitle={ucNode.nodeSubtitle}
                            nodeState="UNDER_CONSTRUCTION"
                            ucDefaults={ucNode.defaultFields}
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
