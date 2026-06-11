/**
 * Unit tests for SyncPusher - Push local changes to remote.
 *
 * Tests queue processing in isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncPusher } from '../data/sync/SyncPusher';
import type { RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { SyncQueueItem } from '../data/storage/db';
import { SYNC_WRITE_TIMEOUT_MS } from '../constants';
import { TimeoutError } from '../utils/withTimeout';

describe('SyncPusher', () => {
  let mockSyncQueue: SyncQueueManager;
  let mockRemote: RemoteSyncAdapter;
  let pusher: SyncPusher;

  beforeEach(() => {
    mockSyncQueue = {
      getSyncQueue: vi.fn(),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(false),
      requeueFailed: vi.fn(),
    };

    mockRemote = {
      applySyncItem: vi.fn(),
    } as unknown as RemoteSyncAdapter;

    pusher = new SyncPusher(mockSyncQueue, mockRemote);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero counts when queue is empty', async () => {
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

    const result = await pusher.push();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, exhausted: 0 });
    expect(mockRemote.applySyncItem).not.toHaveBeenCalled();
  });

  it('processes all items in queue', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'update-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'element', entityId: 'el-3', operation: 'create-element-history', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockResolvedValue();

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0, exhausted: 0 });
    expect(mockRemote.applySyncItem).toHaveBeenCalledTimes(3);
    expect(mockSyncQueue.markSynced).toHaveBeenCalledTimes(3);
    expect(mockSyncQueue.markFailed).not.toHaveBeenCalled();
  });

  it('marks items as failed when remote throws', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'create-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    const error = new Error('Network error');
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // First succeeds
      .mockRejectedValueOnce(error); // Second fails

    const result = await pusher.push();

    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1, exhausted: 0 });
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q1');
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q2', error);
  });

  it('continues processing after a failure', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'create-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'element', entityId: 'el-3', operation: 'create-element', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // q1 succeeds
      .mockRejectedValueOnce(new Error('Fail')) // q2 fails
      .mockResolvedValueOnce(); // q3 succeeds

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 2, failed: 1, exhausted: 0 });
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q1');
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q2', expect.any(Error));
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q3');
  });

  it('tallies items whose retry budget is exhausted by this push', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'failed', retryCount: 4 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'create-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockRejectedValue(new Error('Network error'));
    vi.mocked(mockSyncQueue.markFailed)
      .mockResolvedValueOnce(true) // q1 hits the cap
      .mockResolvedValueOnce(false); // q2 has budget left

    const result = await pusher.push();

    expect(result).toEqual({ processed: 2, succeeded: 0, failed: 2, exhausted: 1 });
  });

  it('times out a hung write and fails the rest of the queue in lockstep', async () => {
    vi.useFakeTimers();
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'failed', retryCount: 4 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'create-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'element', entityId: 'el-3', operation: 'create-element', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    // Firestore-against-dead-server behavior: the write promise never settles.
    vi.mocked(mockRemote.applySyncItem).mockImplementation(() => new Promise(() => {}));
    vi.mocked(mockSyncQueue.markFailed)
      .mockResolvedValueOnce(true) // q1 hits the cap
      .mockResolvedValue(false);

    const pushPromise = pusher.push();
    await vi.advanceTimersByTimeAsync(SYNC_WRITE_TIMEOUT_MS);
    const result = await pushPromise;

    expect(result).toEqual({ processed: 3, succeeded: 0, failed: 3, exhausted: 1 });
    // Only the first item waits out the timeout; the rest are failed directly.
    expect(mockRemote.applySyncItem).toHaveBeenCalledTimes(1);
    expect(mockSyncQueue.markFailed).toHaveBeenCalledTimes(3);
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q1', expect.any(TimeoutError));
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q2', expect.any(TimeoutError));
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q3', expect.any(TimeoutError));
  });

  it('applies items in queue order', async () => {
    const callOrder: string[] = [];
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'element', entityId: 'el-1', operation: 'create-element', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'element', entityId: 'el-2', operation: 'create-element', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockImplementation(async (item: SyncQueueItem) => {
      callOrder.push(item.id);
    });

    await pusher.push();

    expect(callOrder).toEqual(['q1', 'q2']);
  });
});
