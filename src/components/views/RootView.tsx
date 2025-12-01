/**
 * RootView - Displays top-level tree nodes.
 * Uses shared useNodeCreation hook for the creation flow.
 */

import { component$, $, useSignal, useVisibleTask$, PropFunction } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { nodeService } from '../../data/services/nodeService';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export type RootViewProps = {
    onNavigate$: PropFunction<(nodeId: string | null) => void>;
};

export const RootView = component$((props: RootViewProps) => {
    const nodes = useSignal<TreeNodeRecord[]>([]);

    const loadNodes$ = $(async () => {
        nodes.value = await nodeService.getRootNodes();
    });

    useVisibleTask$(async () => {
        await loadNodes$();
    });

    const { ucNode, startCreate$, cancelCreate$, completeCreate$ } = useNodeCreation({
        parentId: null,  // Root nodes have no parent
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
                    mode="isRoot"
                    onNodeClick$={() => props.onNavigate$(n.id)}
                />
            ))}
            {ucNode.value ? (
                <TreeNode
                    id={ucNode.value.id}
                    nodeName={ucNode.value.nodeName}
                    nodeSubtitle={ucNode.value.nodeSubtitle}
                    mode="isUnderConstruction"
                    ucDefaults={ucNode.value.defaultFields}
                    onCancel$={cancelCreate$}
                    onCreate$={completeCreate$}
                />
            ) : null}
            <CreateNodeButton variant="root" onClick$={startCreate$} />
        </main>
    );
});
