/**
 * Unit tests for FullCollectionSync deletion detection.
 *
 * Focus: ISSUES Bug #1 — seeded Library rows (treeType 'library', authored by
 * AUTHOR_ID_APP_DEVELOPER) never reach the server (seedDefinitions enqueues no
 * sync ops), so their absence from remote must not delete them locally. An
 * empty remote (fresh emulator, wiped server) previously wiped every seed on
 * the first full sync.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FullCollectionSync } from '../data/sync/strategies/FullCollectionSync';
import { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { Element } from '../data/models';
import { AUTHOR_ID_APP_DEVELOPER, USER_ID } from '../constants';

function makeElement(overrides: Partial<Element> & { id: string }): Element {
  return {
    kind: 'text-kv',
    name: 'Test',
    subtitle: null,
    value: null,
    parentId: null,
    siblingOrder: 0,
    definitionId: null,
    treeType: 'business',
    updatedBy: USER_ID,
    updatedAt: 1000,
    deletedAt: null,
    ...overrides,
  };
}

const seededDef = makeElement({
  id: 'fd_dev_description',
  treeType: 'library',
  updatedBy: AUTHOR_ID_APP_DEVELOPER,
});
const seededCfgChild = makeElement({
  id: 'fd_dev_description::cfg::multiline',
  kind: 'flag',
  treeType: 'library',
  updatedBy: AUTHOR_ID_APP_DEVELOPER,
  parentId: 'fd_dev_description',
});
const userLibraryDef = makeElement({
  id: 'fd_user_abc',
  treeType: 'library',
  updatedBy: USER_ID,
});
const userBusinessNode = makeElement({
  id: 'node_1',
  kind: 'node',
});

describe('FullCollectionSync deletion detection', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockSyncQueue: SyncQueueManager;
  let strategy: FullCollectionSync;

  beforeEach(() => {
    mockLocal = {
      getAllElements: vi.fn().mockResolvedValue([]),
      deleteElementLocal: vi.fn().mockResolvedValue(undefined),
      applyRemoteElement: vi.fn().mockResolvedValue(undefined),
      applyRemoteElementHistory: vi.fn().mockResolvedValue(undefined),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      pullAllElements: vi.fn().mockResolvedValue([]),
      pullAllElementHistory: vi.fn().mockResolvedValue([]),
    } as unknown as RemoteSyncAdapter;

    mockSyncQueue = {
      getSyncQueue: vi.fn().mockResolvedValue([]),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
      requeueFailed: vi.fn(),
    };

    const resolver = new ServerAuthorityResolver(mockLocal, mockSyncQueue);
    strategy = new FullCollectionSync(mockLocal, mockRemote, resolver, mockSyncQueue);
  });

  it('empty remote does NOT delete seeded Library rows (Bug #1)', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([seededDef, seededCfgChild]);

    await strategy.sync();

    expect(mockLocal.deleteElementLocal).not.toHaveBeenCalled();
  });

  it('empty remote still deletes synced rows (user business + user library)', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([
      seededDef,
      seededCfgChild,
      userLibraryDef,
      userBusinessNode,
    ]);

    await strategy.sync();

    const deleted = vi.mocked(mockLocal.deleteElementLocal).mock.calls.map(([id]) => id);
    expect(deleted.sort()).toEqual(['fd_user_abc', 'node_1']);
  });

  it('sparse remote keeps seeds exempt while server authority applies remote rows', async () => {
    const remoteNode = makeElement({ id: 'node_remote', kind: 'node' });
    vi.mocked(mockRemote.pullAllElements).mockResolvedValue([remoteNode]);
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([seededDef, seededCfgChild, userBusinessNode]);

    await strategy.sync();

    const deleted = vi.mocked(mockLocal.deleteElementLocal).mock.calls.map(([id]) => id);
    expect(deleted).toEqual(['node_1']);
    expect(mockLocal.applyRemoteElement).toHaveBeenCalledWith(remoteNode);
  });

  it('rows pending push are never deleted', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([userBusinessNode]);
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([
      {
        id: 'q1',
        entityType: 'element',
        entityId: 'node_1',
        operation: 'create-element',
        payload: {},
        timestamp: 1000,
        status: 'pending',
        retryCount: 0,
      },
    ]);

    await strategy.sync();

    expect(mockLocal.deleteElementLocal).not.toHaveBeenCalled();
  });
});
