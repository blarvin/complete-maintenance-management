/**
 * usePendingForms - Hook for managing pending DataField forms with localStorage persistence.
 * 
 * Extracted from TreeNodeDisplay to enable reuse and testing.
 * Pending forms are field creation forms that haven't been saved to the database yet.
 * They persist to localStorage so users don't lose work on navigation/refresh.
 */

import { useSignal, useVisibleTask$, useTask$, $, type QRL } from '@builder.io/qwik';
import { getFieldService } from '../data/services';
import { generateId } from '../utils/id';

/** Pending form state for localStorage */
export type PendingForm = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
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
};

/**
 * Hook that manages pending DataField forms.
 * 
 * Usage:
 * ```tsx
 * const { forms, add$, save$, cancel$, change$ } = usePendingForms({
 *     nodeId: props.id,
 *     onSaved$: reload$,
 * });
 * ```
 */
export function usePendingForms(options: UsePendingFormsOptions) {
    const forms = useSignal<PendingForm[]>([]);

    // Load pending forms from LS on mount
    useVisibleTask$(() => {
        forms.value = loadPendingForms(options.nodeId);
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
     * Add a new empty pending form.
     */
    const add$ = $(() => {
        const newForm: PendingForm = {
            id: generateId(),
            fieldName: '',
            fieldValue: null,
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
        // Persist to DB
        await getFieldService().addField(options.nodeId, name, fieldValue);
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
    };
}
