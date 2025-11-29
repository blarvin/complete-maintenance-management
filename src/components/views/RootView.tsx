// src/components/views/RootView.tsx
import { component$, $, useSignal, useVisibleTask$, PropFunction } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { DEFAULT_DATAFIELD_NAMES } from '../../data/fieldLibrary';
import { listRootNodes } from '../../data/repo/treeNodes';
import type { TreeNode as TreeNodeRecord } from '../../data/models';
import { generateId } from '../../utils/id';
import { createRootNodeWithDefaultFields } from '../../data/services/createNode';

type UnderConstructionNode = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    defaultFields: { fieldName: string; fieldValue: string | null }[];
};

export type RootViewProps = {
    onNavigate$: PropFunction<(nodeId: string | null) => void>;
};

export const RootView = component$((props: RootViewProps) => {
    const ucNode = useSignal<UnderConstructionNode | null>(null);
    const nodes = useSignal<TreeNodeRecord[]>([]);

    const loadNodes$ = $(async () => {
        console.log('[RootView] Loading nodes...');
        try {
            nodes.value = await listRootNodes();
            console.log('[RootView] Loaded', nodes.value.length, 'nodes');
        } catch (err) {
            console.error('[RootView] Error loading nodes:', err);
            throw err;
        }
    });

    useVisibleTask$(async () => {
        console.log('[RootView] Mounted, calling loadNodes$');
        await loadNodes$();
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
        await createRootNodeWithDefaultFields({ id, nodeName: payload.nodeName, nodeSubtitle: payload.nodeSubtitle, defaults: payload.fields });
        ucNode.value = null;
        await loadNodes$();
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


