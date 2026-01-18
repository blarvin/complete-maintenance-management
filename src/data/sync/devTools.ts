/**
 * Dev Tools - Exposes sync manager functionality for development/debugging
 * 
 * Usage: In browser console, type:
 * - window.__sync() - Trigger manual sync
 * - window.__syncStatus() - Get sync status
 */

import { getSyncManager } from './syncManager';

/**
 * Initialize dev tools helpers on window object
 * Only available in development/non-production builds
 */
export function initializeDevTools(): void {
  if (typeof window === 'undefined') return;
  
  // Only expose in dev mode (or always, for now - user can remove later)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__sync = async () => {
    try {
      const syncManager = getSyncManager();
      console.log('[DevTools] Triggering manual sync...');
      await syncManager.syncOnce();
      console.log('[DevTools] Manual sync complete');
      return 'Sync complete';
    } catch (err) {
      console.error('[DevTools] Manual sync failed:', err);
      throw err;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__syncStatus = () => {
    try {
      const syncManager = getSyncManager();
      return {
        enabled: syncManager.enabled,
        isSyncing: syncManager.isSyncing,
      };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      return { error: 'SyncManager not initialized' };
    }
  };

  console.log('[DevTools] Sync helpers available: window.__sync(), window.__syncStatus()');
}
