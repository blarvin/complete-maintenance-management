/**
 * SyncManager - Bidirectional sync orchestrator.
 *
 * Thin orchestration layer that composes focused collaborators:
 * - SyncPusher: Push local changes to remote
 * - SyncStrategy: Pull remote changes (FullCollectionSync, DeltaSync)
 * - SyncLifecycle: Timer and online event management
 * - ServerAuthorityResolver: Conflict resolution (server is truth)
 * - SyncQueueManager: Sync queue operations (extracted from IDBAdapter)
 *
 * Sync strategies:
 * - syncDelta(): Fast incremental sync (only changes since last sync)
 * - syncFull(): Complete sync (all entities, used on startup)
 * - syncOnce(): Default sync (uses delta for speed)
 *
 * Sync triggers:
 * - Timer: Every 10 minutes (configurable)
 * - Network: On 'online' event
 * - Manual: syncOnce(), syncDelta(), syncFull() can be called directly
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../storage/storageAdapter';
import type { SyncQueueManager } from './SyncQueueManager';
import { getSnackbarService } from '../../services/snackbar';
import { SYNC_PULL_TIMEOUT_MS } from '../../constants';
import { withTimeout } from '../../utils/withTimeout';
import { devLog } from '../../utils/devMode';
import { SyncPusher } from './SyncPusher';
import type { PushResult } from './SyncPusher';
import { SyncLifecycle } from './SyncLifecycle';
import { ServerAuthorityResolver } from './ServerAuthorityResolver';
import { FullCollectionSync, DeltaSync } from './strategies';
import type { SyncStrategy } from './strategies';

/**
 * Retry action for the exhausted-retries toast. Kept as a dynamic import of
 * retryFailedSync — a static import would create a module cycle
 * (retryFailedSync.ts imports getSyncManager back from this module).
 * Captures nothing; resolves getSyncManager at invoke time per the
 * registry-getter pattern.
 */
export const retryFailedSyncAction = async (): Promise<void> => {
  const { retryFailedSync } = await import('./retryFailedSync');
  await retryFailedSync();
};

export class SyncManager {
  private _enabled: boolean = true;
  private _isSyncing: boolean = false;

  private readonly pusher: SyncPusher;
  private readonly deltaStrategy: SyncStrategy;
  private readonly fullStrategy: SyncStrategy;
  private readonly lifecycle: SyncLifecycle;
  private readonly local: SyncableStorageAdapter;
  private readonly syncQueue: SyncQueueManager;

  constructor(
    local: SyncableStorageAdapter,
    remote: RemoteSyncAdapter,
    syncQueue: SyncQueueManager,
    pollIntervalMs: number = 600000 // 10 minutes
  ) {
    this.local = local;
    this.syncQueue = syncQueue;

    // Initialize collaborators
    const resolver = new ServerAuthorityResolver(local, syncQueue);
    this.pusher = new SyncPusher(syncQueue, remote);
    this.deltaStrategy = new DeltaSync(local, remote, resolver);
    this.fullStrategy = new FullCollectionSync(local, remote, resolver);
    this.lifecycle = new SyncLifecycle(() => this.syncOnce(), pollIntervalMs);
  }

  /**
   * Start the sync manager.
   * Sets up periodic sync and online event listener.
   */
  start(): void {
    this.lifecycle.start();
    devLog('[SyncManager] Started');
  }

  /**
   * Stop the sync manager.
   * Clears the timer and removes event listeners.
   */
  stop(): void {
    this.lifecycle.stop();
    devLog('[SyncManager] Stopped');
  }

  /**
   * Perform one sync cycle: push local changes, then pull remote changes.
   * Uses delta sync by default for speed.
   */
  async syncOnce(): Promise<void> {
    return this.syncDelta();
  }

  /**
   * Fast delta sync: only pulls changes since last sync.
   * Detects soft deletes via updatedAt timestamp.
   */
  async syncDelta(): Promise<void> {
    if (!this.canSync()) return;

    this._isSyncing = true;
    devLog('[SyncManager] Starting delta sync cycle...');

    try {
      // Push local changes first
      const pushResult = await this.pusher.push();
      this.notifyIfExhausted(pushResult);

      // Then pull remote changes (delta). Timeout so a hung pull can't wedge
      // _isSyncing and silently stop all future cycles.
      devLog('[SyncManager] Pull: Starting', this.deltaStrategy.name, 'sync');
      const result = await withTimeout(
        this.deltaStrategy.sync(),
        SYNC_PULL_TIMEOUT_MS,
        'delta pull'
      );

      await this.advanceCursor(result.highWaterMark);

      devLog('[SyncManager] Delta sync cycle complete');
      // UI updates arrive via per-element storageEventBus emissions from
      // IDBAdapter.applyRemoteElement (which also re-signals the Composer for
      // arriving `library`-tree Definitions).
    } catch (err) {
      console.error('[SyncManager] Delta sync cycle failed:', err);
      // Don't rethrow - sync failures shouldn't crash the app
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Full collection sync: pulls all entities for complete reconciliation.
   * Used on startup or periodically as a safety net.
   */
  async syncFull(): Promise<void> {
    if (!this.canSync()) return;

    this._isSyncing = true;
    devLog('[SyncManager] Starting full sync cycle...');

    try {
      // Push local changes first
      const pushResult = await this.pusher.push();
      this.notifyIfExhausted(pushResult);

      // Then pull remote changes (full collection). Timeout so a hung pull
      // can't wedge _isSyncing and silently stop all future cycles.
      devLog('[SyncManager] Pull: Starting', this.fullStrategy.name, 'sync');
      const result = await withTimeout(
        this.fullStrategy.sync(),
        SYNC_PULL_TIMEOUT_MS,
        'full pull'
      );

      await this.advanceCursor(result.highWaterMark);

      devLog('[SyncManager] Full sync cycle complete');
    } catch (err) {
      console.error('[SyncManager] Full sync cycle failed:', err);
      // Don't rethrow - sync failures shouldn't crash the app
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Re-arm all exhausted/failed queue items with a fresh retry budget and
   * sync immediately. Invoked by the exhausted-retries toast's Retry action.
   */
  async retryFailed(): Promise<void> {
    const requeued = await this.syncQueue.requeueFailed();
    devLog('[SyncManager] Re-armed', requeued, 'failed item(s)');
    await this.syncOnce();
  }

  /**
   * Enable/disable sync.
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    devLog('[SyncManager] Enabled:', enabled);
  }

  /**
   * Check if sync is enabled.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Check if currently syncing.
   */
  get isSyncing(): boolean {
    return this._isSyncing;
  }

  // ============================================================================
  // Private
  // ============================================================================

  /**
   * Surface newly exhausted items as an error toast with a Retry action.
   * Self-limiting: an item only becomes exhausted once (it then drops out of
   * getSyncQueue()), so this fires on that one cycle, not every cycle.
   */
  /**
   * Move the delta cursor to the newest row the pull actually received.
   *
   * It used to be `now()`, the local clock, compared by the next pull against
   * `updatedAt` values stamped by `serverTimestamp()` — a client running ahead
   * of the server wrote a cursor past rows it had never seen, and those rows
   * stayed invisible until the next startup `syncFull()` (IMPLEMENTATION.md →
   * *The delta cursor is a high-water mark, not the clock*).
   *
   * A pull that returned nothing leaves the cursor alone. Advancing on an empty
   * window is what created the gap in the first place; re-querying it next
   * cycle costs one round trip and nothing else. Deliberately not clamped to
   * monotonic — see the repair note in `FullCollectionSync.sync`.
   */
  private async advanceCursor(highWaterMark: number | null): Promise<void> {
    if (highWaterMark === null) {
      devLog('[SyncManager] Cursor unchanged (pull returned no rows)');
      return;
    }
    await this.local.setLastSyncTimestamp(highWaterMark);
    devLog('[SyncManager] Cursor advanced to', highWaterMark);
  }

  private notifyIfExhausted(pushResult: PushResult): void {
    if (pushResult.exhausted === 0) return;
    getSnackbarService().show({
      message: `${pushResult.exhausted} change(s) failed to sync`,
      variant: 'error',
      action: { label: 'Retry', handler: retryFailedSyncAction },
    });
  }

  private canSync(): boolean {
    // Skip if disabled
    if (!this._enabled) {
      devLog('[SyncManager] Sync skipped (disabled)');
      return false;
    }

    // Skip if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      devLog('[SyncManager] Sync skipped (offline)');
      return false;
    }

    // Skip if already syncing
    if (this._isSyncing) {
      devLog('[SyncManager] Sync skipped (already in progress)');
      return false;
    }

    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Pinned on globalThis so it survives dev-server (Vite) module re-evaluation:
 * initializeSyncManager must stop the *live* manager, not a fresh module
 * copy's null — a leaked previous instance keeps its sync timer and online
 * listener running forever, giving concurrent sync loops.
 */
const holder = globalThis as typeof globalThis & { __cmmSyncManager?: SyncManager | null };

/**
 * Get the global SyncManager instance.
 * Creates one if it doesn't exist.
 */
export function getSyncManager(
  local?: SyncableStorageAdapter,
  remote?: RemoteSyncAdapter,
  syncQueue?: SyncQueueManager
): SyncManager {
  if (!holder.__cmmSyncManager && local && remote && syncQueue) {
    holder.__cmmSyncManager = new SyncManager(local, remote, syncQueue);
  }
  if (!holder.__cmmSyncManager) {
    throw new Error('SyncManager not initialized. Call getSyncManager with adapters first.');
  }
  return holder.__cmmSyncManager;
}

/**
 * Initialize and start the SyncManager.
 * Call this during app initialization.
 */
export function initializeSyncManager(
  local: SyncableStorageAdapter,
  remote: RemoteSyncAdapter,
  syncQueue: SyncQueueManager
): SyncManager {
  if (holder.__cmmSyncManager) {
    holder.__cmmSyncManager.stop();
  }
  const instance = new SyncManager(local, remote, syncQueue);
  holder.__cmmSyncManager = instance;
  instance.start();
  return instance;
}

/**
 * Reset the singleton for testing purposes.
 */
export function resetSyncManager(): void {
  if (holder.__cmmSyncManager) {
    holder.__cmmSyncManager.stop();
  }
  holder.__cmmSyncManager = null;
}
