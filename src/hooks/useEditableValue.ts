/**
 * useEditableValue - Generic hook for managing current / edit / preview state.
 *
 * Current and preview are stored as typed T | null. The edit signal stays as a
 * string because the user types into a text input; callers parse it on save.
 * Displayed value is derived via a `format` callback.
 */

import { useSignal, type Signal } from '@builder.io/qwik';

export type UseEditableValueResult<T> = {
    /** Persisted/committed value. */
    current: Signal<T | null>;
    /** In-progress edit buffer (always a string; callers parse on save). */
    edit: Signal<string>;
    /** Overlay value for previewing historical entries. */
    preview: Signal<T | null>;
    /** Formatted display string (preview takes precedence over current). */
    displayValue: string;
    /** True when current or preview has a non-null value. */
    hasValue: boolean;
    /** True when preview is overlaying current. */
    isPreviewActive: boolean;
};

export function useEditableValue<T>(
    initialValue: T | null,
    format: (value: T | null) => string,
): UseEditableValueResult<T> {
    const current = useSignal<T | null>(initialValue);
    const edit = useSignal<string>('');
    const preview = useSignal<T | null>(null);

    const active = preview.value !== null ? preview.value : current.value;
    const displayValue = format(active);
    const hasValue = active !== null && active !== undefined && displayValue !== '';
    const isPreviewActive = preview.value !== null;

    return { current, edit, preview, displayValue, hasValue, isPreviewActive };
}
