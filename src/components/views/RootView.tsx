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
    const { nodes, reload$ } = useRootViewData();

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: null,
        onCreated$: reload$,
    });

    return (
        <main class="view-root">
            {nodes.value.map((n) => (
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
                    nodeName={ucNode.nodeName}
                    nodeSubtitle={ucNode.nodeSubtitle}
                    nodeState="UNDER_CONSTRUCTION"
                    onCancel$={cancel$}
                    onCreate$={complete$}
                />
            ) : null}
            <CreateNodeButton variant="root" onClick$={start$} />
        </main>
    );
});
