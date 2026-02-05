/**
 * Unit tests for SyncPusher - Push local changes to remote.
 *
 * Tests queue processing in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncPusher } from '../data/sync/SyncPusher';
import type { RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { SyncQueueItem } from '../data/storage/db';

describe('SyncPusher', () => {
  let mockSyncQueue: SyncQueueManager;
  let mockRemote: RemoteSyncAdapter;
  let pusher: SyncPusher;

  beforeEach(() => {
    mockSyncQueue = {
      getSyncQueue: vi.fn(),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
    };

    mockRemote = {
      applySyncItem: vi.fn(),
    } as unknown as RemoteSyncAdapter;

    pusher = new SyncPusher(mockSyncQueue, mockRemote);
  });

  it('returns zero counts when queue is empty', async () => {
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

    const result = await pusher.push();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(mockRemote.applySyncItem).not.toHaveBeenCalled();
  });

  it('processes all items in queue', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'update-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'field', entityId: 'field-1', operation: 'create-field', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockResolvedValue();

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
    expect(mockRemote.applySyncItem).toHaveBeenCalledTimes(3);
    expect(mockSyncQueue.markSynced).toHaveBeenCalledTimes(3);
    expect(mockSyncQueue.markFailed).not.toHaveBeenCalled();
  });

  it('marks items as failed when remote throws', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    const error = new Error('Network error');
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // First succeeds
      .mockRejectedValueOnce(error); // Second fails

    const result = await pusher.push();

    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q1');
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q2', error);
  });

  it('continues processing after a failure', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'node', entityId: 'node-3', operation: 'create-node', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // q1 succeeds
      .mockRejectedValueOnce(new Error('Fail')) // q2 fails
      .mockResolvedValueOnce(); // q3 succeeds

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 2, failed: 1 });
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q1');
    expect(mockSyncQueue.markFailed).toHaveBeenCalledWith('q2', expect.any(Error));
    expect(mockSyncQueue.markSynced).toHaveBeenCalledWith('q3');
  });

  it('applies items in queue order', async () => {
    const callOrder: string[] = [];
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockImplementation(async (item: SyncQueueItem) => {
      callOrder.push(item.id);
    });

    await pusher.push();

    expect(callOrder).toEqual(['q1', 'q2']);
  });
});
