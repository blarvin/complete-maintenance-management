/**
 * SyncPusher - Push local changes to remote.
 *
 * Processes the sync queue, applying each item to remote storage,
 * and marking items as synced or failed.
 */

import type { RemoteSyncAdapter } from '../storage/storageAdapter';
import type { SyncQueueManager } from './SyncQueueManager';
import { SYNC_WRITE_TIMEOUT_MS } from '../../constants';
import { withTimeout, TimeoutError } from '../../utils/withTimeout';

export type PushResult = {
  processed: number;
  succeeded: number;
  failed: number;
  /** Items whose retry budget was exhausted by this push (newly parked). */
  exhausted: number;
};

export class SyncPusher {
  constructor(
    private syncQueue: SyncQueueManager,
    private remote: RemoteSyncAdapter
  ) {}

  /**
   * Push all pending local changes to remote.
   * Returns counts of processed, succeeded, and failed items.
   */
  async push(): Promise<PushResult> {
    const queue = await this.syncQueue.getSyncQueue();

    if (queue.length === 0) {
      console.log('[SyncPusher] No pending items');
      return { processed: 0, succeeded: 0, failed: 0, exhausted: 0 };
    }

    console.log('[SyncPusher] Processing', queue.length, 'items');

    let succeeded = 0;
    let failed = 0;
    let exhausted = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        // Firestore never rejects writes against an unreachable server (it
        // buffers and retries the transport forever), so race a timeout.
        await withTimeout(
          this.remote.applySyncItem(item),
          SYNC_WRITE_TIMEOUT_MS,
          `applySyncItem(${item.operation} ${item.entityId})`
        );
        await this.syncQueue.markSynced(item.id);
        console.log('[SyncPusher] Synced', item.operation, item.entityId);
        succeeded++;
      } catch (err) {
        console.error('[SyncPusher] Failed', item.operation, item.entityId, err);
        const isExhausted = await this.syncQueue.markFailed(item.id, err);
        if (isExhausted) exhausted++;
        failed++;

        // A timeout means the connection is down, not that this item is bad.
        // Fail the rest of the queue in lockstep (no point waiting out a
        // timeout per item) so all items exhaust on the same cycle and the
        // user gets one toast instead of a drip-feed.
        if (err instanceof TimeoutError) {
          for (const rest of queue.slice(i + 1)) {
            const restExhausted = await this.syncQueue.markFailed(rest.id, err);
            if (restExhausted) exhausted++;
            failed++;
          }
          break;
        }
      }
    }

    return { processed: queue.length, succeeded, failed, exhausted };
  }
}
