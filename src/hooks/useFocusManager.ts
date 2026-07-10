/**
 * useFocusManager - Manages input focus and blur suppression.
 *
 * Extracted from useFieldEdit (SRP) so editing logic is separate from
 * DOM focus management. Handles:
 * - Auto-focus with cursor at end when a reactive condition becomes true
 * - Blur suppression box for coordinating pointer/blur interactions
 *
 * The Qwik version scheduled focus behind a 10ms timeout to outwait render;
 * Solid user effects run after render, so the input is mounted (with `value`
 * bound) by the time the effect fires — the delay and its cleanup bookkeeping
 * are deleted (meta-plan §10).
 */

import { createEffect, type Accessor } from 'solid-js';

export const BLUR_SUPPRESS_WINDOW_MS = 220;

export type UseFocusManagerResult = {
    /**
     * Blur suppression deadline (epoch ms). A plain mutable box, deliberately
     * not a signal — nothing tracks it; handlers read/write `.value`
     * imperatively. Set to `Date.now() + BLUR_SUPPRESS_WINDOW_MS` before
     * actions that would steal focus (e.g., pointerdown on an already-focused
     * input). Read in blur handlers:
     * `if (Date.now() < suppressBlurUntil.value) return;`
     */
    suppressBlurUntil: { value: number };
};

/**
 * Auto-focuses an input with cursor at end when `shouldFocus` becomes true,
 * and provides a blur suppression box for coordinating pointer interactions.
 *
 * @param inputEl - Plain thunk over the caller's closure ref (not reactive)
 * @param shouldFocus - Tracked dependency; when it flips true, the input is focused
 */
export function useFocusManager(
    inputEl: () => HTMLInputElement | HTMLTextAreaElement | undefined,
    shouldFocus: Accessor<boolean>,
): UseFocusManagerResult {
    const suppressBlurUntil = { value: 0 };

    createEffect(() => {
        if (!shouldFocus()) return;
        const input = inputEl();
        if (!input) return;
        const len = input.value.length;
        input.focus();
        input.setSelectionRange(len, len); // cursor at end
    });

    return { suppressBlurUntil };
}
