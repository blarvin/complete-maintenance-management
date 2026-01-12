/**
 * usePendingForms - Hook for managing pending DataField forms with localStorage persistence.
 * 
 * Extracted from TreeNodeDisplay to enable reuse and testing.
 * Pending forms are field creation forms that haven't been saved to the database yet.
 * They persist to localStorage so users don't lose work on navigation/refresh.
 * 
 * Now includes cardOrder for proper field ordering.
 */

import { useSignal, useVisibleTask$, useTask$, $, type QRL, type Signal } from '@builder.io/qwik';
import { getFieldService } from '../data/services';
import { generateId } from '../utils/id';

/** Pending form state for localStorage */
export type PendingForm = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
    cardOrder: number;
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

export type UsePendingFormsOptions = {
    nodeId: string;
    /** Called after a form is successfully saved to DB. Typically reloads the field list. */
    onSaved$: QRL<() => void | Promise<void>>;
    /** Default field names to initialize with if no persisted fields and no LS forms */
    initialFieldNames?: readonly string[];
    /** Signal containing current max cardOrder from persisted fields (for calculating next cardOrder) */
    maxPersistedCardOrder$: Signal<number>;
};

/**
 * Hook that manages pending DataField forms.
 *
 * Usage:
 * ```tsx
 * const maxOrder = useComputed$(() => fields.value?.length ? Math.max(...fields.value.map(f => f.cardOrder)) : -1);
 * const { forms, add$, save$, cancel$, change$ } = usePendingForms({
 *     nodeId: props.id,
 *     onSaved$: reload$,
 *     maxPersistedCardOrder$: maxOrder,
 * });
 * ```
 */
export function usePendingForms(options: UsePendingFormsOptions) {
    const forms = useSignal<PendingForm[]>([]);
    const initialized = useSignal(false);

    // Load pending forms from LS on mount, or initialize with defaults
    useVisibleTask$(({ track }) => {
        // Track maxPersistedCardOrder signal to re-check initialization when fields load
        const maxPersisted = track(() => options.maxPersistedCardOrder$.value);

        if (initialized.value) return;

        const stored = loadPendingForms(options.nodeId);
        if (stored.length > 0) {
            // Migrate old forms without cardOrder
            const migrated = stored.map((f, i) => ({
                ...f,
                cardOrder: f.cardOrder ?? (maxPersisted + 1 + i),
            }));
            forms.value = migrated;
            initialized.value = true;
        } else if (options.initialFieldNames && options.initialFieldNames.length > 0 && maxPersisted < 0) {
            // No persisted fields and no LS forms - initialize with defaults
            const defaults: PendingForm[] = options.initialFieldNames.map((name, i) => ({
                id: generateId(),
                fieldName: name,
                fieldValue: null,
                cardOrder: i,
            }));
            forms.value = defaults;
            initialized.value = true;
        } else {
            initialized.value = true;
        }
    });

    // Save pending forms to LS when they change
    useTask$(({ track }) => {
        const currentForms = track(() => forms.value);
        // Only save to LS on client side
        if (typeof localStorage !== 'undefined') {
            savePendingForms(options.nodeId, currentForms);
        }
    });

    /**
     * Add a new empty pending form with next available cardOrder.
     */
    const add$ = $(async () => {
        // Calculate next cardOrder from both persisted and pending
        // Read current value from signal to get up-to-date max
        const maxPersisted = options.maxPersistedCardOrder$.value;
        const maxPending = forms.value.length > 0
            ? Math.max(...forms.value.map(f => f.cardOrder))
            : -1;
        const nextOrder = Math.max(maxPersisted, maxPending) + 1;

        const newForm: PendingForm = {
            id: generateId(),
            fieldName: '',
            fieldValue: null,
            cardOrder: nextOrder,
        };
        forms.value = [...forms.value, newForm];
    });

    /**
     * Save a pending form to the database.
     * If fieldName is empty, the form is cancelled instead.
     */
    const save$ = $(async (formId: string, fieldName: string, fieldValue: string | null) => {
        const name = fieldName.trim();
        if (!name) {
            // Empty name - just cancel the form
            forms.value = forms.value.filter(f => f.id !== formId);
            return;
        }
        // Get the cardOrder for this form
        const form = forms.value.find(f => f.id === formId);
        const cardOrder = form?.cardOrder;
        
        // Persist to DB with cardOrder
        await getFieldService().addField(options.nodeId, name, fieldValue, cardOrder);
        // Remove from pending
        forms.value = forms.value.filter(f => f.id !== formId);
        // Notify parent to refresh persisted fields
        await options.onSaved$();
    });

    /**
     * Cancel a pending form without saving.
     */
    const cancel$ = $((formId: string) => {
        forms.value = forms.value.filter(f => f.id !== formId);
    });

    /**
     * Update pending form values (for LS tracking as user types).
     */
    const change$ = $((formId: string, fieldName: string, fieldValue: string | null) => {
        forms.value = forms.value.map(f =>
            f.id === formId ? { ...f, fieldName, fieldValue } : f
        );
    });

    /**
     * Save all pending forms with valid field names.
     * Used by UC CREATE to save any unsaved fields before completing.
     * Returns the number of forms saved.
     */
    const saveAllPending$ = $(async (): Promise<number> => {
        const formsToSave = forms.value.filter(f => f.fieldName.trim());
        if (formsToSave.length === 0) return 0;

        const fieldService = getFieldService();
        await Promise.all(
            formsToSave.map(f => 
                fieldService.addField(options.nodeId, f.fieldName.trim(), f.fieldValue, f.cardOrder)
            )
        );

        // Clear all forms (saved ones are now persisted, empty ones are discarded)
        forms.value = [];
        
        // Notify parent to refresh persisted fields
        await options.onSaved$();
        
        return formsToSave.length;
    });

    return {
        /** Current pending forms */
        forms,
        /** Add a new empty pending form */
        add$,
        /** Save a pending form to the database */
        save$,
        /** Cancel a pending form without saving */
        cancel$,
        /** Update pending form values as user types */
        change$,
        /** Save all pending forms with valid names (for UC CREATE) */
        saveAllPending$,
    };
}
