// src/components/views/BranchView.tsx
import { component$, $, useSignal, useTask$, PropFunction } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { UpButton } from '../UpButton/UpButton';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { DEFAULT_DATAFIELD_NAMES } from '../../data/fieldLibrary';
import { getNodeById, listChildren } from '../../data/repo/treeNodes';
import type { TreeNode as TreeNodeRecord } from '../../data/models';
import { generateId } from '../../utils/id';
import { createChildNodeWithDefaultFields } from '../../data/services/createNode';

type UnderConstructionNode = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    defaultFields: { fieldName: string; fieldValue: string | null }[];
};

export type BranchViewProps = {
    parentId: string;
    onNavigate$: PropFunction<(nodeId: string | null) => void>;
};

export const BranchView = component$((props: BranchViewProps) => {
    const parentNode = useSignal<TreeNodeRecord | null>(null);
    const children = useSignal<TreeNodeRecord[]>([]);
    const ucNode = useSignal<UnderConstructionNode | null>(null);

    const loadData$ = $(async (parentId: string) => {
        const [parent, kids] = await Promise.all([
            getNodeById(parentId),
            listChildren(parentId),
        ]);
        parentNode.value = parent;
        children.value = kids;
    });

    // Track parentId changes and reload data (also reset any in-progress creation)
    useTask$(async ({ track }) => {
        const parentId = track(() => props.parentId);
        if (!parentId) return;  // Guard against invalid parentId
        ucNode.value = null;  // Reset under-construction state when navigating
        await loadData$(parentId);
    });

    const startCreate$ = $(() => {
        if (ucNode.value) return;
        ucNode.value = {
            id: generateId(),
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: DEFAULT_DATAFIELD_NAMES.map((n) => ({ fieldName: n, fieldValue: null })),
        };
    });

    const cancelCreate$ = $(() => {
        ucNode.value = null;
    });

    const completeCreate$ = $(async (payload: { nodeName: string; nodeSubtitle: string; fields: { fieldName: string; fieldValue: string | null }[] }) => {
        if (!ucNode.value) return;
        const id = ucNode.value.id;
        await createChildNodeWithDefaultFields({
            id,
            parentId: props.parentId,
            nodeName: payload.nodeName,
            nodeSubtitle: payload.nodeSubtitle,
            defaults: payload.fields,
        });
        ucNode.value = null;
        await loadData$(props.parentId);
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
