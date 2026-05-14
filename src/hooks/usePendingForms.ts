/**
 * usePendingForms — Hook backing the FieldComposer batch.
 *
 * A pending form is a FieldDefinition the user has checked in the composer plus
 * an in-flight (not yet persisted) value. The batch lives in localStorage keyed
 * by nodeId so picking a few FieldDefinitions, navigating away, and coming back
 * keeps the draft. commitAll$ turns the batch into real DataFields via the
 * command bus.
 */

import { useSignal, useVisibleTask$, useTask$, $, type Signal, type QRL } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import type { FieldDefinition, DataFieldValue, ComponentType } from '../data/models';
import { generateId } from '../utils/id';

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

const getPendingFormsKey = (nodeId: string) => `pendingFields:${nodeId}`;

const loadPendingForms = (nodeId: string): PendingForm[] => {
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
    /**
     * The id of the most recently user-toggled-on form. Composer uses this to
     * decide whether to auto-focus a row's value input on mount: only the row
     * the user just ticked should jump into edit mode. Seeded rows (construction
     * locks, Undo restore) leave it null so nothing steals focus on open.
     */
    lastToggledId: Signal<string | null>;
    togglePending$: ReturnType<typeof $<(definition: FieldDefinition) => void>>;
    setPendingValue$: ReturnType<typeof $<(formId: string, value: DataFieldValue | null) => void>>;
    commitAll$: ReturnType<typeof $<(currentMaxCardOrder: number) => Promise<number>>>;
    discardAll$: ReturnType<typeof $<() => PendingForm[]>>;
    restoreAll$: ReturnType<typeof $<(rows: PendingForm[]) => void>>;
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

    const togglePending$ = $((definition: FieldDefinition) => {
        const existing = forms.value.find(f => f.fieldDefinitionId === definition.id);
        if (existing) {
            forms.value = forms.value.filter(f => f.fieldDefinitionId !== definition.id);
            if (lastToggledId.value === existing.id) lastToggledId.value = null;
        } else {
            const fresh = pendingFormFromFieldDefinition(definition);
            forms.value = [...forms.value, fresh];
            lastToggledId.value = fresh.id;
        }
    });

    const setPendingValue$ = $((formId: string, value: DataFieldValue | null) => {
        forms.value = forms.value.map(f => f.id === formId ? { ...f, value } : f);
    });

    const commitAll$ = $(async (currentMaxCardOrder: number): Promise<number> => {
        // Drop malformed entries (e.g. legacy localStorage drafts from the old
        // pre-composer shape that lack fieldDefinitionId/fieldName).
        const valid = forms.value.filter(f => f && f.fieldDefinitionId && typeof f.fieldName === 'string');
        const batch = [...valid].sort((a, b) =>
            (a.fieldName ?? '').localeCompare(b.fieldName ?? '')
        );
        if (batch.length === 0) return 0;

        const commandBus = getCommandBus();
        for (let i = 0; i < batch.length; i++) {
            const row = batch[i];
            const cardOrder = currentMaxCardOrder + i + 1;
            // Pass initialValue through so creation writes a single history
            // row carrying the user-entered value, instead of a null create
            // followed by an update (which produced an "Empty" history row).
            await commandBus.execute({
                type: 'ADD_FIELD_FROM_DEFINITION',
                payload: {
                    nodeId: options.nodeId,
                    fieldDefinitionId: row.fieldDefinitionId,
                    cardOrder,
                    initialValue: row.value ?? null,
                },
            });
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
        lastToggledId,
        togglePending$,
        setPendingValue$,
        commitAll$,
        discardAll$,
        restoreAll$,
    };
}
