/**
 * useNodeCreation - Hook for node creation flow.
 * Extracts the duplicate creation logic from RootView and BranchView.
 * 
 * Satisfies OCP: Views are now closed for modification when creation logic changes.
 * Satisfies SRP: Views only handle rendering, this hook handles creation orchestration.
 * Satisfies DIP: Uses CommandBus abstraction for writes.
 * 
 * IMMEDIATE CREATION: Node is created in DB immediately when UC starts.
 * This allows FieldList to work identically for UC and display modes.
 */

import { $, type QRL } from '@builder.io/qwik';
import { useAppState, useAppTransitions } from '../state/appState';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';

/**
 * Payload for completing node creation.
 * Matches what TreeNodeConstruction emits via onCreate$.
 *
 * Fields are now created by FieldComposer/commitAllComposer$ — the optional
 * afterNodeCreated$ callback runs after the empty node exists so callers can
 * commit any in-flight composer batch before the construction UI unmounts.
 */
export type CreateNodePayload = {
    nodeName: string;
    nodeSubtitle: string;
    /** Optional async hook fired after the node is persisted, before FSM transitions out. */
    afterNodeCreated$?: QRL<(nodeId: string) => void | Promise<void>>;
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
            // Clear any pending composer draft for this nodeId.
            try { localStorage.removeItem(`pendingFields:${ucData.id}`); } catch { /* ignore */ }
        }
        await cancelConstruction$();
    });

    /**
     * Complete node creation. Creates node + all saved fields atomically.
     * All fields marked as "saved" during construction are created together with the node.
     */
    const complete$ = $(async (payload: CreateNodePayload) => {
        const ucData = appState.underConstruction;
        if (!ucData) return;

        // Create empty node first; FieldComposer (via afterNodeCreated$) commits its batch.
        await getCommandBus().execute({
            type: 'CREATE_NODE_WITH_FIELDS',
            payload: {
                id: ucData.id,
                parentId: ucData.parentId,
                nodeName: payload.nodeName || 'Untitled',
                nodeSubtitle: payload.nodeSubtitle || '',
                defaults: [],
            },
        });

        if (payload.afterNodeCreated$) {
            await payload.afterNodeCreated$(ucData.id);
        }

        try { localStorage.removeItem(`pendingFields:${ucData.id}`); } catch { /* ignore */ }

        await completeConstruction$();
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
