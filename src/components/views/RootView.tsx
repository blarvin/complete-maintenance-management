/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useRootViewData } from '../../hooks/useRootViewData';

export const RootView = component$(() => {
    const appState = useAppState();
    const { navigateToNode$ } = useAppTransitions();
    
    // Use the extracted hook for data loading
    const { nodes, isLoading, reload$ } = useRootViewData();

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: null,
        onCreated$: reload$,
    });

    // Filter out the UC node from the list to prevent dual rendering
    // (UC node is rendered separately below with UNDER_CONSTRUCTION state)
    const displayNodes = ucNode
        ? nodes.value.filter(n => n.id !== ucNode.id)
        : nodes.value;

    // Mirror BranchView's loading guard so the root list doesn't flash empty
    // before data resolves. Guard on empty nodes so background reloads (storage
    // change listener) don't replace the live list with "Loading...".
    if (isLoading.value && nodes.value.length === 0) {
        return <main class="view-root">Loading...</main>;
    }

    return (
        <main class="view-root">
            {displayNodes.map((n) => (
                <TreeNode
                    key={n.id}
                    id={n.id}
                    nodeName={n.nodeName}
                    nodeSubtitle={n.nodeSubtitle ?? ''}
                    nodeState={selectors.getDisplayNodeState(appState, n.id)}
                    onNodeClick$={() => navigateToNode$(n.id)}
                />
            ))}
            {ucNode ? (
                <TreeNode
                    key={ucNode.id}
                    id={ucNode.id}
                    nodeName={ucNode.name}
                    nodeSubtitle={ucNode.subtitle}
                    nodeState="UNDER_CONSTRUCTION"
                    onCancel$={cancel$}
                    onCreate$={complete$}
                />
            ) : null}
            <CreateNodeButton variant="root" onClick$={start$} />
        </main>
    );
});
