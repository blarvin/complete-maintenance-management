/**
 * Unit tests for DeltaSync strategy.
 *
 * Tests delta sync with mocked resolver.
 * Delta sync pulls only entities updated since the last sync timestamp.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeltaSync } from '../data/sync/strategies/DeltaSync';
import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { LWWResolver } from '../data/sync/LWWResolver';
import type { TreeNode, DataField, DataFieldHistory } from '../data/models';

describe('DeltaSync', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockRemote: RemoteSyncAdapter;
  let mockResolver: LWWResolver;
  let strategy: DeltaSync;

  beforeEach(() => {
    mockLocal = {
      getLastSyncTimestamp: vi.fn().mockResolvedValue(5000),
      applyRemoteHistory: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    mockRemote = {
      pullEntitiesSince: vi.fn().mockResolvedValue([]),
      pullHistorySince: vi.fn().mockResolvedValue([]),
    } as unknown as RemoteSyncAdapter;

    mockResolver = {
      resolveNode: vi.fn().mockResolvedValue('applied'),
      resolveField: vi.fn().mockResolvedValue('applied'),
    } as unknown as LWWResolver;

    strategy = new DeltaSync(mockLocal, mockRemote, mockResolver);
  });

  it('has correct name', () => {
    expect(strategy.name).toBe('delta');
  });

  describe('sync nodes', () => {
    it('pulls nodes since last sync timestamp', async () => {
      await strategy.sync();

      expect(mockRemote.pullEntitiesSince).toHaveBeenCalledWith('node', 5000);
    });

    it('applies remote nodes through resolver', async () => {
      const remoteNodes: TreeNode[] = [
        { id: 'n1', parentId: null, nodeName: 'Node 1', nodeSubtitle: '', updatedBy: 'user', updatedAt: 6000, deletedAt: null },
        { id: 'n2', parentId: null, nodeName: 'Node 2', nodeSubtitle: '', updatedBy: 'user', updatedAt: 7000, deletedAt: null },
      ];

      vi.mocked(mockRemote.pullEntitiesSince).mockImplementation(async (type) => {
        return type === 'node' ? remoteNodes : [];
      });
      vi.mocked(mockResolver.resolveNode)
        .mockResolvedValueOnce('applied')
        .mockResolvedValueOnce('skipped');

      const result = await strategy.sync();

      expect(mockResolver.resolveNode).toHaveBeenCalledTimes(2);
      expect(result.nodesApplied).toBe(1); // Only one applied
    });

    it('handles soft-deleted nodes from remote', async () => {
      const softDeletedNode: TreeNode = {
        id: 'n1',
        parentId: null,
        nodeName: 'Deleted Node',
        nodeSubtitle: '',
        updatedBy: 'user',
        updatedAt: 6000,
        deletedAt: 6000, // Soft deleted
      };

      vi.mocked(mockRemote.pullEntitiesSince).mockImplementation(async (type) => {
        return type === 'node' ? [softDeletedNode] : [];
      });

      await strategy.sync();

      // Soft-deleted node should still be passed to resolver (LWW handles it)
      expect(mockResolver.resolveNode).toHaveBeenCalledWith(softDeletedNode);
    });
  });

  describe('sync fields', () => {
    it('pulls fields since last sync timestamp', async () => {
      await strategy.sync();

      expect(mockRemote.pullEntitiesSince).toHaveBeenCalledWith('field', 5000);
    });

    it('applies remote fields through resolver', async () => {
      const remoteFields: DataField[] = [
        { id: 'f1', parentNodeId: 'n1', fieldName: 'Field 1', fieldValue: 'v1', cardOrder: 0, updatedBy: 'user', updatedAt: 6000, deletedAt: null },
      ];

      vi.mocked(mockRemote.pullEntitiesSince).mockImplementation(async (type) => {
        return type === 'field' ? remoteFields : [];
      });

      const result = await strategy.sync();

      expect(mockResolver.resolveField).toHaveBeenCalledWith(remoteFields[0]);
      expect(result.fieldsApplied).toBe(1);
    });

    it('handles soft-deleted fields from remote', async () => {
      const softDeletedField: DataField = {
        id: 'f1',
        parentNodeId: 'n1',
        fieldName: 'Deleted Field',
        fieldValue: 'v1',
        cardOrder: 0,
        updatedBy: 'user',
        updatedAt: 6000,
        deletedAt: 6000, // Soft deleted
      };

      vi.mocked(mockRemote.pullEntitiesSince).mockImplementation(async (type) => {
        return type === 'field' ? [softDeletedField] : [];
      });

      await strategy.sync();

      // Soft-deleted field should still be passed to resolver (LWW handles it)
      expect(mockResolver.resolveField).toHaveBeenCalledWith(softDeletedField);
    });
  });

  describe('sync history', () => {
    it('pulls history since last sync timestamp', async () => {
      await strategy.sync();

      expect(mockRemote.pullHistorySince).toHaveBeenCalledWith(5000);
    });

    it('applies remote history entries', async () => {
      const remoteHistory: DataFieldHistory[] = [
        { id: 'h1', dataFieldId: 'f1', parentNodeId: 'n1', action: 'create', property: 'fieldValue', prevValue: null, newValue: 'v1', updatedBy: 'user', updatedAt: 6000, rev: 0 },
        { id: 'h2', dataFieldId: 'f1', parentNodeId: 'n1', action: 'update', property: 'fieldValue', prevValue: 'v1', newValue: 'v2', updatedBy: 'user', updatedAt: 7000, rev: 1 },
      ];

      vi.mocked(mockRemote.pullHistorySince).mockResolvedValue(remoteHistory);

      const result = await strategy.sync();

      expect(mockLocal.applyRemoteHistory).toHaveBeenCalledTimes(2);
      expect(result.historyApplied).toBe(2);
    });
  });

  describe('sync result', () => {
    it('returns combined counts from all sync operations', async () => {
      vi.mocked(mockRemote.pullEntitiesSince).mockImplementation(async (type) => {
        if (type === 'node') {
          return [
            { id: 'n1', parentId: null, nodeName: 'N1', nodeSubtitle: '', updatedBy: 'u', updatedAt: 6000, deletedAt: null },
          ];
        }
        return [
          { id: 'f1', parentNodeId: 'n1', fieldName: 'F1', fieldValue: 'v', cardOrder: 0, updatedBy: 'u', updatedAt: 6000, deletedAt: null },
        ];
      });
      vi.mocked(mockRemote.pullHistorySince).mockResolvedValue([
        { id: 'h1', dataFieldId: 'f1', parentNodeId: 'n1', action: 'create', property: 'fieldValue', prevValue: null, newValue: 'v', updatedBy: 'u', updatedAt: 6000, rev: 0 },
      ]);

      const result = await strategy.sync();

      expect(result).toEqual({
        nodesApplied: 1,
        fieldsApplied: 1,
        historyApplied: 1,
      });
    });

    it('handles empty results gracefully', async () => {
      vi.mocked(mockRemote.pullEntitiesSince).mockResolvedValue([]);
      vi.mocked(mockRemote.pullHistorySince).mockResolvedValue([]);

      const result = await strategy.sync();

      expect(result).toEqual({
        nodesApplied: 0,
        fieldsApplied: 0,
        historyApplied: 0,
      });
    });
  });

  describe('timestamp handling', () => {
    it('uses 0 as since timestamp when none exists', async () => {
      vi.mocked(mockLocal.getLastSyncTimestamp).mockResolvedValue(0);

      await strategy.sync();

      expect(mockRemote.pullEntitiesSince).toHaveBeenCalledWith('node', 0);
      expect(mockRemote.pullEntitiesSince).toHaveBeenCalledWith('field', 0);
      expect(mockRemote.pullHistorySince).toHaveBeenCalledWith(0);
    });
  });
});
