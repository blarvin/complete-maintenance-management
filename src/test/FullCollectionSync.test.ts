/**
 * Unit tests for FullCollectionSync strategy.
 *
 * Tests full collection sync with mocked resolver.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FullCollectionSync } from '../data/sync/strategies/FullCollectionSync';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { TreeNode, DataField, DataFieldHistory } from '../data/models';

describe('FullCollectionSync', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockResolver: ServerAuthorityResolver;
  let mockSyncQueue: SyncQueueManager;
  let strategy: FullCollectionSync;

  beforeEach(() => {
    mockLocal = {
      getAllNodes: vi.fn().mockResolvedValue([]),
      getAllFields: vi.fn().mockResolvedValue([]),
      deleteNodeLocal: vi.fn(),
      deleteFieldLocal: vi.fn(),
      applyRemoteHistory: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      pullAllNodes: vi.fn().mockResolvedValue([]),
      pullAllFields: vi.fn().mockResolvedValue([]),
      pullAllHistory: vi.fn().mockResolvedValue([]),
    } as unknown as RemoteSyncAdapter;

    mockResolver = {
      resolveNode: vi.fn().mockResolvedValue('applied'),
      resolveField: vi.fn().mockResolvedValue('applied'),
    } as unknown as ServerAuthorityResolver;

    mockSyncQueue = {
      getSyncQueue: vi.fn().mockResolvedValue([]),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
    };

    strategy = new FullCollectionSync(mockLocal, mockRemote, mockResolver, mockSyncQueue);
  });

  it('has correct name', () => {
    expect(strategy.name).toBe('full-collection');
  });

  describe('sync nodes', () => {
    it('applies remote nodes through resolver', async () => {
      const remoteNodes: TreeNode[] = [
        { id: 'n1', parentId: null, nodeName: 'Node 1', nodeSubtitle: '', updatedBy: 'user', updatedAt: 1000, deletedAt: null },
        { id: 'n2', parentId: null, nodeName: 'Node 2', nodeSubtitle: '', updatedBy: 'user', updatedAt: 2000, deletedAt: null },
      ];

      vi.mocked(mockRemote.pullAllNodes).mockResolvedValue(remoteNodes);
      vi.mocked(mockResolver.resolveNode)
        .mockResolvedValueOnce('applied')
        .mockResolvedValueOnce('skipped');

      const result = await strategy.sync();

      expect(mockResolver.resolveNode).toHaveBeenCalledTimes(2);
      expect(result.nodesApplied).toBe(1); // Only one applied
    });

    it('deletes local nodes not in remote', async () => {
      const localNodes: TreeNode[] = [
        { id: 'local-only', parentId: null, nodeName: 'Local Only', nodeSubtitle: '', updatedBy: 'user', updatedAt: 1000, deletedAt: null },
      ];

      vi.mocked(mockLocal.getAllNodes).mockResolvedValue(localNodes);
      vi.mocked(mockRemote.pullAllNodes).mockResolvedValue([]); // Empty remote

      await strategy.sync();

      expect(mockLocal.deleteNodeLocal).toHaveBeenCalledWith('local-only');
    });

    it('does not delete local nodes with pending sync', async () => {
      const localNodes: TreeNode[] = [
        { id: 'pending-node', parentId: null, nodeName: 'Pending', nodeSubtitle: '', updatedBy: 'user', updatedAt: 1000, deletedAt: null },
      ];

      vi.mocked(mockLocal.getAllNodes).mockResolvedValue(localNodes);
      vi.mocked(mockRemote.pullAllNodes).mockResolvedValue([]);
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([
        { id: 'q1', entityType: 'node', entityId: 'pending-node', operation: 'create-node', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      ]);

      await strategy.sync();

      expect(mockLocal.deleteNodeLocal).not.toHaveBeenCalled();
    });
  });

  describe('sync fields', () => {
    it('applies remote fields through resolver', async () => {
      const remoteFields: DataField[] = [
        { id: 'f1', parentNodeId: 'n1', fieldName: 'Field 1', fieldValue: 'v1', cardOrder: 0, updatedBy: 'user', updatedAt: 1000, deletedAt: null },
      ];

      vi.mocked(mockRemote.pullAllFields).mockResolvedValue(remoteFields);

      const result = await strategy.sync();

      expect(mockResolver.resolveField).toHaveBeenCalledWith(remoteFields[0]);
      expect(result.fieldsApplied).toBe(1);
    });

    it('deletes local fields not in remote', async () => {
      const localFields: DataField[] = [
        { id: 'local-field', parentNodeId: 'n1', fieldName: 'Local', fieldValue: 'v', cardOrder: 0, updatedBy: 'user', updatedAt: 1000, deletedAt: null },
      ];

      vi.mocked(mockLocal.getAllFields).mockResolvedValue(localFields);
      vi.mocked(mockRemote.pullAllFields).mockResolvedValue([]);

      await strategy.sync();

      expect(mockLocal.deleteFieldLocal).toHaveBeenCalledWith('local-field');
    });

    it('does not delete local fields with pending sync', async () => {
      const localFields: DataField[] = [
        { id: 'pending-field', parentNodeId: 'n1', fieldName: 'Pending', fieldValue: 'v', cardOrder: 0, updatedBy: 'user', updatedAt: 1000, deletedAt: null },
      ];

      vi.mocked(mockLocal.getAllFields).mockResolvedValue(localFields);
      vi.mocked(mockRemote.pullAllFields).mockResolvedValue([]);
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([
        { id: 'q1', entityType: 'field', entityId: 'pending-field', operation: 'create-field', payload: {}, timestamp: 1000, status: 'pending', retryCount: 0 },
      ]);

      await strategy.sync();

      expect(mockLocal.deleteFieldLocal).not.toHaveBeenCalled();
    });
  });

  describe('sync history', () => {
    it('applies all remote history entries', async () => {
      const remoteHistory: DataFieldHistory[] = [
        { id: 'h1', dataFieldId: 'f1', parentNodeId: 'n1', action: 'create', property: 'fieldValue', prevValue: null, newValue: 'v1', updatedBy: 'user', updatedAt: 1000, rev: 0 },
        { id: 'h2', dataFieldId: 'f1', parentNodeId: 'n1', action: 'update', property: 'fieldValue', prevValue: 'v1', newValue: 'v2', updatedBy: 'user', updatedAt: 2000, rev: 1 },
      ];

      vi.mocked(mockRemote.pullAllHistory).mockResolvedValue(remoteHistory);

      const result = await strategy.sync();

      expect(mockLocal.applyRemoteHistory).toHaveBeenCalledTimes(2);
      expect(result.historyApplied).toBe(2);
    });
  });

  describe('sync result', () => {
    it('returns combined counts from all sync operations', async () => {
      vi.mocked(mockRemote.pullAllNodes).mockResolvedValue([
        { id: 'n1', parentId: null, nodeName: 'N1', nodeSubtitle: '', updatedBy: 'u', updatedAt: 1000, deletedAt: null },
      ]);
      vi.mocked(mockRemote.pullAllFields).mockResolvedValue([
        { id: 'f1', parentNodeId: 'n1', fieldName: 'F1', fieldValue: 'v', cardOrder: 0, updatedBy: 'u', updatedAt: 1000, deletedAt: null },
      ]);
      vi.mocked(mockRemote.pullAllHistory).mockResolvedValue([
        { id: 'h1', dataFieldId: 'f1', parentNodeId: 'n1', action: 'create', property: 'fieldValue', prevValue: null, newValue: 'v', updatedBy: 'u', updatedAt: 1000, rev: 0 },
      ]);

      const result = await strategy.sync();

      expect(result).toEqual({
        nodesApplied: 1,
        fieldsApplied: 1,
        historyApplied: 1,
      });
    });
  });
});
