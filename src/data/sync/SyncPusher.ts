/**
 * SyncPusher - Push local changes to remote.
 *
 * Processes the sync queue, applying each item to remote storage,
 * and marking items as synced or failed.
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../storage/storageAdapter';

export type PushResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

export class SyncPusher {
  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter
  ) {}

  /**
   * Push all pending local changes to remote.
   * Returns counts of processed, succeeded, and failed items.
   */
  async push(): Promise<PushResult> {
    const queue = await this.local.getSyncQueue();

    if (queue.length === 0) {
      console.log('[SyncPusher] No pending items');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log('[SyncPusher] Processing', queue.length, 'items');

    let succeeded = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await this.remote.applySyncItem(item);
        await this.local.markSynced(item.id);
        console.log('[SyncPusher] Synced', item.operation, item.entityId);
        succeeded++;
      } catch (err) {
        console.error('[SyncPusher] Failed', item.operation, item.entityId, err);
        await this.local.markFailed(item.id, err);
        failed++;
      }
    }

    return { processed: queue.length, succeeded, failed };
  }
}
