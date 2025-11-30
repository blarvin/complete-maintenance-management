/**
 * BranchView - Displays a parent node with its children.
 * Uses shared useNodeCreation hook for the creation flow.
 */

import { component$, $, useSignal, useTask$, PropFunction } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { UpButton } from '../UpButton/UpButton';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { getNodeById, listChildren } from '../../data/repo/treeNodes';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
    onNavigate$: PropFunction<(nodeId: string | null) => void>;
};

export const BranchView = component$((props: BranchViewProps) => {
    const parentNode = useSignal<TreeNodeRecord | null>(null);
    const children = useSignal<TreeNodeRecord[]>([]);

    const loadData$ = $(async (parentId: string) => {
        const [parent, kids] = await Promise.all([
            getNodeById(parentId),
            listChildren(parentId),
        ]);
        parentNode.value = parent;
        children.value = kids;
    });

    const { ucNode, startCreate$, cancelCreate$, completeCreate$, resetCreate$ } = useNodeCreation({
        parentId: props.parentId,
        onCreated$: $(async () => {
            await loadData$(props.parentId);
        }),
    });

    // Track parentId changes and reload data
    useTask$(async ({ track }) => {
        const parentId = track(() => props.parentId);
        if (!parentId) return;
        resetCreate$();  // Reset under-construction state when navigating
        await loadData$(parentId);
    });

    if (!parentNode.value) {
        return <main class="view-branch">Loading...</main>;
    }

    return (
        <main class="view-branch">
            {/* Parent node row with UpButton */}
            <div class="branch-parent-row">
                <UpButton
                    parentId={parentNode.value.parentId}
                    onNavigate$={props.onNavigate$}
                />
                <div class="branch-parent-node">
                    <TreeNode
                        id={parentNode.value.id}
                        nodeName={parentNode.value.nodeName}
                        nodeSubtitle={parentNode.value.nodeSubtitle ?? ''}
                        mode="isParent"
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
                        mode="isChild"
                        onNodeClick$={() => props.onNavigate$(child.id)}
                    />
                ))}

                {/* Under construction node */}
                {ucNode.value ? (
                    <div class="branch-child-row">
                        <TreeNode
                            id={ucNode.value.id}
                            nodeName={ucNode.value.nodeName}
                            nodeSubtitle={ucNode.value.nodeSubtitle}
                            mode="isUnderConstruction"
                            ucDefaults={ucNode.value.defaultFields}
                            onCancel$={cancelCreate$}
                            onCreate$={completeCreate$}
                        />
                    </div>
                ) : null}

                <CreateNodeButton variant="child" onClick$={startCreate$} />
            </div>
        </main>
    );
});
