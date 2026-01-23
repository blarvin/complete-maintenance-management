/**
 * Unit tests for SyncPusher - Push local changes to remote.
 *
 * Tests queue processing in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncPusher } from '../data/sync/SyncPusher';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueItem } from '../data/storage/db';

describe('SyncPusher', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let pusher: SyncPusher;

  beforeEach(() => {
    mockLocal = {
      getSyncQueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      applySyncItem: vi.fn(),
    } as unknown as RemoteSyncAdapter;

    pusher = new SyncPusher(mockLocal, mockRemote);
  });

  it('returns zero counts when queue is empty', async () => {
    vi.mocked(mockLocal.getSyncQueue).mockResolvedValue([]);

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

    vi.mocked(mockLocal.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockResolvedValue();

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
    expect(mockRemote.applySyncItem).toHaveBeenCalledTimes(3);
    expect(mockLocal.markSynced).toHaveBeenCalledTimes(3);
    expect(mockLocal.markFailed).not.toHaveBeenCalled();
  });

  it('marks items as failed when remote throws', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    const error = new Error('Network error');
    vi.mocked(mockLocal.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // First succeeds
      .mockRejectedValueOnce(error); // Second fails

    const result = await pusher.push();

    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    expect(mockLocal.markSynced).toHaveBeenCalledWith('q1');
    expect(mockLocal.markFailed).toHaveBeenCalledWith('q2', error);
  });

  it('continues processing after a failure', async () => {
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
      { id: 'q3', entityType: 'node', entityId: 'node-3', operation: 'create-node', payload: {}, timestamp: 3000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockLocal.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem)
      .mockResolvedValueOnce() // q1 succeeds
      .mockRejectedValueOnce(new Error('Fail')) // q2 fails
      .mockResolvedValueOnce(); // q3 succeeds

    const result = await pusher.push();

    expect(result).toEqual({ processed: 3, succeeded: 2, failed: 1 });
    expect(mockLocal.markSynced).toHaveBeenCalledWith('q1');
    expect(mockLocal.markFailed).toHaveBeenCalledWith('q2', expect.any(Error));
    expect(mockLocal.markSynced).toHaveBeenCalledWith('q3');
  });

  it('applies items in queue order', async () => {
    const callOrder: string[] = [];
    const queueItems: SyncQueueItem[] = [
      { id: 'q1', entityType: 'node', entityId: 'node-1', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      { id: 'q2', entityType: 'node', entityId: 'node-2', operation: 'create-node', payload: {}, timestamp: 2000, status: 'pending', retryCount: 0 },
    ];

    vi.mocked(mockLocal.getSyncQueue).mockResolvedValue(queueItems);
    vi.mocked(mockRemote.applySyncItem).mockImplementation(async (item: SyncQueueItem) => {
      callOrder.push(item.id);
    });

    await pusher.push();

    expect(callOrder).toEqual(['q1', 'q2']);
  });
});
