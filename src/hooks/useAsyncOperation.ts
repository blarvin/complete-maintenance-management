/**
 * useAsyncOperation - Hook for managing loading state around async work.
 *
 * Provides an isLoading signal and a plain `runAsync` helper
 * that wraps any async function with try/catch/finally state management.
 *
 * Usage inside a $() handler:
 * ```ts
 * const op = useAsyncOperation();
 *
 * const load$ = $(async () => {
 *     await runAsync(op, async () => {
 *         data.value = await fetchData();
 *     });
 * });
 * ```
 *
 * `runAsync` is a plain function (not a QRL) so it can accept inline callbacks.
 * Signals are Qwik-serializable, so capturing `op` in $() closures is safe.
 */

import { useSignal, type Signal } from '@builder.io/qwik';

export type AsyncOperation = {
    isLoading: Signal<boolean>;
};

export function useAsyncOperation(): AsyncOperation {
    return {
        isLoading: useSignal(false),
    };
}

/**
 * Wraps an async function with loading state management.
 * Call inside $() handlers — signals are safe to capture in Qwik closures.
 *
 * Returns the result of `fn` on success, or `null` if an error was caught.
 */
export async function runAsync<T>(
    op: AsyncOperation,
    fn: () => Promise<T>,
): Promise<T | null> {
    op.isLoading.value = true;
    try {
        return await fn();
    } catch (e) {
        console.error('[runAsync] Operation failed:', e);
        return null;
    } finally {
        op.isLoading.value = false;
    }
}
