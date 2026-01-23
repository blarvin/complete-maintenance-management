/**
 * Unit tests for LWWResolver - Last-Write-Wins conflict resolution.
 *
 * Tests LWW logic in isolation without sync machinery.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LWWResolver } from '../data/sync/LWWResolver';
import type { SyncableStorageAdapter } from '../data/storage/storageAdapter';
import type { TreeNode, DataField } from '../data/models';

describe('LWWResolver', () => {
  let mockLocal: SyncableStorageAdapter;
  let resolver: LWWResolver;

  beforeEach(() => {
    // Create mock adapter
    mockLocal = {
      getNode: vi.fn(),
      listFields: vi.fn(),
      applyRemoteUpdate: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    resolver = new LWWResolver(mockLocal);
  });

  describe('resolveNode', () => {
    it('applies new remote node when local does not exist', async () => {
      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      vi.mocked(mockLocal.getNode).mockResolvedValue({ data: null });

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('node', remoteNode);
    });

    it('applies remote node when remote is newer', async () => {
      const localNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Local Node',
        nodeSubtitle: '',
        updatedBy: 'localUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 2000, // Newer
        deletedAt: null,
      };

      vi.mocked(mockLocal.getNode).mockResolvedValue({ data: localNode });

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('node', remoteNode);
    });

    it('skips remote node when local is newer', async () => {
      const localNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Local Node',
        nodeSubtitle: '',
        updatedBy: 'localUser',
        updatedAt: 2000, // Newer
        deletedAt: null,
      };

      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      vi.mocked(mockLocal.getNode).mockResolvedValue({ data: localNode });

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('skipped');
      expect(mockLocal.applyRemoteUpdate).not.toHaveBeenCalled();
    });

    it('skips remote node on tie (local wins)', async () => {
      const localNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Local Node',
        nodeSubtitle: '',
        updatedBy: 'localUser',
        updatedAt: 1000, // Same timestamp
        deletedAt: null,
      };

      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000, // Same timestamp
        deletedAt: null,
      };

      vi.mocked(mockLocal.getNode).mockResolvedValue({ data: localNode });

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('skipped');
      expect(mockLocal.applyRemoteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('resolveField', () => {
    it('applies new remote field when local does not exist', async () => {
      const remoteField: DataField = {
        id: 'field-1',
        parentNodeId: 'node-1',
        fieldName: 'Remote Field',
        fieldValue: 'Value',
        cardOrder: 0,
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      vi.mocked(mockLocal.listFields).mockResolvedValue({ data: [] });

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('field', remoteField);
    });

    it('applies remote field when remote is newer', async () => {
      const localField: DataField = {
        id: 'field-1',
        parentNodeId: 'node-1',
        fieldName: 'Local Field',
        fieldValue: 'Local Value',
        cardOrder: 0,
        updatedBy: 'localUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      const remoteField: DataField = {
        id: 'field-1',
        parentNodeId: 'node-1',
        fieldName: 'Remote Field',
        fieldValue: 'Remote Value',
        cardOrder: 0,
        updatedBy: 'remoteUser',
        updatedAt: 2000, // Newer
        deletedAt: null,
      };

      vi.mocked(mockLocal.listFields).mockResolvedValue({ data: [localField] });

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('field', remoteField);
    });

    it('skips remote field when local is newer', async () => {
      const localField: DataField = {
        id: 'field-1',
        parentNodeId: 'node-1',
        fieldName: 'Local Field',
        fieldValue: 'Local Value',
        cardOrder: 0,
        updatedBy: 'localUser',
        updatedAt: 2000, // Newer
        deletedAt: null,
      };

      const remoteField: DataField = {
        id: 'field-1',
        parentNodeId: 'node-1',
        fieldName: 'Remote Field',
        fieldValue: 'Remote Value',
        cardOrder: 0,
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      vi.mocked(mockLocal.listFields).mockResolvedValue({ data: [localField] });

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('skipped');
      expect(mockLocal.applyRemoteUpdate).not.toHaveBeenCalled();
    });

    it('correctly finds field among multiple fields', async () => {
      const localFields: DataField[] = [
        {
          id: 'field-1',
          parentNodeId: 'node-1',
          fieldName: 'Field 1',
          fieldValue: 'Value 1',
          cardOrder: 0,
          updatedBy: 'localUser',
          updatedAt: 1000,
          deletedAt: null,
        },
        {
          id: 'field-2',
          parentNodeId: 'node-1',
          fieldName: 'Field 2',
          fieldValue: 'Value 2',
          cardOrder: 1,
          updatedBy: 'localUser',
          updatedAt: 3000, // Newer than remote
          deletedAt: null,
        },
      ];

      const remoteField: DataField = {
        id: 'field-2',
        parentNodeId: 'node-1',
        fieldName: 'Remote Field 2',
        fieldValue: 'Remote Value 2',
        cardOrder: 1,
        updatedBy: 'remoteUser',
        updatedAt: 2000,
        deletedAt: null,
      };

      vi.mocked(mockLocal.listFields).mockResolvedValue({ data: localFields });

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('skipped');
      expect(mockLocal.listFields).toHaveBeenCalledWith('node-1');
    });
  });
});
