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

/** Placeholder shown when a timestamp is missing or unparseable. */
const INVALID_TS = '—';

/** True when `ts` is a finite epoch-ms number that yields a valid Date. */
const isValidTs = (ts: number | null | undefined): ts is number =>
    ts != null && Number.isFinite(ts) && !Number.isNaN(new Date(ts).getTime());

/**
 * Format a timestamp for display.
 * Returns locale-appropriate date/time string with seconds, or "—" if missing/invalid.
 */
export const formatTimestamp = (ts: number | null | undefined): string =>
    isValidTs(ts) ? new Date(ts).toLocaleString() : INVALID_TS;

/**
 * Format a timestamp for display without seconds.
 * Returns locale-appropriate date/time string (e.g., "11/30/2025 10:55 PM"),
 * or "—" if missing/invalid.
 */
export const formatTimestampShort = (ts: number | null | undefined): string =>
    isValidTs(ts)
        ? new Date(ts).toLocaleString(undefined, {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : INVALID_TS;

