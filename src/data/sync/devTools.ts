/**
 * Dev-only browser-console helpers, all registered behind one gate.
 *
 * In the console:
 * - `await window.__sync()`             — run one sync cycle now
 * - `await window.__syncStatus()`       — sync queue: status, retries, errors
 * - `await window.__wipeDefinitions()`  — drop the Library and reload; the pack re-seeds
 * - `await window.__wipeLocal()`        — delete the whole local DB and reload
 * - `await window.__mintDemoTree()`     — mint the dev example asset tree
 *
 * Gated on `DEV_TOOLS_ENABLED` (utils/devMode), so an ordinary visit to the
 * deployed app gets no globals — but `preview:pwa` and emulator-mode sessions,
 * where these are actually used, keep them. `__syncStatus` doubles as Cypress's
 * storage-init readiness signal (cypress/support/e2e.ts), which works because
 * Cypress drives the dev server.
 */

import { getSyncManager } from './syncManager';
import { db } from '../storage/db';
import { clearStorage } from '../storage/initStorage';
import { BOOTSTRAP_POPULATIONS, bootstrapKey } from '../services/bootstrap';
import { isDefinitionRow } from '../libraryChrome';
import { mintDemoTree } from '../fixtures/demoTree';
import { DEV_TOOLS_ENABLED } from '../../utils/devMode';

/** Register the console helpers on `window`. No-op unless the dev gate is open. */
export function initializeDevTools(): void {
  if (typeof window === 'undefined') return;
  if (!DEV_TOOLS_ENABLED) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  w.__sync = async () => {
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

  w.__syncStatus = async () => {
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

  /**
   * Drop the whole `library` tree and reload, which re-seeds it from the bundled
   * pack — these Definitions are what every node is born with, not scaffolding.
   * To keep the set genuinely empty instead, pin the population keys after
   * wiping: `put({ key: bootstrapKey(id), value: revision })` for each.
   *
   * Reloads, like `__wipeLocal()`: the un-reloaded window was a real hazard, not
   * a nicety. Anything minted between the wipe and a manual reload stamped
   * `definitionId: null` on its lenses and lost its construction defaults, since
   * both stamp only what resolves. (`restampUnboundLenses` now repairs the lens
   * half on the next boot; the defaults half is reported, not recoverable.)
   */
  w.__wipeDefinitions = async () => {
    try {
      // The Library is `library`-tree Elements (Definitions + their config
      // sub-field children), not a separate table — clear all of them.
      const libraryEls = await db.elements.where('treeType').equals('library').toArray();
      // Count real Definitions (chrome rows are cleared too, but aren't counted).
      const defCount = libraryEls.filter(isDefinitionRow).length;
      await db.transaction('rw', [db.elements, db.syncMetadata], async () => {
        await db.elements.bulkDelete(libraryEls.map(e => e.id));
        // Both populations own rows in this tree, so both revision keys reset.
        for (const population of BOOTSTRAP_POPULATIONS) {
          await db.syncMetadata.delete(bootstrapKey(population.id));
        }
      });
      console.log(`[DevTools] Cleared ${defCount} Definition(s) from IDB — reloading to re-seed from the bundled pack.`);
      window.location.reload();
      return `Cleared ${defCount} Definition(s) from IDB — reloading to re-seed from the bundled pack`;
    } catch (err) {
      console.error('[DevTools] Wipe Definitions failed:', err);
      throw err;
    }
  };

  /**
   * Delete the local database outright and reload.
   *
   * This is the replacement for a workflow the sync layer used to provide by
   * accident: wipe the server, restart, and the full sync's purge would clear
   * the client to match. That purge is gone (retention is the default now —
   * IMPLEMENTATION.md → *Retention over reconciliation*), so resetting the
   * client is an explicit local act. It never
   * touches the server, which is the point: a local reset and a remote wipe are
   * different intentions and should be different commands.
   *
   * Reload is not optional — `clearStorage()` drops the Dexie database out from
   * under a running app, so the page must re-init against a fresh store.
   */
  w.__wipeLocal = async () => {
    try {
      await clearStorage();
      console.log('[DevTools] Local database deleted — reloading...');
      window.location.reload();
      return 'Local database deleted — reloading';
    } catch (err) {
      console.error('[DevTools] Wipe local failed:', err);
      throw err;
    }
  };

  /**
   * Mint the dev example asset tree (src/data/fixtures/demoTree.ts) — three
   * business roots of assets with filled fields, jobs and log entries, all
   * through the command bus. Idempotent: a second call reports and writes
   * nothing. Fixture data, not pack content — see the module docblock.
   */
  w.__mintDemoTree = async () => {
    try {
      const result = await mintDemoTree();
      console.log('[DevTools]', result);
      return result;
    } catch (err) {
      console.error('[DevTools] Mint demo tree failed:', err);
      throw err;
    }
  };

  console.log(
    '[DevTools] Console helpers: window.__sync(), __syncStatus(), __wipeDefinitions(), __wipeLocal(), __mintDemoTree()'
  );
}
