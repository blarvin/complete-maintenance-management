/**
 * SyncManager - Bidirectional sync orchestrator.
 *
 * Thin orchestration layer that composes focused collaborators:
 * - SyncPusher: Push local changes to remote
 * - SyncStrategy: Pull remote changes (FullCollectionSync, etc.)
 * - SyncLifecycle: Timer and online event management
 * - LWWResolver: Conflict resolution
 *
 * Sync triggers:
 * - Timer: Every 10 minutes (configurable)
 * - Network: On 'online' event
 * - Manual: syncOnce() can be called directly
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../storage/storageAdapter';
import { now } from '../../utils/time';
import { dispatchStorageChangeEvent } from '../storage/storageEvents';
import { SyncPusher } from './SyncPusher';
import { SyncLifecycle } from './SyncLifecycle';
import { LWWResolver } from './LWWResolver';
import { FullCollectionSync } from './strategies';
import type { SyncStrategy } from './strategies';

export class SyncManager {
  private _enabled: boolean = true;
  private _isSyncing: boolean = false;

  private readonly pusher: SyncPusher;
  private readonly strategy: SyncStrategy;
  private readonly lifecycle: SyncLifecycle;
  private readonly local: SyncableStorageAdapter;

  constructor(
    local: SyncableStorageAdapter,
    remote: RemoteSyncAdapter,
    pollIntervalMs: number = 600000 // 10 minutes
  ) {
    this.local = local;

    // Initialize collaborators
    const resolver = new LWWResolver(local);
    this.pusher = new SyncPusher(local, remote);
    this.strategy = new FullCollectionSync(local, remote, resolver);
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
   */
  async syncOnce(): Promise<void> {
    if (!this.canSync()) return;

    this._isSyncing = true;
    console.log('[SyncManager] Starting sync cycle...');

    try {
      // Push local changes first
      await this.pusher.push();

      // Then pull remote changes
      console.log('[SyncManager] Pull: Starting', this.strategy.name, 'sync');
      await this.strategy.sync();

      // Update last sync timestamp
      await this.local.setLastSyncTimestamp(now());

      console.log('[SyncManager] Sync cycle complete');

      // Dispatch event to trigger UI updates
      dispatchStorageChangeEvent();
    } catch (err) {
      console.error('[SyncManager] Sync cycle failed:', err);
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
