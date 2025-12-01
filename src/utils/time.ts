/**
 * Timestamp utilities.
 * Centralizes timestamp generation for consistency and testability.
 * 
 * Phase 1: Client-assigned timestamps via Date.now()
 * Future: Can swap to server-assigned timestamps, mock for tests, etc.
 */

/**
 * Get current timestamp in milliseconds (epoch time).
 * Use this instead of Date.now() directly for consistency.
 */
export const now = (): number => Date.now();

/**
 * Format a timestamp for display.
 * Returns locale-appropriate date/time string with seconds.
 */
export const formatTimestamp = (ts: number): string => 
    new Date(ts).toLocaleString();

/**
 * Format a timestamp for display without seconds.
 * Returns locale-appropriate date/time string (e.g., "11/30/2025 10:55 PM").
 */
export const formatTimestampShort = (ts: number): string => 
    new Date(ts).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

