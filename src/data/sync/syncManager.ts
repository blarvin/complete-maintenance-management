/**
 * SyncManager - Bidirectional sync orchestrator.
 *
 * Thin orchestration layer that composes focused collaborators:
 * - SyncPusher: Push local changes to remote
 * - SyncStrategy: Pull remote changes (FullCollectionSync, DeltaSync)
 * - SyncLifecycle: Timer and online event management
 * - ServerAuthorityResolver: Conflict resolution (server is truth)
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
import { now } from '../../utils/time';
import { dispatchStorageChangeEvent } from '../storage/storageEvents';
import { SyncPusher } from './SyncPusher';
import { SyncLifecycle } from './SyncLifecycle';
import { ServerAuthorityResolver } from './ServerAuthorityResolver';
import { FullCollectionSync, DeltaSync } from './strategies';
import type { SyncStrategy } from './strategies';

export class SyncManager {
  private _enabled: boolean = true;
  private _isSyncing: boolean = false;

  private readonly pusher: SyncPusher;
  private readonly deltaStrategy: SyncStrategy;
  private readonly fullStrategy: SyncStrategy;
  private readonly lifecycle: SyncLifecycle;
  private readonly local: SyncableStorageAdapter;

  constructor(
    local: SyncableStorageAdapter,
    remote: RemoteSyncAdapter,
    pollIntervalMs: number = 600000 // 10 minutes
  ) {
    this.local = local;

    // Initialize collaborators
    const resolver = new ServerAuthorityResolver(local);
    this.pusher = new SyncPusher(local, remote);
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
    console.log('[SyncManager] Started');
  }

  /**
   * Stop the sync manager.
   * Clears the timer and removes event listeners.
   */
  stop(): void {
    this.lifecycle.stop();
    console.log('[SyncManager] Stopped');
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
    console.log('[SyncManager] Starting delta sync cycle...');

    try {
      // Push local changes first
      await this.pusher.push();

      // Then pull remote changes (delta)
      console.log('[SyncManager] Pull: Starting', this.deltaStrategy.name, 'sync');
      await this.deltaStrategy.sync();

      // Update last sync timestamp
      await this.local.setLastSyncTimestamp(now());

      console.log('[SyncManager] Delta sync cycle complete');

      // Dispatch event to trigger UI updates
      dispatchStorageChangeEvent();
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
    console.log('[SyncManager] Starting full sync cycle...');

    try {
      // Push local changes first
      await this.pusher.push();

      // Then pull remote changes (full collection)
      console.log('[SyncManager] Pull: Starting', this.fullStrategy.name, 'sync');
      await this.fullStrategy.sync();

      // Update last sync timestamp
      await this.local.setLastSyncTimestamp(now());

      console.log('[SyncManager] Full sync cycle complete');

      // Dispatch event to trigger UI updates
      dispatchStorageChangeEvent();
    } catch (err) {
      console.error('[SyncManager] Full sync cycle failed:', err);
      // Don't rethrow - sync failures shouldn't crash the app
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Enable/disable sync.
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    console.log('[SyncManager] Enabled:', enabled);
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

  private canSync(): boolean {
    // Skip if disabled
    if (!this._enabled) {
      console.log('[SyncManager] Sync skipped (disabled)');
      return false;
    }

    // Skip if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncManager] Sync skipped (offline)');
      return false;
    }

    // Skip if already syncing
    if (this._isSyncing) {
      console.log('[SyncManager] Sync skipped (already in progress)');
      return false;
    }

    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let syncManagerInstance: SyncManager | null = null;

/**
 * Get the global SyncManager instance.
 * Creates one if it doesn't exist.
 */
export function getSyncManager(local?: SyncableStorageAdapter, remote?: RemoteSyncAdapter): SyncManager {
  if (!syncManagerInstance && local && remote) {
    syncManagerInstance = new SyncManager(local, remote);
  }
  if (!syncManagerInstance) {
    throw new Error('SyncManager not initialized. Call getSyncManager with adapters first.');
  }
  return syncManagerInstance;
}

/**
 * Initialize and start the SyncManager.
 * Call this during app initialization.
 */
export function initializeSyncManager(local: SyncableStorageAdapter, remote: RemoteSyncAdapter): SyncManager {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
  }
  syncManagerInstance = new SyncManager(local, remote);
  syncManagerInstance.start();
  return syncManagerInstance;
}

/**
 * Reset the singleton for testing purposes.
 */
export function resetSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
  }
  syncManagerInstance = null;
}
