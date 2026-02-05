/**
 * SyncQueueManager - Manages the sync queue independently of storage adapters.
 *
 * Extracted from IDBAdapter (SRP) so the adapter handles only storage
 * and the queue is a standalone concern consumed by SyncPusher,
 * ServerAuthorityResolver, and FullCollectionSync.
 */

import { db } from '../storage/db';
import type { SyncQueueItem, SyncOperation } from '../storage/db';
import { generateId } from '../../utils/id';
import { now } from '../../utils/time';

export type EnqueueParams = {
  operation: SyncOperation;
  entityType: 'node' | 'field' | 'field-history';
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

export interface SyncQueueManager {
  getSyncQueue(): Promise<SyncQueueItem[]>;
  enqueue(params: EnqueueParams): Promise<void>;
  markSynced(queueItemId: string): Promise<void>;
  markFailed(queueItemId: string, error: unknown): Promise<void>;
}

export class IDBSyncQueueManager implements SyncQueueManager {
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const items = await db.syncQueue.where('status').equals('pending').toArray();
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
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

  async markFailed(queueItemId: string, error: unknown): Promise<void> {
    const item = await db.syncQueue.get(queueItemId);
    if (!item) return;

    const message = error instanceof Error ? error.message : String(error);
    await db.syncQueue.update(queueItemId, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastError: message,
    });
  }
}
