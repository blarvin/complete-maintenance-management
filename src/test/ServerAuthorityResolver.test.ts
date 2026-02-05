/**
 * Unit tests for ServerAuthorityResolver - Server is the source of truth.
 *
 * Tests server authority logic: applies remote data unconditionally unless
 * the entity has pending local changes in the sync queue.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import type { SyncableStorageAdapter } from '../data/storage/storageAdapter';
import type { SyncQueueManager } from '../data/sync/SyncQueueManager';
import type { SyncQueueItem } from '../data/storage/db';
import type { TreeNode, DataField } from '../data/models';

describe('ServerAuthorityResolver', () => {
  let mockLocal: SyncableStorageAdapter;
  let mockSyncQueue: SyncQueueManager;
  let resolver: ServerAuthorityResolver;

  beforeEach(() => {
    // Create mock adapter
    mockLocal = {
      applyRemoteUpdate: vi.fn(),
    } as unknown as SyncableStorageAdapter;

    mockSyncQueue = {
      getSyncQueue: vi.fn(),
      enqueue: vi.fn(),
      markSynced: vi.fn(),
      markFailed: vi.fn(),
    };

    resolver = new ServerAuthorityResolver(mockLocal, mockSyncQueue);
  });

  describe('resolveNode', () => {
    it('applies remote node when entity NOT in sync queue', async () => {
      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      // No pending items in queue
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('node', remoteNode);
    });

    it('applies remote node even when local exists (server is authority)', async () => {
      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: 'Updated by server',
        updatedBy: 'remoteUser',
        updatedAt: 2000,
        deletedAt: null,
      };

      // No pending items - local node exists but not in queue
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('node', remoteNode);
    });

    it('skips remote node when entity IS in sync queue (pending local changes)', async () => {
      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      // Entity has pending local changes
      const pendingItem: SyncQueueItem = {
        id: 'queue-1',
        entityType: 'node',
        entityId: 'node-1',
        operation: 'update-node',
        payload: {},
        timestamp: 900,
        status: 'pending',
        retryCount: 0,
      };
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([pendingItem]);

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('skipped');
      expect(mockLocal.applyRemoteUpdate).not.toHaveBeenCalled();
    });

    it('applies remote node when different entity is in sync queue', async () => {
      const remoteNode: TreeNode = {
        id: 'node-1',
        parentId: null,
        nodeName: 'Remote Node',
        nodeSubtitle: '',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
      };

      // Different entity has pending changes
      const pendingItem: SyncQueueItem = {
        id: 'queue-1',
        entityType: 'node',
        entityId: 'node-2', // Different entity
        operation: 'create-node',
        payload: {},
        timestamp: 900,
        status: 'pending',
        retryCount: 0,
      };
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([pendingItem]);

      const result = await resolver.resolveNode(remoteNode);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('node', remoteNode);
    });
  });

  describe('resolveField', () => {
    it('applies remote field when entity NOT in sync queue', async () => {
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

      // No pending items in queue
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([]);

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('field', remoteField);
    });

    it('skips remote field when entity IS in sync queue (pending local changes)', async () => {
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

      // Entity has pending local changes
      const pendingItem: SyncQueueItem = {
        id: 'queue-1',
        entityType: 'field',
        entityId: 'field-1',
        operation: 'update-field',
        payload: {},
        timestamp: 900,
        status: 'pending',
        retryCount: 0,
      };
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([pendingItem]);

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('skipped');
      expect(mockLocal.applyRemoteUpdate).not.toHaveBeenCalled();
    });

    it('applies remote field when different entity is in sync queue', async () => {
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

      // Different entity has pending changes (could be node or different field)
      const pendingItem: SyncQueueItem = {
        id: 'queue-1',
        entityType: 'field',
        entityId: 'field-2', // Different entity
        operation: 'create-field',
        payload: {},
        timestamp: 900,
        status: 'pending',
        retryCount: 0,
      };
      vi.mocked(mockSyncQueue.getSyncQueue).mockResolvedValue([pendingItem]);

      const result = await resolver.resolveField(remoteField);

      expect(result).toBe('applied');
      expect(mockLocal.applyRemoteUpdate).toHaveBeenCalledWith('field', remoteField);
    });
  });
});
