/**
 * SyncManager - Bidirectional sync between IDB and Firestore
 *
 * Handles:
 * - Push: Local changes → Firestore (from sync queue)
 * - Pull: Remote changes → IDB (polling for updates)
 * - LWW conflict resolution based on updatedAt
 *
 * Sync triggers:
 * - Timer: Every 10 minutes (configurable)
 * - Network: On 'online' event
 * - Manual: syncOnce() can be called directly
 */

import type { IDBAdapter } from '../storage/idbAdapter';
import type { FirestoreAdapter } from '../storage/firestoreAdapter';
import type { SyncQueueItem } from '../storage/db';
import type { TreeNode, DataField } from '../models';
import { db as firestoreDb } from '../firebase';
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { COLLECTIONS } from '../../constants';
import { now } from '../../utils/time';

export class SyncManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _enabled: boolean = true;
  private _isSyncing: boolean = false;

  constructor(
    private local: IDBAdapter,
    private remote: FirestoreAdapter,
    private pollIntervalMs: number = 600000 // 10 minutes
  ) {}

  /**
   * Start the sync manager.
   * Sets up periodic sync and online event listener.
   */
  start(): void {
    if (this.intervalId) return; // Already running

    // Start periodic sync
    this.intervalId = setInterval(() => {
      this.syncOnce().catch(err => {
        console.error('[SyncManager] Periodic sync failed:', err);
      });
    }, this.pollIntervalMs);

    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }

    console.log('[SyncManager] Started with poll interval:', this.pollIntervalMs, 'ms');
  }

  /**
   * Stop the sync manager.
   * Clears the timer and removes event listeners.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }

    console.log('[SyncManager] Stopped');
  }

  /**
   * Perform one sync cycle: push local changes, then pull remote changes.
   */
  async syncOnce(): Promise<void> {
    // Skip if disabled
    if (!this._enabled) {
      console.log('[SyncManager] Sync skipped (disabled)');
      return;
    }

    // Skip if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncManager] Sync skipped (offline)');
      return;
    }

    // Skip if already syncing
    if (this._isSyncing) {
      console.log('[SyncManager] Sync skipped (already in progress)');
      return;
    }

    this._isSyncing = true;
    console.log('[SyncManager] Starting sync cycle...');

    try {
      // Push local changes first
      await this.pushLocalChanges();

      // Then pull remote changes
      await this.pullRemoteChanges();

      // Update last sync timestamp
      await this.local.setLastSyncTimestamp(now());

      console.log('[SyncManager] Sync cycle complete');
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
  // Private: Push Logic
  // ============================================================================

  private async pushLocalChanges(): Promise<void> {
    const queue = await this.local.getSyncQueue();

    if (queue.length === 0) {
      console.log('[SyncManager] Push: No pending items');
      return;
    }

    console.log('[SyncManager] Push: Processing', queue.length, 'items');

    for (const item of queue) {
      try {
        await this.processSyncItem(item);
        await this.local.markSynced(item.id);
        console.log('[SyncManager] Push: Synced', item.operation, item.entityId);
      } catch (err) {
        console.error('[SyncManager] Push: Failed', item.operation, item.entityId, err);
        await this.local.markFailed(item.id, err);
      }
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create-node': {
        const node = item.payload as TreeNode;
        await setDoc(doc(firestoreDb, COLLECTIONS.NODES, node.id), node);
        break;
      }
      case 'update-node': {
        const node = item.payload as TreeNode;
        await setDoc(doc(firestoreDb, COLLECTIONS.NODES, node.id), node, { merge: true });
        break;
      }
      case 'delete-node': {
        await deleteDoc(doc(firestoreDb, COLLECTIONS.NODES, item.entityId));
        break;
      }
      case 'create-field': {
        const field = item.payload as DataField;
        await setDoc(doc(firestoreDb, COLLECTIONS.FIELDS, field.id), field);
        break;
      }
      case 'update-field': {
        const field = item.payload as DataField;
        await setDoc(doc(firestoreDb, COLLECTIONS.FIELDS, field.id), field, { merge: true });
        break;
      }
      case 'delete-field': {
        await deleteDoc(doc(firestoreDb, COLLECTIONS.FIELDS, item.entityId));
        break;
      }
      default:
        console.warn('[SyncManager] Unknown operation:', item.operation);
    }
  }

  // ============================================================================
  // Private: Pull Logic
  // ============================================================================

  private async pullRemoteChanges(): Promise<void> {
    const lastSync = await this.local.getLastSyncTimestamp();
    console.log('[SyncManager] Pull: Fetching changes since', new Date(lastSync).toISOString());

    // Pull nodes
    await this.pullRemoteNodes(lastSync);

    // Pull fields
    await this.pullRemoteFields(lastSync);
  }

  private async pullRemoteNodes(since: number): Promise<void> {
    try {
      const q = query(
        collection(firestoreDb, COLLECTIONS.NODES),
        where('updatedAt', '>', since)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        console.log('[SyncManager] Pull: No new nodes');
        return;
      }

      console.log('[SyncManager] Pull: Found', snap.size, 'updated nodes');

      for (const docSnap of snap.docs) {
        const remote = docSnap.data() as TreeNode;
        await this.applyRemoteNode(remote);
      }
    } catch (err) {
      console.error('[SyncManager] Pull nodes failed:', err);
    }
  }

  private async pullRemoteFields(since: number): Promise<void> {
    try {
      const q = query(
        collection(firestoreDb, COLLECTIONS.FIELDS),
        where('updatedAt', '>', since)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        console.log('[SyncManager] Pull: No new fields');
        return;
      }

      console.log('[SyncManager] Pull: Found', snap.size, 'updated fields');

      for (const docSnap of snap.docs) {
        const remote = docSnap.data() as DataField;
        await this.applyRemoteField(remote);
      }
    } catch (err) {
      console.error('[SyncManager] Pull fields failed:', err);
    }
  }

  // ============================================================================
  // Private: LWW Conflict Resolution
  // ============================================================================

  private async applyRemoteNode(remote: TreeNode): Promise<void> {
    const localResult = await this.local.getNode(remote.id);
    const local = localResult.data;

    if (!local) {
      // New node from remote, apply it
      await this.local.applyRemoteUpdate('node', remote);
      console.log('[SyncManager] LWW: Applied new remote node', remote.id);
      return;
    }

    // LWW: compare timestamps
    if (remote.updatedAt > local.updatedAt) {
      // Remote wins
      await this.local.applyRemoteUpdate('node', remote);
      console.log('[SyncManager] LWW: Remote node wins', remote.id);
    } else {
      // Local wins (or tie) - local is newer, it will be pushed in next sync
      console.log('[SyncManager] LWW: Local node wins', remote.id);
    }
  }

  private async applyRemoteField(remote: DataField): Promise<void> {
    const localFieldsResult = await this.local.listFields(remote.parentNodeId);
    const local = localFieldsResult.data.find(f => f.id === remote.id);

    if (!local) {
      // New field from remote, apply it
      await this.local.applyRemoteUpdate('field', remote);
      console.log('[SyncManager] LWW: Applied new remote field', remote.id);
      return;
    }

    // LWW: compare timestamps
    if (remote.updatedAt > local.updatedAt) {
      // Remote wins
      await this.local.applyRemoteUpdate('field', remote);
      console.log('[SyncManager] LWW: Remote field wins', remote.id);
    } else {
      // Local wins (or tie)
      console.log('[SyncManager] LWW: Local field wins', remote.id);
    }
  }

  // ============================================================================
  // Private: Event Handlers
  // ============================================================================

  private handleOnline = (): void => {
    console.log('[SyncManager] Network online - triggering sync');
    this.syncOnce().catch(err => {
      console.error('[SyncManager] Online sync failed:', err);
    });
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let syncManagerInstance: SyncManager | null = null;

/**
 * Get the global SyncManager instance.
 * Creates one if it doesn't exist.
 */
export function getSyncManager(local?: IDBAdapter, remote?: FirestoreAdapter): SyncManager {
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
export function initializeSyncManager(local: IDBAdapter, remote: FirestoreAdapter): SyncManager {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
  }
  syncManagerInstance = new SyncManager(local, remote);
  syncManagerInstance.start();
  return syncManagerInstance;
}
