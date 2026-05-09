/**
 * useEditableValue - Holds the current/committed value and the in-progress
 * edit buffer for a DataField renderer.
 *
 * `current` is typed `T | null`; `edit` is always a string because the user
 * types into a text input. Callers parse on save and format for display.
 *
 * The earlier preview/revert overlay (used by an old per-history-row preview
 * UX) was retired when revert moved to a direct write from DataFieldHistory.
 */

import { useSignal, type Signal } from '@builder.io/qwik';

export type UseEditableValueResult<T> = {
    /** Persisted/committed value. */
    current: Signal<T | null>;
    /** In-progress edit buffer (always a string; callers parse on save). */
    edit: Signal<string>;
    /** Formatted display string for `current`. */
    displayValue: string;
    /** True when `current` has a non-null, non-empty formatted value. */
    hasValue: boolean;
};

export function useEditableValue<T>(
    initialValue: T | null,
    format: (value: T | null) => string,
): UseEditableValueResult<T> {
    const current = useSignal<T | null>(initialValue);
    const edit = useSignal<string>('');

    const displayValue = format(current.value);
    const hasValue = current.value !== null && current.value !== undefined && displayValue !== '';

    return { current, edit, displayValue, hasValue };
}
