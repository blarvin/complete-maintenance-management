/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, $, useSignal, useTask$ } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { UpButton } from '../UpButton/UpButton';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { nodeService } from '../../data/services/nodeService';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { generateId } from '../../utils/id';
import { DEFAULT_DATAFIELD_NAMES } from '../../constants';
import { createNodeWithDefaultFields } from '../../data/services/createNode';
import type { TreeNode as TreeNodeRecord } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = component$((props: BranchViewProps) => {
    const appState = useAppState();
    const { 
        navigateToNode$, 
        navigateUp$, 
        startConstruction$, 
        cancelConstruction$, 
        completeConstruction$ 
    } = useAppTransitions();
    
    const parentNode = useSignal<TreeNodeRecord | null>(null);
    const children = useSignal<TreeNodeRecord[]>([]);

    const loadData$ = $(async (parentId: string) => {
        const result = await nodeService.getNodeWithChildren(parentId);
        parentNode.value = result.node;
        children.value = result.children;
    });

    // Track parentId changes and reload data
    useTask$(async ({ track }) => {
        const parentId = track(() => props.parentId);
        if (!parentId) return;
        
        // Reset construction state when navigating
        if (appState.underConstruction) {
            cancelConstruction$();
        }
        
        await loadData$(parentId);
    });

    const handleStartCreate$ = $(() => {
        startConstruction$({
            id: generateId(),
            parentId: props.parentId,
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
            parentId: props.parentId,
            nodeName: payload.nodeName,
            nodeSubtitle: payload.nodeSubtitle,
            defaults: payload.fields,
        });

        completeConstruction$();
        await loadData$(props.parentId);
    });

    if (!parentNode.value) {
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
                {children.value.map((child) => (
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
                {appState.underConstruction ? (
                    <div class="branch-child-row">
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
                    </div>
                ) : null}

                <CreateNodeButton variant="child" onClick$={handleStartCreate$} />
            </div>
        </main>
    );
});
