/**
 * pendingDraft — Plain (no-Qwik) draft store for the FieldComposer batch.
 *
 * A pending form is a FieldDefinition the user has checked in the composer plus
 * an in-flight (not yet persisted) value. The batch lives in localStorage keyed
 * by nodeId so picking a few FieldDefinitions, navigating away, and coming back
 * keeps the draft.
 *
 * Because the draft is fully external (localStorage), committing it needs nothing
 * from the mounted composer component: read the rows, create a DataField per row
 * via the command bus, clear the draft. commitPendingDraft/discardPendingDraft are
 * the single source for that, called both by usePendingForms (display-mode
 * Save/Cancel) and useNodeCreation (construction-time commit on node create).
 */

import { getCommandBus } from '../commands';
import type { FieldDefinition, DataFieldValue, ComponentType } from '../models';
import { generateId } from '../../utils/id';

/** A pending (un-persisted) FieldDefinition instance with its in-progress value. */
export type PendingForm = {
    id: string;
    fieldDefinitionId: string;
    componentType: ComponentType;
    fieldName: string;
    value: DataFieldValue | null;
};

/** Build a fresh PendingForm from a FieldDefinition. Used by composer toggle and seed loaders. */
export const pendingFormFromFieldDefinition = (definition: FieldDefinition): PendingForm => ({
    id: generateId(),
    fieldDefinitionId: definition.id,
    componentType: definition.componentType,
    fieldName: definition.label,
    value: null,
});

export const getPendingFormsKey = (nodeId: string) => `pendingFields:${nodeId}`;

export const loadPendingForms = (nodeId: string): PendingForm[] => {
    try {
        const stored = localStorage.getItem(getPendingFormsKey(nodeId));
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (f): f is PendingForm =>
                f && typeof f === 'object' &&
                typeof f.id === 'string' &&
                typeof f.fieldDefinitionId === 'string' &&
                typeof f.componentType === 'string' &&
                typeof f.fieldName === 'string'
        );
    } catch {
        return [];
    }
};

export const savePendingForms = (nodeId: string, forms: PendingForm[]) => {
    try {
        if (forms.length === 0) {
            localStorage.removeItem(getPendingFormsKey(nodeId));
        } else {
            localStorage.setItem(getPendingFormsKey(nodeId), JSON.stringify(forms));
        }
    } catch {
        // Ignore storage errors
    }
};

/** Remove any draft for nodeId. */
export const clearPendingDraft = (nodeId: string): void => {
    savePendingForms(nodeId, []); // empty array removes the key
};

/**
 * Read the draft for nodeId, create a DataField per row via the command bus,
 * then clear the draft. Returns the number of fields created.
 *
 * baseOrder is the max cardOrder among already-persisted fields; the first new
 * field lands at baseOrder + 1. Pass -1 for a brand-new node so its first field
 * starts at siblingOrder 0.
 */
export const commitPendingDraft = async (nodeId: string, baseOrder: number): Promise<number> => {
    // Drop malformed entries (e.g. legacy localStorage drafts from the old
    // pre-composer shape that lack fieldDefinitionId/fieldName).
    const batch = loadPendingForms(nodeId).filter(
        f => f && f.fieldDefinitionId && typeof f.fieldName === 'string'
    );
    if (batch.length === 0) {
        clearPendingDraft(nodeId);
        return 0;
    }

    const commandBus = getCommandBus();
    for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const cardOrder = baseOrder + i + 1;
        // Pass initialValue through so creation writes a single history row
        // carrying the user-entered value, instead of a null create followed
        // by an update (which produced an "Empty" history row).
        await commandBus.execute({
            type: 'CREATE_ELEMENT_FROM_DEFINITION',
            payload: {
                parentId: nodeId,
                fieldDefinitionId: row.fieldDefinitionId,
                siblingOrder: cardOrder,
                initialValue: row.value ?? null,
            },
        });
    }

    clearPendingDraft(nodeId);
    return batch.length;
};

/** Discard the draft for nodeId and return the rows that were cleared (for Undo restore). */
export const discardPendingDraft = (nodeId: string): PendingForm[] => {
    const rows = loadPendingForms(nodeId);
    clearPendingDraft(nodeId);
    return rows;
};
