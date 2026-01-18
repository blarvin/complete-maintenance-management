/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, useTask$, useVisibleTask$, $ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { useAppTransitions } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useBranchViewData } from '../../hooks/useBranchViewData';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = component$((props: BranchViewProps) => {
    const { navigateToNode$, navigateUp$ } = useAppTransitions();
    
    // Use the extracted hook for data loading
    const { parentNode, children, isLoading, load$, reload$ } = useBranchViewData();

    // Track parentId changes and reload data (must be in component to track props)
    useTask$(async ({ track }) => {
        const parentId = track(() => props.parentId);
        if (!parentId) return;
        await load$(parentId);
    });
    
    // Listen for storage change events (triggered by sync or other storage operations)
    useVisibleTask$(({ track, cleanup }) => {
        if (typeof window !== 'undefined') {
            const handleStorageChange = () => {
                if (props.parentId) {
                    console.log('[BranchView] Storage change detected, reloading...');
                    reload$(props.parentId);
                }
            };
            
            window.addEventListener('storage-change', handleStorageChange);
            track(() => props.parentId); // Track parentId for reactivity
            
            cleanup(() => {
                window.removeEventListener('storage-change', handleStorageChange);
            });
        }
    });

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: props.parentId,
        onCreated$: $(async () => {
            await reload$(props.parentId);
        }),
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
                {/* Filter out UC node to prevent dual rendering */}
                {children.value
                    .filter(child => !ucNode || child.id !== ucNode.id)
                    .map((child) => (
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
