/**
 * Shared hook for node creation flow.
 * Used by both RootView and BranchView to manage under-construction state.
 */

import { useSignal, $, PropFunction } from '@builder.io/qwik';
import { generateId } from '../utils/id';
import { DEFAULT_DATAFIELD_NAMES } from '../data/fieldLibrary';
import { createNodeWithDefaultFields } from '../data/services/createNode';

export type UnderConstructionNode = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    defaultFields: { fieldName: string; fieldValue: string | null }[];
};

export type CreatePayload = {
    nodeName: string;
    nodeSubtitle: string;
    fields: { fieldName: string; fieldValue: string | null }[];
};

export type UseNodeCreationOptions = {
    parentId: string | null;  // null = creating root nodes
    onCreated$: PropFunction<() => void>;  // Called after successful creation
};

export function useNodeCreation(options: UseNodeCreationOptions) {
    const ucNode = useSignal<UnderConstructionNode | null>(null);

    const startCreate$ = $(() => {
        if (ucNode.value) return;  // Already creating
        ucNode.value = {
            id: generateId(),
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: DEFAULT_DATAFIELD_NAMES.map((n) => ({
                fieldName: n,
                fieldValue: null,
            })),
        };
    });

    const cancelCreate$ = $(() => {
        ucNode.value = null;
    });

    const completeCreate$ = $(async (payload: CreatePayload) => {
        if (!ucNode.value) return;

        const id = ucNode.value.id;
        await createNodeWithDefaultFields({
            id,
            parentId: options.parentId,
            nodeName: payload.nodeName,
            nodeSubtitle: payload.nodeSubtitle,
            defaults: payload.fields,
        });

        ucNode.value = null;
        await options.onCreated$();
    });

    const resetCreate$ = $(() => {
        ucNode.value = null;
    });

    return {
        ucNode,
        startCreate$,
        cancelCreate$,
        completeCreate$,
        resetCreate$,  // Useful for resetting when parentId changes
    };
}
