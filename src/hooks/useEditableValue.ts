/**
 * useEditableValue - Generic hook for managing current/edit/preview value state.
 *
 * Extracted from useFieldEdit to enable reuse across editable UI elements.
 * Manages three value layers:
 *   - current: the persisted/committed value
 *   - edit: the in-progress edit value (working copy)
 *   - preview: a temporary overlay (e.g., viewing a historical value)
 */

import { useSignal, $, type Signal } from '@builder.io/qwik';

export type UseEditableValueResult = {
    current: Signal<string>;
    edit: Signal<string>;
    preview: Signal<string | null>;
    displayValue: string;
    hasValue: boolean;
    isPreviewActive: boolean;
};

export function useEditableValue(initialValue: string) {
    const current = useSignal<string>(initialValue);
    const edit = useSignal<string>('');
    const preview = useSignal<string | null>(null);

    const displayValue = preview.value !== null ? preview.value : current.value;
    const hasValue = !!displayValue;
    const isPreviewActive = preview.value !== null;

    return { current, edit, preview, displayValue, hasValue, isPreviewActive };
}
