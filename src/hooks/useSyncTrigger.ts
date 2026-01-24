/**
 * useSyncTrigger - Debounced sync trigger for CUD operations.
 * 
 * Call triggerSync() after any create, update, delete, or revert operation.
 * The debounce batches rapid edits so we don't spam the server.
 */

import { getSyncManager } from '../data/sync/syncManager';

const DEBOUNCE_MS = 500;

let timeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Trigger a debounced delta sync.
 * Safe to call frequently - will only sync 500ms after the last call.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function triggerSync(): void {
  // Clear any pending sync
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }
  
  // Schedule new sync after debounce window
  timeoutId = setTimeout(() => {
    timeoutId = null;
    getSyncManager()
      .syncDelta()
      .catch((err) => console.error('[triggerSync] Sync failed:', err));
  }, DEBOUNCE_MS);
}

/**
 * Cancel any pending sync (useful for cleanup/testing).
 */
export function cancelPendingSync(): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
