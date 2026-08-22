/**
 * The delta-sync cursor is a high-water mark, not the local clock
 * (IMPLEMENTATION.md → *The delta cursor is a high-water mark, not the clock*).
 *
 * `pullElementsSince` filters on `updatedAt`, which every row carries from
 * `serverTimestamp()`. The cursor used to be written as `now()`, so a client
 * whose clock ran ahead of the server stamped a cursor past rows it had never
 * pulled; those rows stayed invisible until the next startup `syncFull()`.
 * These tests pin the cursor to the newest row actually received, which no
 * clock skew can move.
 *
 * The skew is faked by stubbing `Date.now` rather than by fake timers —
 * `withTimeout` wraps every pull in a real `setTimeout`, and freezing that
 * would be testing the harness instead of the cursor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '../data/sync/syncManager';
import { DeltaSync } from '../data/sync/strategies/DeltaSync';
import { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import { highestStamp } from '../data/sync/strategies/SyncStrategy';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { Element, ElementHistory } from '../data/models';
import { USER_ID } from '../constants';

/** A clock far ahead of every server stamp below — the skew being defended against. */
const FAST_CLOCK = 9_000_000;

function makeElement(id: string, updatedAt: number): Element {
  return {
    id,
    kind: 'node',
    name: id,
    subtitle: null,
    value: null,
    parentId: null,
    siblingOrder: 0,
    definitionId: null,
    treeType: 'business',
    updatedBy: USER_ID,
    updatedAt,
    deletedAt: null,
  };
}

function makeHistory(elementId: string, rev: number, updatedAt: number): ElementHistory {
  return {
    id: `${elementId}:${rev}`,
    elementId,
    rev,
    action: 'update',
    property: 'value',
    prevValue: null,
    newValue: 'x',
    updatedBy: USER_ID,
    updatedAt,
  };
}

describe('highestStamp', () => {
  it('is null when there is nothing to fold', () => {
    expect(highestStamp([])).toBeNull();
  });

  it('takes the max regardless of arrival order', () => {
    expect(highestStamp([300, 100, 200])).toBe(300);
  });

  /** An unresolved serverTimestamp() arrives null; it must not become the mark. */
  it('skips null, undefined and NaN stamps rather than propagating them', () => {
    expect(highestStamp([100, null, undefined, NaN, 250])).toBe(250);
    expect(highestStamp([null, undefined])).toBeNull();
  });
});

describe('sync cursor — high-water mark', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockQueue: SyncQueueManager;

  beforeEach(() => {
    // canSync() checks navigator.onLine; Node's bare navigator global lacks it.
    vi.stubGlobal('navigator', { onLine: true });
    vi.spyOn(Date, 'now').mockReturnValue(FAST_CLOCK);

    mockLocal = {
      getLastSyncTimestamp: vi.fn().mockResolvedValue(0),
      setLastSyncTimestamp: vi.fn().mockResolvedValue(undefined),
      applyRemoteElement: vi.fn().mockResolvedValue(undefined),
      applyRemoteElementHistory: vi.fn().mockResolvedValue(undefined),
      getAllElements: vi.fn().mockResolvedValue([]),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      applySyncItem: vi.fn().mockResolvedValue(undefined),
      pullElementsSince: vi.fn().mockResolvedValue([]),
      pullElementHistorySince: vi.fn().mockResolvedValue([]),
      pullAllElements: vi.fn().mockResolvedValue([]),
      pullAllElementHistory: vi.fn().mockResolvedValue([]),
    } as unknown as RemoteSyncAdapter;

    mockQueue = {
      getSyncQueue: vi.fn().mockResolvedValue([]),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(false),
      requeueFailed: vi.fn().mockResolvedValue(0),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const deltaStrategy = (): DeltaSync =>
    new DeltaSync(mockLocal, mockRemote, new ServerAuthorityResolver(mockLocal, mockQueue));

  describe('DeltaSync', () => {
    it('reports the newest stamp across both lanes — they share one cursor', async () => {
      vi.mocked(mockRemote.pullElementsSince).mockResolvedValue([
        makeElement('el-1', 1000),
        makeElement('el-2', 3000),
      ]);
      vi.mocked(mockRemote.pullElementHistorySince).mockResolvedValue([
        makeHistory('el-1', 0, 2000),
      ]);

      const result = await deltaStrategy().sync();

      expect(result.highWaterMark).toBe(3000);
    });

    it('takes the mark from the history lane when it is the newer of the two', async () => {
      vi.mocked(mockRemote.pullElementsSince).mockResolvedValue([makeElement('el-1', 1000)]);
      vi.mocked(mockRemote.pullElementHistorySince).mockResolvedValue([
        makeHistory('el-1', 0, 7000),
      ]);

      const result = await deltaStrategy().sync();

      expect(result.highWaterMark).toBe(7000);
    });

    it('reports null when the pull returned nothing', async () => {
      const result = await deltaStrategy().sync();

      expect(result.highWaterMark).toBeNull();
    });

    /**
     * The resolver skips a row with a pending local edit. It still *arrived*,
     * so it counts toward the mark — otherwise the cursor would stick behind it
     * and re-pull it every cycle forever.
     */
    it('counts a row the resolver skipped — received, not applied, sets the mark', async () => {
      vi.mocked(mockQueue.getSyncQueue).mockResolvedValue([
        { entityId: 'el-1' } as never,
      ]);
      vi.mocked(mockRemote.pullElementsSince).mockResolvedValue([makeElement('el-1', 4000)]);

      const result = await deltaStrategy().sync();

      expect(result.elementsApplied).toBe(0);
      expect(result.highWaterMark).toBe(4000);
    });
  });

  describe('SyncManager', () => {
    it('writes the newest row stamp as the cursor, never the local clock', async () => {
      vi.mocked(mockRemote.pullElementsSince).mockResolvedValue([
        makeElement('el-1', 1000),
        makeElement('el-2', 5000),
      ]);

      const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
      await manager.syncDelta();

      expect(mockLocal.setLastSyncTimestamp).toHaveBeenCalledWith(5000);
      expect(mockLocal.setLastSyncTimestamp).not.toHaveBeenCalledWith(FAST_CLOCK);
    });

    /**
     * The bug itself: advancing on an empty window is what opened the gap — the
     * cursor jumped to a clock the server had not reached, and every row
     * stamped in between was skipped. An empty pull must leave it alone.
     */
    it('leaves the cursor untouched when the pull returned nothing', async () => {
      const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
      await manager.syncDelta();

      expect(mockLocal.setLastSyncTimestamp).not.toHaveBeenCalled();
    });

    it('advances on the full-sync path too — startup no longer plants a clock', async () => {
      vi.mocked(mockRemote.pullAllElements).mockResolvedValue([makeElement('el-1', 2500)]);

      const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
      await manager.syncFull();

      expect(mockLocal.setLastSyncTimestamp).toHaveBeenCalledWith(2500);
    });

    /**
     * Repair: a store carrying a future cursor from the old code gets it pulled
     * back to a real server stamp by the next full sync. Moving the cursor
     * backwards is the point — the window it re-opens is the skipped one.
     */
    it('moves a future cursor backwards to a real stamp on full sync', async () => {
      vi.mocked(mockLocal.getLastSyncTimestamp).mockResolvedValue(FAST_CLOCK);
      vi.mocked(mockRemote.pullAllElements).mockResolvedValue([makeElement('el-1', 2500)]);

      const manager = new SyncManager(mockLocal, mockRemote, mockQueue);
      await manager.syncFull();

      expect(mockLocal.setLastSyncTimestamp).toHaveBeenCalledWith(2500);
    });
  });
});
