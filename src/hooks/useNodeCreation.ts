/**
 * useNodeCreation - Hook for node creation flow.
 * Extracts the duplicate creation logic from RootView and BranchView.
 *
 * Satisfies OCP: Views are now closed for modification when creation logic changes.
 * Satisfies SRP: Views only handle rendering, this hook handles creation orchestration.
 * Satisfies DIP: Uses CommandBus abstraction for writes.
 *
 * `parentId` arrives as an accessor and is read at `start()` time: BranchView
 * keeps one hook instance across navigation, so a mount-time capture would go
 * stale and parent the new node under the view we left.
 */

import type { Accessor } from 'solid-js';
import { useAppState, useAppTransitions } from '../state/appState';
import { getCommandBus } from '../data/commands';
import { commitPendingDraft, discardPendingDraft } from '../data/services/pendingDraft';
import { generateId } from '../utils/id';
import type { Kind } from '../data/models';
import type { UnderConstructionData } from '../state/appState.types';

/**
 * Payload for completing node creation.
 * Matches what TreeNodeConstruction emits via onCreate.
 *
 * Fields are created from the composer draft (localStorage, keyed by nodeId):
 * complete() commits the draft against the new node right after it exists.
 */
export type CreateNodePayload = {
    name: string;
    subtitle: string;
};

export type UseNodeCreationResult = {
    /** The under-construction node data, or null if not creating. */
    ucNode: Accessor<UnderConstructionData>;
    start: (kind?: Kind) => void;
    cancel: () => void;
    complete: (payload: CreateNodePayload) => Promise<void>;
};

/**
 * Hook that provides node creation flow management.
 *
 * No reload callback: CREATE_ELEMENT emits on the storage event bus and the
 * views' data hooks reload themselves (see useElementChildren).
 *
 * Usage:
 * ```tsx
 * const { ucNode, start, cancel, complete } = useNodeCreation(() => props.parentId);
 * ```
 */
export function useNodeCreation(parentId: Accessor<string | null>): UseNodeCreationResult {
    const appState = useAppState();
    const { startConstruction, cancelConstruction, completeConstruction } = useAppTransitions();

    /**
     * Start creating a new node.
     * Generates an ID but does NOT create node in DB yet.
     * Node creation is deferred until user clicks "Create".
     * This eliminates orphan nodes if user cancels.
     */
    const start = (kind: Kind = 'node') => {
        const id = generateId();

        // DON'T create node in DB - defer until CREATE
        // Open UC UI (node won't appear in list until complete()).
        // `kind` comes from the create-surface picker (re-root kinds); defaults to node.
        startConstruction({
            id,
            parentId: parentId(),
            kind,
            name: '',
            subtitle: '',
        });
    };

    /**
     * Cancel node creation. Closes the under-construction UI.
     * Clears localStorage for pending forms (no IDB cleanup needed since nothing was written).
     */
    const cancel = () => {
        const ucData = appState.underConstruction;
        if (ucData) {
            // Clear any pending composer draft for this nodeId.
            discardPendingDraft(ucData.id);
        }
        cancelConstruction();
    };

    /**
     * Complete node creation. Creates node + all saved fields atomically.
     * All fields marked as "saved" during construction are created together with the node.
     */
    const complete = async (payload: CreateNodePayload) => {
        const ucData = appState.underConstruction;
        if (!ucData) return;

        const bus = getCommandBus();
        await bus.execute({
            type: 'CREATE_ELEMENT',
            payload: {
                id: ucData.id,
                kind: ucData.kind,
                parentId: ucData.parentId,
                name: payload.name || 'Untitled',
                subtitle: payload.subtitle || null,
            },
        });

        // Commit the in-flight composer draft (localStorage, keyed by nodeId)
        // against the freshly-created node. -1 so the first field lands at
        // siblingOrder 0. Clears the draft internally.
        await commitPendingDraft(ucData.id, -1);

        completeConstruction();
    };

    return {
        ucNode: () => appState.underConstruction,
        start,
        cancel,
        complete,
    };
}
