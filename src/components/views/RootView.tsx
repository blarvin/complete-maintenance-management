// src/components/views/RootView.tsx
import { component$, $, useSignal } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { DEFAULT_DATAFIELD_NAMES } from '../../data/fieldLibrary';
import { createNode } from '../../data/repo/treeNodes';
import { addField } from '../../data/repo/dataFields';

type UnderConstructionNode = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    defaultFields: { fieldName: string; fieldValue: string | null }[];
};

export const RootView = component$(() => {
    const ucNode = useSignal<UnderConstructionNode | null>(null);

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
        await createNode({ id, nodeName: payload.nodeName || 'Untitled', nodeSubtitle: payload.nodeSubtitle || '', parentId: null });
        for (const f of payload.fields) {
            await addField({ id: generateId(), fieldName: f.fieldName, parentNodeId: id, fieldValue: f.fieldValue ?? null });
        }
        ucNode.value = null;
    });

    return (
        <main class="view-root">
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

function generateId(): string {
    // Prefer crypto.randomUUID when available
    try {
        // @ts-ignore
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            // @ts-ignore
            return crypto.randomUUID();
        }
    } catch { }
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}


