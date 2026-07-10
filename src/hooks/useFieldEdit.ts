/**
 * useFieldEdit<T> - Generic hook for DataField edit state across Components.
 *
 * Parameterized on the typed value T (string for text/enum, number for
 * measurement, etc). The edit signal is always a string (user types into a
 * text input); `parse` converts it to T | null on save, `format` converts
 * T | null back to display string.
 *
 * Handles:
 * - Edit mode state (via appState FSM)
 * - Double-tap to edit; double-tap-while-editing cancels
 * - Focus management + outside-click cancel
 * - No-op gate: identical newVal/prevVal skips dispatch (no history, no sync)
 * - Snackbar + error handling on save
 *
 * Cross-component writes (e.g. revert from DataFieldHistory) update the
 * renderer's `currentValue` via `useFieldValueSync`, not through this hook.
 *
 * Solid timing notes (meta-plan §10): the FSM write mounts the input
 * synchronously, so `beginEdit` seeds the edit buffer BEFORE `startFieldEdit`;
 * the autoFocus mount task drops the Qwik `setTimeout(0)` (the focus-manager
 * effect fires on the FSM write, after render).
 */

import { onMount, onCleanup, createMemo, type Accessor } from 'solid-js';
import { getCommandBus } from '../data/commands';
import { getSnackbarService } from '../services/snackbar';
import { commitWithUndo } from '../data/services/commitWithUndo';
import { useDoubleTap } from './useDoubleTap';
import { useFocusManager, BLUR_SUPPRESS_WINDOW_MS } from './useFocusManager';
import { useAppState, useAppTransitions, selectors } from '../state/appState';
import { useEditableValue } from './useEditableValue';
import type { DataFieldValue } from '../data/models';

export type UseFieldEditOptions<T extends DataFieldValue> = {
    /** Mount-time constant — rows remount per field (`<For>` reference-keyed). */
    fieldId: string;
    initialValue: T | null;
    /** Render T | null to a display string. */
    format: (value: T | null) => string;
    /** Parse the raw edit input to a T | null (return null for empty). Throw to reject invalid input. */
    parse: (raw: string) => T | null;
    /** Optional post-parse validation (throw to reject). Runs before dispatch. */
    validate?: (value: T | null) => void;
    /** Read accessor to the outer DataField row; used for outside-click cancel. Owned by the dispatcher. */
    rootRef: Accessor<HTMLElement | undefined>;
    /**
     * When set, save does NOT dispatch UPDATE_ELEMENT_VALUE or show a Snackbar.
     * Instead it forwards the parsed value to onChange. Used by FieldComposer
     * for in-flight (un-persisted) Template previews.
     *
     * `autoFocus` (composer only): true when this row is the one the user just
     * ticked. The hook auto-enters edit mode and focuses the input on mount.
     * Seeded rows (construction defaults / Undo restore) pass false so nothing
     * steals focus when the composer opens.
     */
    pendingMode?: { onChange: (value: T | null) => void | Promise<void>; autoFocus?: boolean };
};

export type UseFieldEditResult<T extends DataFieldValue> = {
    isEditing: Accessor<boolean>;
    displayValue: Accessor<string>;
    hasValue: Accessor<boolean>;
    /** The edit buffer (no external writer — writes go via inputChange). */
    editValue: Accessor<string>;
    currentValue: Accessor<T | null>;
    /** Renderers pass this to useFieldValueSync. */
    setCurrentValue: (value: T | null) => void;
    /** JSX `ref=` for the edit input/textarea. */
    setEditInputRef: (el: HTMLInputElement | HTMLTextAreaElement) => void;
    beginEdit: () => void;
    save: () => Promise<void>;
    cancel: () => void;
    valuePointerDown: (ev: PointerEvent | MouseEvent) => void;
    valueKeyDown: (e: KeyboardEvent) => void;
    inputPointerDown: (ev: PointerEvent | MouseEvent) => void;
    inputBlur: () => void;
    inputKeyDown: (e: KeyboardEvent) => void;
    inputChange: (value: string) => void;
};

export function useFieldEdit<T extends DataFieldValue>(options: UseFieldEditOptions<T>): UseFieldEditResult<T> {
    const appState = useAppState();
    const { startFieldEdit, stopFieldEdit } = useAppTransitions();

    const isEditing = createMemo(
        () => selectors.getDataFieldState(appState, options.fieldId) === 'EDITING',
    );

    // Plain closure ref — nothing tracks it; the union type absorbs the
    // textarea variant.
    let inputEl: HTMLInputElement | HTMLTextAreaElement | undefined;
    const setEditInputRef = (el: HTMLInputElement | HTMLTextAreaElement) => {
        inputEl = el;
    };

    const {
        current: currentValue,
        setCurrent: setCurrentValue,
        edit: editValue,
        setEdit,
        displayValue,
        hasValue,
    } = useEditableValue<T>(options.initialValue, options.format);

    const { checkDoubleTap } = useDoubleTap();

    const { suppressBlurUntil } = useFocusManager(
        () => inputEl,
        () => appState.editingElementId === options.fieldId,
    );

    // Auto-enter edit mode on mount when used in the FieldComposer (pendingMode)
    // with no value yet — i.e., the user just checked the row's box. Mirrors the
    // EnumKvField auto-open UX: tick → ready to type. Outside-click / blur in
    // pendingMode commits the (possibly empty) value back to the pending row, so
    // dismissing without typing leaves the row checked with a null value.
    onMount(() => {
        if (!options.pendingMode?.autoFocus) return;
        if (options.initialValue !== null) return;
        if (appState.editingElementId === options.fieldId) return;
        setEdit(options.format(null));
        startFieldEdit(options.fieldId);
    });

    // === Edit Flow Handlers ===

    const beginEdit = () => {
        if (appState.editingElementId === options.fieldId) return;
        // Seed the buffer BEFORE the FSM write — Solid mounts the input
        // synchronously on startFieldEdit, so the buffer must hold the right
        // text first.
        setEdit(options.format(currentValue()));
        startFieldEdit(options.fieldId);
    };

    const save = async () => {
        if (appState.editingElementId !== options.fieldId) return;
        const fieldId = options.fieldId;
        const prevVal = currentValue();
        let newVal: T | null;
        try {
            newVal = options.parse(editValue());
            if (options.validate) options.validate(newVal);
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: err instanceof Error ? err.message : 'Invalid value',
            });
            return;
        }
        if (options.pendingMode) {
            await options.pendingMode.onChange(newVal);
            setCurrentValue(newVal);
            stopFieldEdit();
            return;
        }
        // No-op gate: identical value skips dispatch (no history, no sync, no snackbar).
        if (newVal === prevVal) {
            stopFieldEdit();
            return;
        }
        const ok = await commitWithUndo({
            message: 'Field updated',
            execute: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: newVal } }),
            undo: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prevVal } }),
        });
        if (ok) {
            setCurrentValue(newVal);
            stopFieldEdit();
        }
    };

    const cancel = () => {
        if (appState.editingElementId !== options.fieldId) return;
        stopFieldEdit();
        setEdit(options.format(currentValue()));
    };

    // Cancel edit on outside click — but in pendingMode, auto-commit to the
    // pending row so typed values aren't lost when the user clicks Save in the
    // composer footer (or moves to another row). Always-on at hook setup with
    // the first-line FSM guard (the `useOnDocument` shape); onCleanup removes.
    const onDocumentPointerDown = (ev: Event) => {
        if (appState.editingElementId !== options.fieldId) return;
        const container = options.rootRef();
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            if (options.pendingMode) {
                void save();
            } else {
                stopFieldEdit();
                setEdit(options.format(currentValue()));
            }
        }
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    onCleanup(() => document.removeEventListener('pointerdown', onDocumentPointerDown));

    // === Input Event Handlers ===

    const inputChange = (value: string) => {
        setEdit(value);
    };

    const inputBlur = () => {
        if (Date.now() < suppressBlurUntil.value) return;
        if (appState.editingElementId === options.fieldId) {
            if (options.pendingMode) {
                void save();
            } else {
                stopFieldEdit();
                setEdit(options.format(currentValue()));
            }
        }
    };

    const inputKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    const inputPointerDown = (ev: PointerEvent | MouseEvent) => {
        if (appState.editingElementId !== options.fieldId) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        suppressBlurUntil.value = Date.now() + BLUR_SUPPRESS_WINDOW_MS;
        if (checkDoubleTap(x, y)) {
            cancel();
        }
    };

    // === Display Value Event Handlers ===

    const valuePointerDown = (ev: PointerEvent | MouseEvent) => {
        if (appState.editingElementId === options.fieldId) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        if (checkDoubleTap(x, y)) {
            beginEdit();
        }
    };

    const valueKeyDown = (e: KeyboardEvent) => {
        if (appState.editingElementId === options.fieldId) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginEdit();
        }
    };

    return {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        currentValue,
        setCurrentValue,
        setEditInputRef,
        beginEdit,
        save,
        cancel,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    };
}
