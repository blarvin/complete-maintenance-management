/**
 * usePendingForms - Hook for managing pending DataField forms with localStorage persistence.
 *
 * A pending form represents a user-chosen Template that hasn't yet been turned into a
 * persisted DataField. In display mode, picking a template flushes through
 * ADD_FIELD_FROM_TEMPLATE immediately. In construction mode (new node), the pick is
 * held in localStorage until the user clicks Create, which creates the node + fields
 * atomically via CREATE_NODE_WITH_FIELDS.
 *
 * Phase 1 ships with an empty templates table (no seeding), so pending forms will
 * typically be empty until the follow-up SPEC templates plan lands.
 */

import { useSignal, useVisibleTask$, useTask$, $, type QRL, type Signal } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';

/** Pending form state for localStorage */
export type PendingForm = {
    id: string;
    templateId: string;
    /** Snapshot of template label at selection time, for display */
    templateLabel: string;
    cardOrder: number;
    saved?: boolean; // Marks forms "locked in" during construction mode
};

/** LS key for pending forms */
const getPendingFormsKey = (nodeId: string) => `pendingFields:${nodeId}`;

/** Load pending forms from localStorage */
const loadPendingForms = (nodeId: string): PendingForm[] => {
    try {
        const stored = localStorage.getItem(getPendingFormsKey(nodeId));
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/** Save pending forms to localStorage */
const savePendingForms = (nodeId: string, forms: PendingForm[]) => {
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
 * Extract saved pending forms from localStorage for batch creation.
 * Used by useNodeCreation.complete$() to get all forms marked as saved during construction.
 */
export function getSavedFieldsFromLocalStorage(nodeId: string): PendingForm[] {
    const forms = loadPendingForms(nodeId);
    return forms
        .filter(f => f.saved === true && f.templateId)
        .sort((a, b) => a.cardOrder - b.cardOrder);
}

export type UsePendingFormsOptions = {
    nodeId: string;
    /** Mode: 'construction' = defer IDB writes, 'display' = write immediately */
    mode: 'construction' | 'display';
    /** Called after a form is successfully saved to DB. Typically reloads the field list. */
    onSaved$: QRL<() => void | Promise<void>>;
    /** Signal containing current max cardOrder from persisted fields (for calculating next cardOrder) */
    maxPersistedCardOrder$: Signal<number>;
};

export function usePendingForms(options: UsePendingFormsOptions) {
    const forms = useSignal<PendingForm[]>([]);
    const initialized = useSignal(false);

    // Load pending forms from LS on mount
    useVisibleTask$(({ track }) => {
        track(() => options.maxPersistedCardOrder$.value);

        if (initialized.value) return;

        const stored = loadPendingForms(options.nodeId);
        forms.value = stored;
        initialized.value = true;
    });

    // Save pending forms to LS when they change
    useTask$(({ track }) => {
        const currentForms = track(() => forms.value);
        if (typeof localStorage !== 'undefined') {
            savePendingForms(options.nodeId, currentForms);
        }
    });

    /**
     * Add a new empty pending form slot (user hasn't picked a template yet).
     * Returns the new form's ID so the UI can focus its picker.
     */
    const add$ = $(async () => {
        const maxPersisted = options.maxPersistedCardOrder$.value;
        const maxPending = forms.value.length > 0
            ? Math.max(...forms.value.map(f => f.cardOrder))
            : -1;
        const nextOrder = Math.max(maxPersisted, maxPending) + 1;

        const newForm: PendingForm = {
            id: generateId(),
            templateId: '',
            templateLabel: '',
            cardOrder: nextOrder,
        };
        forms.value = [...forms.value, newForm];
    });

    /**
     * Save a pending form — user picked a template.
     * In construction mode, locks it in localStorage. In display mode, writes to IDB immediately.
     */
    const save$ = $(async (formId: string, templateId: string, templateLabel: string) => {
        if (!templateId) {
            // No template picked - cancel the form
            const base = options.maxPersistedCardOrder$.value + 1;
            forms.value = forms.value
                .filter(f => f.id !== formId)
                .map((f, i) => ({ ...f, cardOrder: base + i }));
            return;
        }

        const form = forms.value.find(f => f.id === formId);
        const cardOrder = form?.cardOrder;

        if (options.mode === 'construction') {
            forms.value = forms.value.map(f =>
                f.id === formId
                    ? { ...f, templateId, templateLabel, saved: true }
                    : f
            );
            return;
        }

        await getCommandBus().execute({
            type: 'ADD_FIELD_FROM_TEMPLATE',
            payload: { nodeId: options.nodeId, templateId, cardOrder },
        });
        forms.value = forms.value.filter(f => f.id !== formId);
        await options.onSaved$();
    });

    /**
     * Cancel a pending form without saving.
     */
    const cancel$ = $((formId: string) => {
        const base = options.maxPersistedCardOrder$.value + 1;
        forms.value = forms.value
            .filter(f => f.id !== formId)
            .map((f, i) => ({ ...f, cardOrder: base + i }));
    });

    /**
     * Update the template selection in a pending form (for LS tracking).
     */
    const change$ = $((formId: string, templateId: string, templateLabel: string) => {
        forms.value = forms.value.map(f =>
            f.id === formId ? { ...f, templateId, templateLabel } : f
        );
    });

    /**
     * Save all pending forms that have a template selected.
     * In construction mode: marks as saved. In display mode: writes to IDB.
     * Returns the number of forms saved.
     */
    const saveAllPending$ = $(async (): Promise<number> => {
        const formsToSave = forms.value.filter(f => f.templateId);
        if (formsToSave.length === 0) return 0;

        if (options.mode === 'construction') {
            forms.value = forms.value.map(f =>
                f.templateId
                    ? { ...f, saved: true }
                    : f
            );
            return formsToSave.length;
        }

        const commandBus = getCommandBus();
        await Promise.all(
            formsToSave.map(f =>
                commandBus.execute({
                    type: 'ADD_FIELD_FROM_TEMPLATE',
                    payload: { nodeId: options.nodeId, templateId: f.templateId, cardOrder: f.cardOrder },
                })
            )
        );

        forms.value = [];
        await options.onSaved$();

        return formsToSave.length;
    });

    return {
        forms,
        add$,
        save$,
        cancel$,
        change$,
        saveAllPending$,
    };
}
