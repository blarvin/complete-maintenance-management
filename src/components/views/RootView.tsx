/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, $, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { nodeService } from '../../data/services/nodeService';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export const RootView = component$(() => {
    const appState = useAppState();
    const { navigateToNode$ } = useAppTransitions();
    
    const nodes = useSignal<TreeNodeRecord[]>([]);

    const loadNodes$ = $(async () => {
        nodes.value = await nodeService.getRootNodes();
    });

    useVisibleTask$(async () => {
        await loadNodes$();
    });

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: null,
        onCreated$: loadNodes$,
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
                    ucDefaults={ucNode.defaultFields}
                    onCancel$={cancel$}
                    onCreate$={complete$}
                />
            ) : null}
            <CreateNodeButton variant="root" onClick$={start$} />
        </main>
    );
});
