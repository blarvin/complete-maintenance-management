/**
 * useFocusManager - Manages input focus and blur suppression.
 *
 * Extracted from useFieldEdit (SRP) so editing logic is separate from
 * DOM focus management. Handles:
 * - Auto-focus with cursor at end when a reactive condition becomes true
 * - Cleanup of pending focus timeouts
 * - Blur suppression signal for coordinating pointer/blur interactions
 */

import { useSignal, useTask$, type Signal } from '@builder.io/qwik';

const FOCUS_DELAY_MS = 10;

export const BLUR_SUPPRESS_WINDOW_MS = 220;

export type UseFocusManagerResult = {
  /**
   * Signal tracking blur suppression deadline (epoch ms).
   * Set to `Date.now() + BLUR_SUPPRESS_WINDOW_MS` before actions that
   * would steal focus (e.g., pointerdown on an already-focused input).
   * Read in blur handlers: `if (Date.now() < suppressBlurUntil.value) return;`
   */
  suppressBlurUntil: Signal<number>;
};

/**
 * Auto-focuses an input with cursor at end when `shouldFocus` returns true,
 * and provides a blur suppression signal for coordinating pointer interactions.
 *
 * @param inputRef - Signal pointing to the HTMLInputElement to focus
 * @param shouldFocus - Reactive getter; when it returns true, the input is focused
 */
export function useFocusManager(
  inputRef: Signal<HTMLInputElement | undefined>,
  shouldFocus: () => boolean
): UseFocusManagerResult {
  const focusTimeoutId = useSignal<number | null>(null);
  const suppressBlurUntil = useSignal<number>(0);

  useTask$(({ track, cleanup }) => {
    const isActive = track(shouldFocus);

    // Clear any pending focus timeout
    if (focusTimeoutId.value !== null) {
      clearTimeout(focusTimeoutId.value);
      focusTimeoutId.value = null;
    }

    if (isActive) {
      // Schedule focus with cursor at end
      focusTimeoutId.value = window.setTimeout(() => {
        if (shouldFocus() && inputRef.value) {
          const input = inputRef.value;
          const len = input.value.length;
          input.focus();
          input.setSelectionRange(len, len);
        }
        focusTimeoutId.value = null;
      }, FOCUS_DELAY_MS) as unknown as number;
    }

    cleanup(() => {
      if (focusTimeoutId.value !== null) {
        clearTimeout(focusTimeoutId.value);
        focusTimeoutId.value = null;
      }
    });
  });

  return { suppressBlurUntil };
}
