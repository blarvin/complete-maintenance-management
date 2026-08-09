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

import { createSignal, createMemo, type Accessor } from 'solid-js';

export type UseEditableValueResult<T> = {
    /** Persisted/committed value. */
    current: Accessor<T | null>;
    setCurrent: (value: T | null) => void;
    /** In-progress edit buffer (always a string; callers parse on save). */
    edit: Accessor<string>;
    setEdit: (value: string) => void;
    /** Formatted display string for `current`. */
    displayValue: Accessor<string>;
    /** True when `current` has a non-null, non-empty formatted value. */
    hasValue: Accessor<boolean>;
};

export function useEditableValue<T>(
    initialValue: T | null,
    format: (value: T | null) => string,
): UseEditableValueResult<T> {
    const [current, setCurrentRaw] = createSignal<T | null>(initialValue);
    // Wrap in a thunk so object values (e.g. SingleImageValue) never hit the
    // function-overload of Solid setters.
    const setCurrent = (value: T | null) => setCurrentRaw(() => value);
    const [edit, setEdit] = createSignal<string>('');

    const displayValue = createMemo(() => format(current()));
    const hasValue = createMemo(
        () => current() !== null && current() !== undefined && displayValue() !== '',
    );

    return { current, setCurrent, edit, setEdit, displayValue, hasValue };
}
