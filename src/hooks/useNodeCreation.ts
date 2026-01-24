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
     * IMMEDIATELY creates an empty node in the database, then opens UC UI.
     * This allows FieldList to work identically for UC and display modes.
     * 
     * Note: We don't reload the nodes list here. The node exists in DB (so FieldList works),
     * but it only appears in the visual list after complete$(). This avoids dual-rendering
     * where both the UC TreeNode and the list TreeNode would show.
     */
    const start$ = $(async () => {
        const id = generateId();
        
        // Create empty node in DB immediately
        await getNodeService().createEmptyNode(id, options.parentId);
        
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
     * Note: The orphan node remains in DB (cleanup deferred to Phase 2).
     */
    const cancel$ = $(async () => {
        await cancelConstruction$();
    });

    /**
     * Complete node creation. Updates the node name/subtitle and saves fields.
     * The node already exists in DB (created in start$).
     */
    const complete$ = $(async (payload: CreateNodePayload) => {
        console.log('[complete$] Received payload:', JSON.stringify(payload));

        const ucData = appState.underConstruction;
        console.log('[complete$] ucData:', ucData);
        if (!ucData) {
            console.log('[complete$] No ucData, returning early!');
            return;
        }

        console.log('[complete$] Updating node', ucData.id, 'with:', {
            nodeName: payload.nodeName || 'Untitled',
            nodeSubtitle: payload.nodeSubtitle || '',
        });

        // Update node with final name/subtitle
        await getNodeService().updateNode(ucData.id, {
            nodeName: payload.nodeName || 'Untitled',
            nodeSubtitle: payload.nodeSubtitle || '',
        });

        console.log('[complete$] Node updated, calling completeConstruction$');

        // Create fields from TreeNodeConstruction's local state
        // (In Step 3, FieldList will handle this, and payload.fields will be empty)
        if (payload.fields.length > 0) {
            const fieldService = getFieldService();
            await Promise.all(
                payload.fields.map(f => fieldService.addField(ucData.id, f.fieldName, f.fieldValue))
            );
        }

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
