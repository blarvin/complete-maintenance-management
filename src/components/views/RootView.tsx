/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, $, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { nodeService } from '../../data/services/nodeService';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { generateId } from '../../utils/id';
import { DEFAULT_DATAFIELD_NAMES } from '../../data/fieldLibrary';
import { createNodeWithDefaultFields } from '../../data/services/createNode';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export const RootView = component$(() => {
    const appState = useAppState();
    const { navigateToNode$, startConstruction$, cancelConstruction$, completeConstruction$ } = useAppTransitions();
    
    const nodes = useSignal<TreeNodeRecord[]>([]);

    const loadNodes$ = $(async () => {
        nodes.value = await nodeService.getRootNodes();
    });

    useVisibleTask$(async () => {
        await loadNodes$();
    });

    const handleStartCreate$ = $(() => {
        startConstruction$({
            id: generateId(),
            parentId: null,
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: DEFAULT_DATAFIELD_NAMES.map((n) => ({
                fieldName: n,
                fieldValue: null,
            })),
        });
    });

    const handleCompleteCreate$ = $(async (payload: {
        nodeName: string;
        nodeSubtitle: string;
        fields: { fieldName: string; fieldValue: string | null }[];
    }) => {
        const ucData = appState.underConstruction;
        if (!ucData) return;

        await createNodeWithDefaultFields({
            id: ucData.id,
            parentId: null,
            nodeName: payload.nodeName,
            nodeSubtitle: payload.nodeSubtitle,
            defaults: payload.fields,
        });

        completeConstruction$();
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
                    nodeState={selectors.getTreeNodeState(appState, n.id, n.parentId)}
                    onNodeClick$={() => navigateToNode$(n.id)}
                />
            ))}
            {appState.underConstruction ? (
                <TreeNode
                    key={appState.underConstruction.id}
                    id={appState.underConstruction.id}
                    nodeName={appState.underConstruction.nodeName}
                    nodeSubtitle={appState.underConstruction.nodeSubtitle}
                    nodeState="UNDER_CONSTRUCTION"
                    ucDefaults={appState.underConstruction.defaultFields}
                    onCancel$={cancelConstruction$}
                    onCreate$={handleCompleteCreate$}
                />
            ) : null}
            <CreateNodeButton variant="root" onClick$={handleStartCreate$} />
        </main>
    );
});
