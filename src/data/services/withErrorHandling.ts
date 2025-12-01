/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling patterns for async operations.
 * Phase 1: Logs errors with context and returns fallback values.
 * Future: Can add snackbar notifications, error monitoring/reporting.
 */

/**
 * Wrap an async operation with error handling.
 * Returns fallback value on error instead of throwing.
 * 
 * @param operation - The async function to execute
 * @param fallback - Value to return if operation fails
 * @param context - Optional context string for error logging
 * @returns The operation result or fallback on error
 * 
 * @example
 * const nodes = await safeAsync(
 *   () => nodeService.getRootNodes(),
 *   [],
 *   'RootView.loadNodes'
 * );
 */
export async function safeAsync<T>(
    operation: () => Promise<T>,
    fallback: T,
    context?: string
): Promise<T> {
    try {
        return await operation();
    } catch (err) {
        console.error(`[${context ?? 'Error'}]`, err);
        // Future: show snackbar notification
        // Future: report to error monitoring service
        return fallback;
    }
}

/**
 * Wrap an async operation that may fail silently (fire-and-forget).
 * Logs errors but doesn't return a value.
 * Use for operations where failure is acceptable (e.g., analytics, non-critical updates).
 * 
 * @param operation - The async function to execute
 * @param context - Optional context string for error logging
 * 
 * @example
 * await safeAsyncVoid(
 *   () => analytics.trackEvent('page_view'),
 *   'Analytics.trackEvent'
 * );
 */
export async function safeAsyncVoid(
    operation: () => Promise<void>,
    context?: string
): Promise<void> {
    try {
        await operation();
    } catch (err) {
        console.error(`[${context ?? 'Error'}]`, err);
        // Future: report to error monitoring service
    }
}

/**
 * Create a wrapped version of a function with error handling.
 * Useful for creating safe versions of service methods.
 * 
 * @param fn - The function to wrap
 * @param fallback - Value to return on error
 * @param context - Context string for error logging
 * @returns Wrapped function with error handling
 * 
 * @example
 * const safeGetRootNodes = withSafeAsync(
 *   nodeService.getRootNodes,
 *   [],
 *   'nodeService.getRootNodes'
 * );
 */
export function withSafeAsync<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    fallback: TReturn,
    context?: string
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs) => {
        try {
            return await fn(...args);
        } catch (err) {
            console.error(`[${context ?? 'Error'}]`, err);
            return fallback;
        }
    };
}

