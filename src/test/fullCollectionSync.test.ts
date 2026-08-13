/**
 * Unit tests for FullCollectionSync retention.
 *
 * This file used to assert the *opposite* — that a full sync purges local rows
 * absent from the server, with an exemption carved out for the dev seeds (Bug
 * #1). The purge is gone (ISSUES Bugs #4): server absence could never
 * distinguish "deleted on the server" from "never got there", so it could drop
 * the row whose push had permanently failed. Retention is the default now, and
 * these tests pin that: a full sync applies what the server has and removes
 * nothing, whatever the local row's provenance.
 *
 * The seed exemption is gone too — not because seeds stopped being special, but
 * because nothing purges, so nothing needs exempting.
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

describe('FullCollectionSync retention', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockSyncQueue: SyncQueueManager;
  let strategy: FullCollectionSync;

  beforeEach(() => {
    mockLocal = {
      getAllElements: vi.fn().mockResolvedValue([]),
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
    strategy = new FullCollectionSync(mockLocal, mockRemote, resolver);
  });

  /**
   * The adapter has no local-delete method at all any more, so "did it delete?"
   * can only be asked of the surface the strategy actually holds. This asserts
   * the strategy never reaches for one — a re-added purge would have to add a
   * method back, and this guard would name it.
   */
  it('never calls any delete-shaped method on the local adapter', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([
      seededDef,
      seededCfgChild,
      userLibraryDef,
      userBusinessNode,
    ]);

    await strategy.sync();

    const deleteish = Object.keys(mockLocal).filter(k => /delete|remove|purge/i.test(k));
    expect(deleteish).toEqual([]);
  });

  it('empty remote keeps every local row — seeds included (Bug #1)', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([seededDef, seededCfgChild]);

    await strategy.sync();

    expect(mockLocal.applyRemoteElement).not.toHaveBeenCalled();
  });

  /**
   * The Bugs #4 case, stated directly: a row whose push permanently failed has
   * dropped out of the sync queue and is not on the server. It used to be
   * indistinguishable from a server-side deletion, and got purged. Now it just
   * stays.
   */
  it('keeps a row that is absent from remote AND absent from the queue', async () => {
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([userBusinessNode]);
    vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

    const result = await strategy.sync();

    expect(result.elementsApplied).toBe(0);
    expect(mockLocal.applyRemoteElement).not.toHaveBeenCalled();
  });

  it('applies remote rows under server authority while keeping local-only ones', async () => {
    const remoteNode = makeElement({ id: 'node_remote', kind: 'node' });
    vi.mocked(mockRemote.pullAllElements).mockResolvedValue([remoteNode]);
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([seededDef, seededCfgChild, userBusinessNode]);

    const result = await strategy.sync();

    expect(mockLocal.applyRemoteElement).toHaveBeenCalledWith(remoteNode);
    expect(mockLocal.applyRemoteElement).toHaveBeenCalledTimes(1);
    expect(result.elementsApplied).toBe(1);
  });

  it('a remote soft delete still arrives — deletion travels as an ordinary update', async () => {
    const tombstoned = makeElement({ id: 'node_1', kind: 'node', deletedAt: 5000 });
    vi.mocked(mockRemote.pullAllElements).mockResolvedValue([tombstoned]);
    vi.mocked(mockLocal.getAllElements).mockResolvedValue([userBusinessNode]);

    await strategy.sync();

    expect(mockLocal.applyRemoteElement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'node_1', deletedAt: 5000 })
    );
  });
});
