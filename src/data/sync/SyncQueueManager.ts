/**
 * SyncQueueManager - Manages the sync queue independently of storage adapters.
 *
 * Extracted from IDBAdapter (SRP) so the adapter handles only storage
 * and the queue is a standalone concern consumed by SyncPusher,
 * ServerAuthorityResolver, and FullCollectionSync.
 */

import { db } from '../storage/db';
import type { SyncQueueItem, SyncOperation } from '../storage/db';
import { MAX_SYNC_RETRIES } from '../../constants';
import { generateId } from '../../utils/id';
import { now } from '../../utils/time';

export type EnqueueParams = {
  operation: SyncOperation;
  entityType: 'element' | 'element-history';
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

export interface SyncQueueManager {
  getSyncQueue(): Promise<SyncQueueItem[]>;
  enqueue(params: EnqueueParams): Promise<void>;
  markSynced(queueItemId: string): Promise<void>;
  /** Returns true when this failure exhausts the item's retry budget. */
  markFailed(queueItemId: string, error: unknown): Promise<boolean>;
  /** Re-arm all failed items (fresh retry budget). Returns how many were re-armed. */
  requeueFailed(): Promise<number>;
}

export class IDBSyncQueueManager implements SyncQueueManager {
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    // Failed items ride subsequent sync cycles until their retry budget is
    // exhausted; exhausted items are parked until requeueFailed() re-arms them.
    const items = await db.syncQueue.where('status').anyOf('pending', 'failed').toArray();
    const retryable = items.filter(
      item => !(item.status === 'failed' && item.retryCount >= MAX_SYNC_RETRIES)
    );
    retryable.sort((a, b) => a.timestamp - b.timestamp);
    return retryable;
  }

  async enqueue(params: EnqueueParams): Promise<void> {
    const item: SyncQueueItem = {
      id: generateId(),
      operation: params.operation,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      timestamp: now(),
      status: 'pending',
      retryCount: 0,
    };

    await db.syncQueue.put(item);
  }

  async markSynced(queueItemId: string): Promise<void> {
    await db.syncQueue.delete(queueItemId);
  }

  async markFailed(queueItemId: string, error: unknown): Promise<boolean> {
    const item = await db.syncQueue.get(queueItemId);
    if (!item) return false;

    const message = error instanceof Error ? error.message : String(error);
    const retryCount = item.retryCount + 1;
    await db.syncQueue.update(queueItemId, {
      status: 'failed',
      retryCount,
      lastError: message,
    });
    return retryCount >= MAX_SYNC_RETRIES;
  }

  async requeueFailed(): Promise<number> {
    // Keep lastError for forensics; only status and retryCount reset.
    return db.syncQueue
      .where('status')
      .equals('failed')
      .modify({ status: 'pending', retryCount: 0 });
  }
}
