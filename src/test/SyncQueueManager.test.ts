/**
 * IDBSyncQueueManager retry semantics (audit §4.3):
 * - getSyncQueue() includes failed items still under the retry cap and
 *   excludes exhausted ones.
 * - markFailed() reports exactly when the cap is reached.
 * - requeueFailed() re-arms all failed items with a fresh budget.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import type { SyncQueueItem } from '../data/storage/db';
import { IDBSyncQueueManager } from '../data/sync/SyncQueueManager';
import { MAX_SYNC_RETRIES } from '../constants';

const makeItem = (overrides: Partial<SyncQueueItem>): SyncQueueItem => ({
  id: 'q1',
  operation: 'create-element',
  entityType: 'element',
  entityId: 'el-1',
  payload: {},
  timestamp: 1000,
  status: 'pending',
  retryCount: 0,
  ...overrides,
});

describe('IDBSyncQueueManager — retry budget', () => {
  let queue: IDBSyncQueueManager;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    queue = new IDBSyncQueueManager();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('getSyncQueue', () => {
    it('includes failed items under the retry cap, sorted by timestamp', async () => {
      await db.syncQueue.bulkPut([
        makeItem({ id: 'q1', status: 'failed', retryCount: MAX_SYNC_RETRIES - 1, timestamp: 2000 }),
        makeItem({ id: 'q2', status: 'pending', timestamp: 1000 }),
      ]);

      const items = await queue.getSyncQueue();

      expect(items.map(i => i.id)).toEqual(['q2', 'q1']);
    });

    it('excludes failed items at the retry cap', async () => {
      await db.syncQueue.bulkPut([
        makeItem({ id: 'q1', status: 'failed', retryCount: MAX_SYNC_RETRIES }),
        makeItem({ id: 'q2', status: 'pending', timestamp: 2000 }),
      ]);

      const items = await queue.getSyncQueue();

      expect(items.map(i => i.id)).toEqual(['q2']);
    });
  });

  describe('markFailed', () => {
    it('returns false while retry budget remains, true exactly at the cap', async () => {
      await db.syncQueue.put(makeItem({ id: 'q1' }));

      for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
        const exhausted = await queue.markFailed('q1', new Error(`fail ${attempt}`));
        expect(exhausted).toBe(attempt === MAX_SYNC_RETRIES);
      }

      const item = await db.syncQueue.get('q1');
      expect(item).toMatchObject({
        status: 'failed',
        retryCount: MAX_SYNC_RETRIES,
        lastError: `fail ${MAX_SYNC_RETRIES}`,
      });
    });

    it('returns false for an unknown item', async () => {
      expect(await queue.markFailed('missing', new Error('x'))).toBe(false);
    });
  });

  describe('requeueFailed', () => {
    it('resets failed items to pending with zero retryCount, keeping lastError', async () => {
      await db.syncQueue.bulkPut([
        makeItem({ id: 'q1', status: 'failed', retryCount: MAX_SYNC_RETRIES, lastError: 'boom' }),
        makeItem({ id: 'q2', status: 'failed', retryCount: 2, lastError: 'pop' }),
        makeItem({ id: 'q3', status: 'pending' }),
      ]);

      const requeued = await queue.requeueFailed();

      expect(requeued).toBe(2);
      const q1 = await db.syncQueue.get('q1');
      expect(q1).toMatchObject({ status: 'pending', retryCount: 0, lastError: 'boom' });
      const pending = await db.syncQueue.where('status').equals('pending').count();
      expect(pending).toBe(3);
    });

    it('returns 0 when nothing is failed', async () => {
      await db.syncQueue.put(makeItem({ id: 'q1' }));
      expect(await queue.requeueFailed()).toBe(0);
    });
  });
});
