/**
 * SyncManager exhaustion alert (audit §4.3): a push that exhausts an item's
 * retry budget shows one error toast with a Retry action; pushes with retry
 * budget remaining stay silent (sync is silent per Phase 1).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '../data/sync/syncManager';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { SyncQueueItem } from '../data/storage/db';
import { setSnackbarService, type SnackbarService, type ToastInput } from '../services/snackbar';

const queueItem: SyncQueueItem = {
  id: 'q1',
  operation: 'create-element',
  entityType: 'element',
  entityId: 'el-1',
  payload: {},
  timestamp: 1000,
  status: 'failed',
  retryCount: 4,
};

describe('SyncManager — exhausted-retries toast', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockQueue: SyncQueueManager;
  let mockSnackbar: SnackbarService;
  let shownToasts: ToastInput[];

  beforeEach(() => {
    // canSync() checks navigator.onLine; Node's bare navigator global lacks it.
    vi.stubGlobal('navigator', { onLine: true });

    mockLocal = {
      getLastSyncTimestamp: vi.fn().mockResolvedValue(0),
      setLastSyncTimestamp: vi.fn().mockResolvedValue(undefined),
      applyRemoteElementHistory: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      applySyncItem: vi.fn().mockRejectedValue(new Error('Network error')),
      pullElementsSince: vi.fn().mockResolvedValue([]),
      pullElementHistorySince: vi.fn().mockResolvedValue([]),
      pullDefinitionsSince: vi.fn().mockResolvedValue([]),
    } as unknown as RemoteSyncAdapter;

    mockQueue = {
      getSyncQueue: vi.fn().mockResolvedValue([queueItem]),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(false),
      requeueFailed: vi.fn().mockResolvedValue(0),
    };

    shownToasts = [];
    mockSnackbar = {
      show: vi.fn((toast: ToastInput) => { shownToasts.push(toast); }),
      dismiss: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
    };
    setSnackbarService(mockSnackbar);
  });

  afterEach(() => {
    setSnackbarService(null);
    vi.unstubAllGlobals();
  });

  it('shows one error toast with a Retry action when a push exhausts items', async () => {
    vi.mocked(mockQueue.markFailed).mockResolvedValue(true);

    const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
    await manager.syncDelta();

    expect(shownToasts).toHaveLength(1);
    expect(shownToasts[0]).toMatchObject({
      message: '1 change(s) failed to sync',
      variant: 'error',
    });
    expect(shownToasts[0].action?.label).toBe('Retry');
  });

  it('shows nothing when failures still have retry budget', async () => {
    const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
    await manager.syncDelta();

    expect(mockSnackbar.show).not.toHaveBeenCalled();
  });

  it('retryFailed re-arms failed items then syncs immediately', async () => {
    vi.mocked(mockQueue.requeueFailed).mockResolvedValue(2);
    vi.mocked(mockRemote.applySyncItem).mockResolvedValue(undefined);

    const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
    await manager.retryFailed();

    expect(mockQueue.requeueFailed).toHaveBeenCalledTimes(1);
    expect(mockRemote.applySyncItem).toHaveBeenCalled();
    expect(mockSnackbar.show).not.toHaveBeenCalled();
  });
});
