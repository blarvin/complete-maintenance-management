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
import { commitPendingDraft, discardPendingDraft, seedPendingDraft } from '../data/services/pendingDraft';
import { constructionDefaults } from '../data/packs/activePack';
import { getSnackbarService } from '../services/snackbar';
import { generateId } from '../utils/id';
import type { Kind } from '../data/models';
import type { UnderConstructionData } from '../state/appState.types';

/**
 * Payload for completing node creation.
 * Matches what TreeNodeConstruction emits via onCreate.
 *
 * Fields are created from the pending draft (localStorage, keyed by nodeId):
 * complete() seeds the construction defaults into it, then commits it against
 * the new node right after it exists.
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

        try {
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

            // The construction defaults are a node-creation policy, not a side
            // effect of rendering a picker: seed them here so a new node is born
            // with them even when every add-field surface is switched off
            // (ENABLED_ADD_FIELD_SURFACES). Which Definitions those are is pack
            // data, resolved at call time. Stored-draft-wins, so when a surface
            // *is* mounted it has already seeded the same rows and this is a no-op.
            const { missingIds } = await seedPendingDraft(ucData.id, constructionDefaults());

            // Commit the in-flight draft (localStorage, keyed by nodeId) against the
            // freshly-created node. -1 so the first field lands at siblingOrder 0.
            // Clears the draft internally.
            await commitPendingDraft(ucData.id, -1);

            // A default that didn't resolve is a field the node should have and
            // doesn't — the commit above clears the draft, so nothing will retry it.
            // Report the loss rather than lose it silently; no retry machinery in
            // Phase 1 (the node itself was created either way).
            if (missingIds.length > 0) {
                getSnackbarService().show({
                    variant: 'error',
                    message: `${missingIds.length} default field(s) couldn't be added — Library unavailable`,
                });
            }

            completeConstruction();
        } catch (err) {
            // Nothing above was reporting: this is an async handler the caller
            // used to drop on the floor, so a Create dispatched before the bus
            // existed became an uncaught rejection and a silently lost node.
            // `completeConstruction()` is deliberately skipped — the card stays
            // open with everything the user typed, so retrying is one tap.
            getSnackbarService().show({
                variant: 'error',
                message: err instanceof Error ? err.message : 'Could not create the asset',
            });
        }
    };

    return {
        ucNode: () => appState.underConstruction,
        start,
        cancel,
        complete,
    };
}
