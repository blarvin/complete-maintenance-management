/**
 * pendingDraft — Framework-free draft store for the FieldComposer batch.
 *
 * A pending form is a Definition the user has checked in the composer plus
 * an in-flight (not yet persisted) value. The batch lives in localStorage keyed
 * by nodeId so picking a few Definitions, navigating away, and coming back
 * keeps the draft.
 *
 * Because the draft is fully external (localStorage), the whole lifecycle needs
 * nothing from a mounted picker component: seed the rows, read them, create a
 * DataField per row via the command bus, clear the draft. seed/commit/discard
 * here are the single source for that, called both by usePendingForms
 * (display-mode Save/Cancel) and useNodeCreation (construction-time seed on
 * start, commit on node create).
 */

import { getCommandBus } from '../commands';
import { getDefinitionQueries } from '../queries';
import type { Definition, DataFieldValue, Kind } from '../models';
import { generateId } from '../../utils/id';

/** A pending (un-persisted) Definition instance with its in-progress value. */
export type PendingForm = {
    id: string;
    definitionId: string;
    kind: Kind;
    fieldName: string;
    value: DataFieldValue | null;
};

/** Build a fresh PendingForm from a Definition. Used by composer toggle and seed loaders. */
export const pendingFormFromDefinition = (definition: Definition): PendingForm => ({
    id: generateId(),
    definitionId: definition.id,
    kind: definition.kind,
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
                typeof f.definitionId === 'string' &&
                typeof f.kind === 'string' &&
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

/**
 * Ensure a draft exists for nodeId, seeded from `definitionIds` if it doesn't.
 * Idempotent and stored-draft-wins, so it is safe to call from more than one
 * place: node creation calls it so the construction defaults land whether or
 * not a picker was ever mounted, and the composer calls it on mount for the
 * same rows. Returns the resulting draft.
 */
export const seedPendingDraft = async (
    nodeId: string,
    definitionIds: readonly string[]
): Promise<PendingForm[]> => {
    const existing = loadPendingForms(nodeId);
    if (existing.length > 0) return existing;

    const fdq = getDefinitionQueries();
    const seeded: PendingForm[] = [];
    for (const id of definitionIds) {
        const def = await fdq.getDefinitionById(id);
        if (def) seeded.push(pendingFormFromDefinition(def));
    }
    if (seeded.length > 0) savePendingForms(nodeId, seeded);
    return seeded;
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
    // pre-composer shape that lack definitionId/fieldName).
    const batch = loadPendingForms(nodeId).filter(
        f => f && f.definitionId && typeof f.fieldName === 'string'
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
                definitionId: row.definitionId,
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
