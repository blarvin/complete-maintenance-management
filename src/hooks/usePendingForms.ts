/**
 * usePendingForms — Hook backing the FieldComposer batch.
 *
 * A pending form is a Template the user has checked in the composer plus an
 * in-flight (not yet persisted) value. The batch lives in localStorage keyed by
 * nodeId so picking a few Templates, navigating away, and coming back keeps the
 * draft. commitAll$ turns the batch into real DataFields via the command bus.
 */

import { useSignal, useVisibleTask$, useTask$, $, type Signal, type QRL } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import type { DataFieldTemplate, DataFieldValue, ComponentType } from '../data/models';
import { generateId } from '../utils/id';

/** A pending (un-persisted) Template instance with its in-progress value. */
export type PendingForm = {
    id: string;
    templateId: string;
    componentType: ComponentType;
    fieldName: string;
    value: DataFieldValue | null;
};

const getPendingFormsKey = (nodeId: string) => `pendingFields:${nodeId}`;

const loadPendingForms = (nodeId: string): PendingForm[] => {
    try {
        const stored = localStorage.getItem(getPendingFormsKey(nodeId));
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

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
    /**
     * Async loader for the initial batch (e.g. construction defaults, Undo restore).
     * Called from the hook's mount task only when localStorage has no draft for nodeId,
     * so a stored draft always wins over fresh defaults.
     */
    initialSeedLoader$?: QRL<() => Promise<PendingForm[]>>;
};

export type UsePendingFormsResult = {
    forms: Signal<PendingForm[]>;
    togglePending$: ReturnType<typeof $<(template: DataFieldTemplate) => void>>;
    setPendingValue$: ReturnType<typeof $<(formId: string, value: DataFieldValue | null) => void>>;
    commitAll$: ReturnType<typeof $<(currentMaxCardOrder: number) => Promise<number>>>;
    discardAll$: ReturnType<typeof $<() => PendingForm[]>>;
    restoreAll$: ReturnType<typeof $<(rows: PendingForm[]) => void>>;
};

export function usePendingForms(options: UsePendingFormsOptions): UsePendingFormsResult {
    const forms = useSignal<PendingForm[]>([]);
    const initialized = useSignal(false);

    useVisibleTask$(async () => {
        if (initialized.value) return;
        const stored = loadPendingForms(options.nodeId);
        if (stored.length > 0) {
            forms.value = stored;
        } else if (options.initialSeedLoader$) {
            const seeded = await options.initialSeedLoader$();
            if (seeded.length > 0) forms.value = seeded;
        }
        initialized.value = true;
    });

    useTask$(({ track }) => {
        const currentForms = track(() => forms.value);
        if (typeof localStorage !== 'undefined' && initialized.value) {
            savePendingForms(options.nodeId, currentForms);
        }
    });

    const togglePending$ = $((template: DataFieldTemplate) => {
        const existing = forms.value.find(f => f.templateId === template.id);
        if (existing) {
            forms.value = forms.value.filter(f => f.templateId !== template.id);
        } else {
            const newForm: PendingForm = {
                id: generateId(),
                templateId: template.id,
                componentType: template.componentType,
                fieldName: template.label,
                value: null,
            };
            forms.value = [...forms.value, newForm];
        }
    });

    const setPendingValue$ = $((formId: string, value: DataFieldValue | null) => {
        forms.value = forms.value.map(f => f.id === formId ? { ...f, value } : f);
    });

    const commitAll$ = $(async (currentMaxCardOrder: number): Promise<number> => {
        const batch = [...forms.value].sort((a, b) =>
            a.fieldName.localeCompare(b.fieldName)
        );
        if (batch.length === 0) return 0;

        const commandBus = getCommandBus();
        for (let i = 0; i < batch.length; i++) {
            const row = batch[i];
            const cardOrder = currentMaxCardOrder + i + 1;
            const created = await commandBus.execute({
                type: 'ADD_FIELD_FROM_TEMPLATE',
                payload: { nodeId: options.nodeId, templateId: row.templateId, cardOrder },
            });
            if (row.value !== null && row.value !== undefined && created) {
                await commandBus.execute({
                    type: 'UPDATE_FIELD_VALUE',
                    payload: { fieldId: created.id, newValue: row.value },
                });
            }
        }

        forms.value = [];
        return batch.length;
    });

    const discardAll$ = $((): PendingForm[] => {
        const cleared = forms.value;
        forms.value = [];
        return cleared;
    });

    const restoreAll$ = $((rows: PendingForm[]) => {
        forms.value = rows;
    });

    return {
        forms,
        togglePending$,
        setPendingValue$,
        commitAll$,
        discardAll$,
        restoreAll$,
    };
}
