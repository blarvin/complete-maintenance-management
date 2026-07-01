/**
 * usePendingForms — Hook backing the FieldComposer batch.
 *
 * Thin Qwik layer over the plain `pendingDraft` draft store (src/data/services):
 * the hook owns the in-memory `forms` signal + focus state and keeps the
 * localStorage draft current (write-through); the actual commit/discard logic
 * lives in the module so it can also run from useNodeCreation at node-create
 * time, with no mounted component involved.
 */

import { useSignal, useVisibleTask$, $, type Signal } from '@builder.io/qwik';
import type { Definition, DataFieldValue } from '../data/models';
import {
    type PendingForm,
    pendingFormFromDefinition,
    loadPendingForms,
    savePendingForms,
    commitPendingDraft,
    discardPendingDraft,
} from '../data/services/pendingDraft';
import type { QRL } from '@builder.io/qwik';

// Re-exported so FieldComposer/FieldComposerSlot keep importing from the hook.
export { pendingFormFromDefinition };
export type { PendingForm };

export type UsePendingFormsOptions = {
    nodeId: string;
    /**
     * Async loader for the initial batch (e.g. construction defaults, Undo restore).
     * Called from the hook's mount task only when localStorage has no draft for nodeId,
     * so a stored draft always wins over fresh defaults.
     */
    initialSeedLoader$?: QRL<() => Promise<PendingForm[]>>;
};

export type UsePendingFormsResult = {
    forms: Signal<PendingForm[]>;
    /**
     * The id of the most recently user-toggled-on form. Composer uses this to
     * decide whether to auto-focus a row's value input on mount: only the row
     * the user just ticked should jump into edit mode. Seeded rows (construction
     * locks, Undo restore) leave it null so nothing steals focus on open.
     */
    lastToggledId: Signal<string | null>;
    togglePending$: ReturnType<typeof $<(definition: Definition) => void>>;
    setPendingValue$: ReturnType<typeof $<(formId: string, value: DataFieldValue | null) => void>>;
    commitAll$: ReturnType<typeof $<(currentMaxCardOrder: number) => Promise<number>>>;
    discardAll$: ReturnType<typeof $<() => PendingForm[]>>;
};

export function usePendingForms(options: UsePendingFormsOptions): UsePendingFormsResult {
    const forms = useSignal<PendingForm[]>([]);
    const lastToggledId = useSignal<string | null>(null);
    const initialized = useSignal(false);

    useVisibleTask$(async () => {
        if (initialized.value) return;
        const stored = loadPendingForms(options.nodeId);
        if (stored.length > 0) {
            forms.value = stored;
        } else if (options.initialSeedLoader$) {
            const seeded = await options.initialSeedLoader$();
            if (seeded.length > 0) {
                forms.value = seeded;
                // Persist the seed immediately so a construction commit reading
                // localStorage sees the locked defaults even with no edits.
                savePendingForms(options.nodeId, seeded);
            }
        }
        initialized.value = true;
    });

    const togglePending$ = $((definition: Definition) => {
        const existing = forms.value.find(f => f.definitionId === definition.id);
        if (existing) {
            forms.value = forms.value.filter(f => f.definitionId !== definition.id);
            if (lastToggledId.value === existing.id) lastToggledId.value = null;
        } else {
            const fresh = pendingFormFromDefinition(definition);
            forms.value = [...forms.value, fresh];
            lastToggledId.value = fresh.id;
        }
        // Write-through: the draft must be current in localStorage the instant a
        // construction commit (useNodeCreation) reads it, not one reactive tick later.
        savePendingForms(options.nodeId, forms.value);
    });

    const setPendingValue$ = $((formId: string, value: DataFieldValue | null) => {
        forms.value = forms.value.map(f => f.id === formId ? { ...f, value } : f);
        savePendingForms(options.nodeId, forms.value); // write-through (see togglePending$)
    });

    const commitAll$ = $(async (currentMaxCardOrder: number): Promise<number> => {
        savePendingForms(options.nodeId, forms.value); // flush latest in-memory state
        const n = await commitPendingDraft(options.nodeId, currentMaxCardOrder);
        forms.value = [];
        return n;
    });

    const discardAll$ = $((): PendingForm[] => {
        savePendingForms(options.nodeId, forms.value); // flush so discard returns the latest rows
        const cleared = discardPendingDraft(options.nodeId);
        forms.value = [];
        return cleared;
    });

    return {
        forms,
        lastToggledId,
        togglePending$,
        setPendingValue$,
        commitAll$,
        discardAll$,
    };
}
