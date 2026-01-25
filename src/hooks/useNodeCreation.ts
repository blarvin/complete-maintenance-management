/**
 * useNodeCreation - Hook for node creation flow.
 * Extracts the duplicate creation logic from RootView and BranchView.
 * 
 * Satisfies OCP: Views are now closed for modification when creation logic changes.
 * Satisfies SRP: Views only handle rendering, this hook handles creation orchestration.
 * Satisfies DIP: Uses service abstraction (can be swapped via setNodeService).
 * 
 * IMMEDIATE CREATION: Node is created in DB immediately when UC starts.
 * This allows FieldList to work identically for UC and display modes.
 */

import { $, type QRL } from '@builder.io/qwik';
import { useAppState, useAppTransitions } from '../state/appState';
import { getNodeService, getFieldService } from '../data/services';
import { generateId } from '../utils/id';
import { triggerSync } from './useSyncTrigger';
import { getSavedFieldsFromLocalStorage } from './usePendingForms';

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
     * Start creating a new node.
     * Generates an ID but does NOT create node in DB yet.
     * Node creation is deferred until user clicks "Create".
     * This eliminates orphan nodes if user cancels.
     */
    const start$ = $(async () => {
        const id = generateId();
        
        // DON'T create node in DB - defer until CREATE
        // Open UC UI (node won't appear in list until complete$)
        await startConstruction$({
            id,
            parentId: options.parentId,
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: [], // No longer used - TreeNodeConstruction handles defaults
        });
    });

    /**
     * Cancel node creation. Closes the under-construction UI.
     * Clears localStorage for pending forms (no IDB cleanup needed since nothing was written).
     */
    const cancel$ = $(async () => {
        const ucData = appState.underConstruction;
        if (ucData) {
            // Clear localStorage (no IDB cleanup needed)
            localStorage.removeItem(`pendingFields:${ucData.id}`);
        }
        await cancelConstruction$();
    });

    /**
     * Complete node creation. Creates node + all saved fields atomically.
     * All fields marked as "saved" during construction are created together with the node.
     */
    const complete$ = $(async (payload: CreateNodePayload) => {
        console.log('[complete$] Received payload:', JSON.stringify(payload));

        const ucData = appState.underConstruction;
        console.log('[complete$] ucData:', ucData);
        if (!ucData) {
            console.log('[complete$] No ucData, returning early!');
            return;
        }

        // Get all saved fields from localStorage
        const savedFields = getSavedFieldsFromLocalStorage(ucData.id);
        console.log('[complete$] Saved fields from localStorage:', savedFields.length);

        // Create node + all fields atomically
        await getNodeService().createWithFields({
            id: ucData.id,
            parentId: ucData.parentId,
            nodeName: payload.nodeName || 'Untitled',
            nodeSubtitle: payload.nodeSubtitle || '',
            defaults: savedFields.map(f => ({
                fieldName: f.fieldName,
                fieldValue: f.fieldValue,
            })),
        });

        console.log('[complete$] Node and fields created atomically');

        // Clear localStorage
        localStorage.removeItem(`pendingFields:${ucData.id}`);

        triggerSync();
        await completeConstruction$();
        console.log('[complete$] completeConstruction$ done, calling onCreated$');
        await options.onCreated$();
        console.log('[complete$] onCreated$ done, complete$ finished');
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
