/**
 * Dev Tools - Exposes sync manager functionality for development/debugging
 * 
 * Usage: In browser console, type:
 * - window.__sync() - Trigger manual sync
 * - window.__syncStatus() - Get sync status
 */

import { getSyncManager } from './syncManager';
import { db } from '../storage/db';
import { SEED_KEY } from '../services/seedDefinitions';

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
  (window as any).__syncStatus = async () => {
    try {
      const syncManager = getSyncManager();
      const queue = await db.syncQueue.toArray();
      return {
        enabled: syncManager.enabled,
        isSyncing: syncManager.isSyncing,
        queueLength: queue.length,
        queue: queue.map(({ id, operation, entityId, status, retryCount, lastError }) =>
          ({ id, operation, entityId, status, retryCount, lastError })),
      };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      return { error: 'SyncManager not initialized' };
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__wipeDefinitions = async () => {
    try {
      // The Library is now `library`-tree Elements (Definitions + their config
      // sub-field children), not a separate table — clear all of them.
      const libraryEls = await db.elements.where('treeType').equals('library').toArray();
      const defCount = libraryEls.filter(e => e.parentId === null).length;
      await db.transaction('rw', [db.elements, db.syncMetadata], async () => {
        await db.elements.bulkDelete(libraryEls.map(e => e.id));
        // Reset the seed-version key so seedDefinitions() runs again on the
        // next reload, restoring the dev seeds (factory-default reset). To keep
        // the set genuinely empty instead, pin it: put({ key: SEED_KEY, value: SEED_VERSION }).
        await db.syncMetadata.delete(SEED_KEY);
      });
      console.log(`[DevTools] Cleared ${defCount} Definition(s) from IDB. Reload to re-seed the defaults.`);
      return `Cleared ${defCount} Definition(s) from IDB — reload to re-seed defaults`;
    } catch (err) {
      console.error('[DevTools] Wipe Definitions failed:', err);
      throw err;
    }
  };

  console.log('[DevTools] Sync helpers available: window.__sync(), window.__syncStatus(), window.__wipeDefinitions()');
}
