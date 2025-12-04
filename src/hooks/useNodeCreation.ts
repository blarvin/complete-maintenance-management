/**
 * useNodeCreation - Hook for node creation flow.
 * Extracts the duplicate creation logic from RootView and BranchView.
 * 
 * Satisfies OCP: Views are now closed for modification when creation logic changes.
 * Satisfies SRP: Views only handle rendering, this hook handles creation orchestration.
 * Satisfies DIP: Uses service abstraction (can be swapped via setNodeService).
 */

import { $, type QRL } from '@builder.io/qwik';
import { useAppState, useAppTransitions } from '../state/appState';
import { getNodeService } from '../data/services';
import { generateId } from '../utils/id';
import { DEFAULT_DATAFIELD_NAMES } from '../constants';

/**
 * Payload for completing node creation.
 * Matches what TreeNodeConstruction emits via onCreate$.
 */
export type CreateNodePayload = {
    nodeName: string;
    nodeSubtitle: string;
    fields: { fieldName: string; fieldValue: string | null }[];
};

export type UseNodeCreationOptions = {
    /** Parent ID for the new node. null = root node. */
    parentId: string | null;
    /** Called after node is successfully created. Typically reloads the node list. */
    onCreated$: QRL<() => void | Promise<void>>;
};

/**
 * Hook that provides node creation flow management.
 * 
 * Usage:
 * ```tsx
 * const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
 *     parentId: null, // or props.parentId for children
 *     onCreated$: loadNodes$,
 * });
 * ```
 */
export function useNodeCreation(options: UseNodeCreationOptions) {
    const appState = useAppState();
    const { startConstruction$, cancelConstruction$, completeConstruction$ } = useAppTransitions();

    /**
     * Start creating a new node. Opens the under-construction UI.
     */
    const start$ = $(() => {
        startConstruction$({
            id: generateId(),
            parentId: options.parentId,
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: DEFAULT_DATAFIELD_NAMES.map((name) => ({
                fieldName: name,
                fieldValue: null,
            })),
        });
    });

    /**
     * Cancel node creation. Closes the under-construction UI without saving.
     */
    const cancel$ = $(() => {
        cancelConstruction$();
    });

    /**
     * Complete node creation. Saves the node and its default fields.
     */
    const complete$ = $(async (payload: CreateNodePayload) => {
        const ucData = appState.underConstruction;
        if (!ucData) return;

        await getNodeService().createWithFields({
            id: ucData.id,
            parentId: options.parentId,
            nodeName: payload.nodeName,
            nodeSubtitle: payload.nodeSubtitle,
            defaults: payload.fields,
        });

        completeConstruction$();
        await options.onCreated$();
    });

    return {
        /** The under-construction node data, or null if not creating. */
        ucNode: appState.underConstruction,
        /** Start creating a new node. */
        start$,
        /** Cancel node creation. */
        cancel$,
        /** Complete node creation with the given payload. */
        complete$,
    };
}

