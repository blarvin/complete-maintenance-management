/**
 * usePendingForms — Hook backing the FieldComposer batch.
 *
 * Thin Solid layer over the plain `pendingDraft` draft store (src/data/services):
 * the hook owns the in-memory `forms` signal + focus state and keeps the
 * localStorage draft current (write-through); the actual commit/discard logic
 * lives in the module so it can also run from useNodeCreation at node-create
 * time, with no mounted component involved.
 */

import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js';
import type { Definition, DataFieldValue } from '../data/models';
import {
    type PendingForm,
    pendingFormFromDefinition,
    loadPendingForms,
    savePendingForms,
    commitPendingDraft,
    discardPendingDraft,
} from '../data/services/pendingDraft';

// Re-exported so FieldComposer/FieldComposerSlot keep importing from the hook.
export { pendingFormFromDefinition };
export type { PendingForm };

export type UsePendingFormsOptions = {
    /** Mount-time constant by contract — the composer remounts per session. */
    nodeId: string;
    /**
     * Async loader for the initial batch (e.g. construction defaults, Undo restore).
     * Called from the hook's mount task only when localStorage has no draft for nodeId,
     * so a stored draft always wins over fresh defaults.
     */
    initialSeedLoader?: () => Promise<PendingForm[]>;
};

export type UsePendingFormsResult = {
    forms: Accessor<PendingForm[]>;
    /**
     * The id of the most recently user-toggled-on form. Composer uses this to
     * decide whether to auto-focus a row's value input on mount: only the row
     * the user just ticked should jump into edit mode. Seeded rows (construction
     * locks, Undo restore) leave it null so nothing steals focus on open.
     */
    lastToggledId: Accessor<string | null>;
    togglePending: (definition: Definition) => void;
    setPendingValue: (formId: string, value: DataFieldValue | null) => void;
    commitAll: (currentMaxCardOrder: number) => Promise<number>;
    discardAll: () => PendingForm[];
};

export function usePendingForms(options: UsePendingFormsOptions): UsePendingFormsResult {
    const [forms, setForms] = createSignal<PendingForm[]>([]);
    const [lastToggledId, setLastToggledId] = createSignal<string | null>(null);

    onMount(async () => {
        // onMount runs exactly once, so no `initialized` latch is needed;
        // a disposal guard covers the await instead.
        let disposed = false;
        onCleanup(() => { disposed = true; });

        const stored = loadPendingForms(options.nodeId);
        if (stored.length > 0) {
            setForms(stored);
        } else if (options.initialSeedLoader) {
            const seeded = await options.initialSeedLoader();
            if (disposed) return;
            if (seeded.length > 0) {
                setForms(seeded);
                // Persist the seed immediately so a construction commit reading
                // localStorage sees the locked defaults even with no edits.
                savePendingForms(options.nodeId, seeded);
            }
        }
    });

    const togglePending = (definition: Definition) => {
        const existing = forms().find(f => f.definitionId === definition.id);
        if (existing) {
            setForms(forms().filter(f => f.definitionId !== definition.id));
            if (lastToggledId() === existing.id) setLastToggledId(null);
        } else {
            const fresh = pendingFormFromDefinition(definition);
            setForms([...forms(), fresh]);
            setLastToggledId(fresh.id);
        }
        // Write-through: the draft must be current in localStorage the instant a
        // construction commit (useNodeCreation) reads it, not one reactive tick later.
        savePendingForms(options.nodeId, forms());
    };

    const setPendingValue = (formId: string, value: DataFieldValue | null) => {
        setForms(forms().map(f => f.id === formId ? { ...f, value } : f));
        savePendingForms(options.nodeId, forms()); // write-through (see togglePending)
    };

    const commitAll = async (currentMaxCardOrder: number): Promise<number> => {
        savePendingForms(options.nodeId, forms()); // flush latest in-memory state
        const n = await commitPendingDraft(options.nodeId, currentMaxCardOrder);
        setForms([]);
        return n;
    };

    const discardAll = (): PendingForm[] => {
        savePendingForms(options.nodeId, forms()); // flush so discard returns the latest rows
        const cleared = discardPendingDraft(options.nodeId);
        setForms([]);
        return cleared;
    };

    return {
        forms,
        lastToggledId,
        togglePending,
        setPendingValue,
        commitAll,
        discardAll,
    };
}
