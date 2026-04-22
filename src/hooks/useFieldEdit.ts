/**
 * useFieldEdit<T> - Generic hook for DataField edit state across Components.
 *
 * Parameterized on the typed value T (string for text/enum, number for
 * measurement, etc). The edit signal is always a string (user types into a text
 * input); `parse` converts it to T | null on save, `format` converts T | null
 * back to display string.
 *
 * Handles:
 * - Edit mode state (via appState FSM)
 * - Double-tap to edit/save
 * - Focus management + outside-click cancel
 * - Preview mode for historical values
 * - Snackbar + error handling on save/revert
 */

import { useSignal, $, useVisibleTask$, useOnDocument, type Signal, type QRL } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import { getSnackbarService } from '../services/snackbar';
import { toStorageError, describeForUser } from '../data/storage/storageErrors';
import { useDoubleTap } from './useDoubleTap';
import { useFocusManager, BLUR_SUPPRESS_WINDOW_MS } from './useFocusManager';
import { useAppState, useAppTransitions, selectors } from '../state/appState';
import { useEditableValue } from './useEditableValue';
import type { DataFieldValue } from '../data/models';

export type UseFieldEditOptions<T extends DataFieldValue> = {
    fieldId: string;
    initialValue: T | null;
    /** Render T | null to a display string. */
    format: (value: T | null) => string;
    /** Parse the raw edit input to a T | null (return null for empty). Throw to reject invalid input. */
    parse: (raw: string) => T | null;
    /** Optional post-parse validation (throw to reject). Runs before dispatch. */
    validate?: (value: T | null) => void;
    /** Ref to the outer DataField row; used for outside-click cancel. Owned by the dispatcher. */
    rootRef: Signal<HTMLElement | undefined>;
    /** Called after save or revert completes. */
    onUpdated$?: QRL<() => void>;
};

export type UseFieldEditResult<T extends DataFieldValue> = {
    isEditing: boolean;
    displayValue: string;
    isPreviewActive: boolean;
    hasValue: boolean;
    editValue: Signal<string>;
    currentValue: Signal<T | null>;
    editInputRef: Signal<HTMLInputElement | undefined>;
    rootRef: Signal<HTMLElement | undefined>;
    beginEdit$: QRL<() => void>;
    save$: QRL<() => Promise<void>>;
    cancel$: QRL<() => void>;
    valuePointerDown$: QRL<(ev: PointerEvent | MouseEvent) => Promise<void>>;
    valueKeyDown$: QRL<(e: KeyboardEvent) => void>;
    inputPointerDown$: QRL<(ev: PointerEvent | MouseEvent) => Promise<void>>;
    inputBlur$: QRL<() => void>;
    inputKeyDown$: QRL<(e: KeyboardEvent) => void>;
    inputChange$: QRL<(value: string) => void>;
    setPreview$: QRL<(value: T | null) => void>;
    revert$: QRL<(value: T | null) => Promise<void>>;
    clearPreview$: QRL<() => void>;
};

export function useFieldEdit<T extends DataFieldValue>(options: UseFieldEditOptions<T>): UseFieldEditResult<T> {
    const appState = useAppState();
    const { startFieldEdit$, stopFieldEdit$ } = useAppTransitions();

    const fieldState = selectors.getDataFieldState(appState, options.fieldId);
    const isEditing = fieldState === 'EDITING';

    const rootRef = options.rootRef;
    const editInputRef = useSignal<HTMLInputElement>();

    const {
        current: currentValue,
        edit: editValue,
        preview: previewValue,
        displayValue,
        hasValue,
        isPreviewActive,
    } = useEditableValue<T>(options.initialValue, options.format);

    const { checkDoubleTap$ } = useDoubleTap();

    const { suppressBlurUntil } = useFocusManager(
        editInputRef,
        () => appState.editingFieldId === options.fieldId
    );

    // Sync initial value on mount
    useVisibleTask$(() => {
        currentValue.value = options.initialValue;
    });

    // Cancel edit on outside click
    useOnDocument('pointerdown', $((ev: Event) => {
        if (appState.editingFieldId !== options.fieldId) return;
        const container = rootRef.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            stopFieldEdit$();
            editValue.value = options.format(currentValue.value);
        }
    }));

    // === Edit Flow Handlers ===

    const beginEdit$ = $(() => {
        if (appState.editingFieldId === options.fieldId) return;
        startFieldEdit$(options.fieldId);
        editValue.value = options.format(currentValue.value);
        previewValue.value = null;
    });

    const save$ = $(async () => {
        if (appState.editingFieldId !== options.fieldId) return;
        const fieldId = options.fieldId;
        const prevVal = currentValue.value;
        let newVal: T | null;
        try {
            newVal = options.parse(editValue.value);
            if (options.validate) options.validate(newVal);
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: err instanceof Error ? err.message : 'Invalid value',
            });
            return;
        }
        try {
            await getCommandBus().execute({ type: 'UPDATE_FIELD_VALUE', payload: { fieldId, newValue: newVal } });
            currentValue.value = newVal;
            stopFieldEdit$();
            getSnackbarService().show({
                message: 'Field updated',
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await getCommandBus().execute({ type: 'UPDATE_FIELD_VALUE', payload: { fieldId, newValue: prevVal } });
                    }),
                },
            });
            if (options.onUpdated$) {
                await options.onUpdated$();
            }
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: describeForUser(toStorageError(err)),
            });
        }
    });

    const cancel$ = $(() => {
        if (appState.editingFieldId !== options.fieldId) return;
        stopFieldEdit$();
        editValue.value = options.format(currentValue.value);
    });

    // === Input Event Handlers ===

    const inputChange$ = $((value: string) => {
        editValue.value = value;
    });

    const inputBlur$ = $(() => {
        if (Date.now() < suppressBlurUntil.value) return;
        if (appState.editingFieldId === options.fieldId) {
            stopFieldEdit$();
            editValue.value = options.format(currentValue.value);
        }
    });

    const inputKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel$();
        }
    });

    const inputPointerDown$ = $(async (ev: PointerEvent | MouseEvent) => {
        if (appState.editingFieldId !== options.fieldId) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        suppressBlurUntil.value = Date.now() + BLUR_SUPPRESS_WINDOW_MS;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await save$();
        }
    });

    // === Display Value Event Handlers ===

    const valuePointerDown$ = $(async (ev: PointerEvent | MouseEvent) => {
        if (appState.editingFieldId === options.fieldId) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await beginEdit$();
        }
    });

    const valueKeyDown$ = $((e: KeyboardEvent) => {
        if (appState.editingFieldId === options.fieldId) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginEdit$();
        }
    });

    // === Preview/Revert Handlers ===

    const setPreview$ = $((value: T | null) => {
        previewValue.value = value;
    });

    const clearPreview$ = $(() => {
        previewValue.value = null;
    });

    const revert$ = $(async (value: T | null) => {
        await getCommandBus().execute({ type: 'UPDATE_FIELD_VALUE', payload: { fieldId: options.fieldId, newValue: value } });
        currentValue.value = value;
        previewValue.value = null;
        if (options.onUpdated$) {
            await options.onUpdated$();
        }
    });

    return {
        isEditing,
        displayValue,
        isPreviewActive,
        hasValue,
        editValue,
        currentValue,
        editInputRef,
        rootRef,
        beginEdit$,
        save$,
        cancel$,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
        setPreview$,
        revert$,
        clearPreview$,
    };
}
