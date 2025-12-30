/**
 * useFieldEdit - Hook for managing DataField edit state and interactions.
 * 
 * Extracted from DataField to enable reuse across field types (text, image, etc.)
 * and improve testability. Handles:
 * - Edit mode state (via appState FSM)
 * - Value management (current, edit, preview)
 * - Double-tap to edit/save
 * - Focus management
 * - Outside click cancellation
 * - Preview mode for historical values
 */

import { useSignal, $, useVisibleTask$, useOnDocument, useTask$, type Signal, type QRL } from '@builder.io/qwik';
import { getFieldService } from '../data/services';
import { useDoubleTap } from './useDoubleTap';
import { useAppState, useAppTransitions, selectors } from '../state/appState';

export type UseFieldEditOptions = {
    fieldId: string;
    initialValue: string | null;
    /** Called after save or revert completes */
    onUpdated$?: QRL<() => void>;
};

export type UseFieldEditResult = {
    /** Whether this field is currently being edited */
    isEditing: boolean;
    /** Value to display (preview takes precedence over current) */
    displayValue: string;
    /** Whether preview mode is active */
    isPreviewActive: boolean;
    /** Whether there's a value to display */
    hasValue: boolean;
    /** Current edit value (for input binding) */
    editValue: Signal<string>;
    /** Ref to attach to edit input for focus management */
    editInputRef: Signal<HTMLInputElement | undefined>;
    /** Ref to attach to root element for outside click detection */
    rootRef: Signal<HTMLElement | undefined>;
    /** Start editing this field */
    beginEdit$: QRL<() => void>;
    /** Save the current edit value */
    save$: QRL<() => Promise<void>>;
    /** Cancel editing without saving */
    cancel$: QRL<() => void>;
    /** Handle pointer down on display value (double-tap to edit) */
    valuePointerDown$: QRL<(ev: PointerEvent | MouseEvent) => Promise<void>>;
    /** Handle keyboard on display value (Enter/Space to edit) */
    valueKeyDown$: QRL<(e: KeyboardEvent) => void>;
    /** Handle pointer down on edit input (double-tap to save) */
    inputPointerDown$: QRL<(ev: PointerEvent | MouseEvent) => Promise<void>>;
    /** Handle blur on edit input */
    inputBlur$: QRL<() => void>;
    /** Handle keyboard on edit input (Enter to save, Escape to cancel) */
    inputKeyDown$: QRL<(e: KeyboardEvent) => void>;
    /** Handle input change */
    inputChange$: QRL<(value: string) => void>;
    /** Set preview value (for history selection) */
    setPreview$: QRL<(value: string | null) => void>;
    /** Revert to a historical value */
    revert$: QRL<(value: string | null) => Promise<void>>;
    /** Clear preview (e.g., when collapsing details) */
    clearPreview$: QRL<() => void>;
};

/**
 * Hook that manages field editing state and interactions.
 * 
 * Usage:
 * ```tsx
 * const {
 *     isEditing, displayValue, editValue, editInputRef, rootRef,
 *     beginEdit$, save$, cancel$, valuePointerDown$, ...
 * } = useFieldEdit({
 *     fieldId: props.id,
 *     initialValue: props.fieldValue,
 *     onUpdated$: props.onUpdated$,
 * });
 * ```
 */
export function useFieldEdit(options: UseFieldEditOptions): UseFieldEditResult {
    const appState = useAppState();
    const { startFieldEdit$, stopFieldEdit$ } = useAppTransitions();
    
    // Get edit state from FSM
    const fieldState = selectors.getDataFieldState(appState, options.fieldId);
    const isEditing = fieldState === 'EDITING';
    
    // Refs
    const rootRef = useSignal<HTMLElement>();
    const editInputRef = useSignal<HTMLInputElement>();
    
    // Value state
    const currentValue = useSignal<string>(options.initialValue ?? '');
    const editValue = useSignal<string>('');
    const previewValue = useSignal<string | null>(null);
    
    // Timing state for blur handling
    const suppressCancelUntil = useSignal<number>(0);
    const focusTimeoutId = useSignal<number | null>(null);
    
    // Double-tap detection
    const { checkDoubleTap$ } = useDoubleTap();
    
    // Sync initial value on mount
    useVisibleTask$(() => {
        currentValue.value = options.initialValue ?? '';
    });
    
    // Focus management - set cursor at end when entering edit mode
    useTask$(({ track, cleanup }) => {
        const editingId = track(() => appState.editingFieldId);
        const thisFieldIsEditing = editingId === options.fieldId;
        
        // Clear any pending focus timeout
        if (focusTimeoutId.value !== null) {
            clearTimeout(focusTimeoutId.value);
            focusTimeoutId.value = null;
        }
        
        if (thisFieldIsEditing) {
            // Schedule focus with cursor at end
            focusTimeoutId.value = window.setTimeout(() => {
                if (appState.editingFieldId === options.fieldId && editInputRef.value) {
                    const input = editInputRef.value;
                    const len = input.value.length;
                    input.focus();
                    input.setSelectionRange(len, len);
                }
                focusTimeoutId.value = null;
            }, 10) as unknown as number;
        }
        
        cleanup(() => {
            if (focusTimeoutId.value !== null) {
                clearTimeout(focusTimeoutId.value);
                focusTimeoutId.value = null;
            }
        });
    });
    
    // Cancel edit on outside click
    useOnDocument('pointerdown', $((ev: Event) => {
        if (appState.editingFieldId !== options.fieldId) return;
        const container = rootRef.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            stopFieldEdit$();
            editValue.value = currentValue.value;
        }
    }));
    
    // === Edit Flow Handlers ===
    
    const beginEdit$ = $(() => {
        if (appState.editingFieldId === options.fieldId) return;
        startFieldEdit$(options.fieldId);
        editValue.value = currentValue.value;
        previewValue.value = null;
    });
    
    const save$ = $(async () => {
        if (appState.editingFieldId !== options.fieldId) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await getFieldService().updateFieldValue(options.fieldId, newVal);
        currentValue.value = newVal ?? '';
        stopFieldEdit$();
        if (options.onUpdated$) {
            await options.onUpdated$();
        }
    });
    
    const cancel$ = $(() => {
        if (appState.editingFieldId !== options.fieldId) return;
        stopFieldEdit$();
        editValue.value = currentValue.value;
    });
    
    // === Input Event Handlers ===
    
    const inputChange$ = $((value: string) => {
        editValue.value = value;
    });
    
    const inputBlur$ = $(() => {
        if (Date.now() < suppressCancelUntil.value) return;
        if (appState.editingFieldId === options.fieldId) {
            stopFieldEdit$();
            editValue.value = currentValue.value;
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
        suppressCancelUntil.value = Date.now() + 220;
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
    
    const setPreview$ = $((value: string | null) => {
        previewValue.value = value;
    });
    
    const clearPreview$ = $(() => {
        previewValue.value = null;
    });
    
    const revert$ = $(async (value: string | null) => {
        await getFieldService().updateFieldValue(options.fieldId, value);
        currentValue.value = value ?? '';
        previewValue.value = null;
        if (options.onUpdated$) {
            await options.onUpdated$();
        }
    });
    
    // Computed display values
    const displayValue = previewValue.value !== null ? previewValue.value : currentValue.value;
    const hasValue = !!displayValue;
    const isPreviewActive = previewValue.value !== null;
    
    return {
        isEditing,
        displayValue,
        isPreviewActive,
        hasValue,
        editValue,
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
