/**
 * IDBAdapter - IndexedDB implementation of StorageAdapter
 *
 * This is the PRIMARY storage adapter for offline-first operation.
 * All reads/writes go to IndexedDB via Dexie.
 * Operations are queued for sync to Firestore.
 */

import { db } from './db';
import type {
  SyncableStorageAdapter,
  StorageResult,
  StorageNodeCreate,
  StorageNodeUpdate,
  StorageFieldCreate,
  StorageFieldUpdate,
} from './storageAdapter';
import type { TreeNode, DataField, DataFieldHistory } from '../models';
import type { SyncQueueItem, SyncOperation } from './db';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';
import { generateId } from '../../utils/id';
import { makeStorageError } from './storageErrors';

function createResult<T>(data: T, fromCache = true): StorageResult<T> {
  return {
    data,
    meta: {
      adapter: 'idb',
      fromCache,
    },
  };
}

export class IDBAdapter implements SyncableStorageAdapter {
  // ============================================================================
  // Node Operations
  // ============================================================================

  async listRootNodes(): Promise<StorageResult<TreeNode[]>> {
    // Dexie doesn't support querying for null values with .equals()
    // So we get all nodes and filter for null parentId
    const allNodes = await db.nodes.toArray();
    const nodes = allNodes.filter(n => n.parentId === null);
    // Sort by updatedAt descending (most recent first)
    nodes.sort((a, b) => b.updatedAt - a.updatedAt);
    return createResult(nodes);
  }

  async getNode(id: string): Promise<StorageResult<TreeNode | null>> {
    const node = await db.nodes.get(id);
    return createResult(node ?? null);
  }

  async listChildren(parentId: string): Promise<StorageResult<TreeNode[]>> {
    const children = await db.nodes.where('parentId').equals(parentId).toArray();
    // Sort by updatedAt descending
    children.sort((a, b) => b.updatedAt - a.updatedAt);
    return createResult(children);
  }

  async createNode(input: StorageNodeCreate): Promise<StorageResult<TreeNode>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    const node: TreeNode = {
      id: input.id,
      nodeName: input.nodeName,
      nodeSubtitle: input.nodeSubtitle,
      parentId: input.parentId,
      updatedBy: userId,
      updatedAt: timestamp,
    };

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.put(node);
      await this.enqueueSyncOperation({
        operation: 'create-node',
        entityType: 'node',
        entityId: node.id,
        payload: node,
      });
    });

    console.log('[IDBAdapter] Node created in IDB:', node.id, node.nodeName);
    return createResult(node);
  }

  async updateNode(id: string, updates: StorageNodeUpdate): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.update(id, {
        ...updates,
        updatedBy: userId,
        updatedAt: timestamp,
      });

      // Get the updated node for the sync payload
      const updated = await db.nodes.get(id);
      if (updated) {
        await this.enqueueSyncOperation({
          operation: 'update-node',
          entityType: 'node',
          entityId: id,
          payload: updated,
        });
      }
    });

    console.log('[IDBAdapter] Node updated in IDB:', id);
    return createResult(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteNode(id: string, _opts?: { cascade?: boolean }): Promise<StorageResult<void>> {
    // Phase 1: enforce leaf-only deletion
    const childCount = await db.nodes.where('parentId').equals(id).count();
    if (childCount > 0) {
      throw makeStorageError('validation', 'Only leaf nodes can be deleted', {
        retryable: false,
      });
    }

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.delete(id);

      await this.enqueueSyncOperation({
        operation: 'delete-node',
        entityType: 'node',
        entityId: id,
        payload: { id },
      });
    });

    console.log('[IDBAdapter] Node deleted from IDB:', id);
    return createResult(undefined);
  }

  // ============================================================================
  // Field Operations
  // ============================================================================

  async listFields(parentNodeId: string): Promise<StorageResult<DataField[]>> {
    const fields = await db.fields.where('parentNodeId').equals(parentNodeId).toArray();
    // Sort by cardOrder ascending
    fields.sort((a, b) => a.cardOrder - b.cardOrder);
    return createResult(fields);
  }

  async nextCardOrder(parentNodeId: string): Promise<StorageResult<number>> {
    const fields = await db.fields.where('parentNodeId').equals(parentNodeId).toArray();
    if (fields.length === 0) return createResult(0);

    const maxOrder = Math.max(...fields.map(f => f.cardOrder));
    return createResult(maxOrder + 1);
  }

  async createField(input: StorageFieldCreate): Promise<StorageResult<DataField>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;

    const field: DataField = {
      id: input.id,
      fieldName: input.fieldName,
      fieldValue: input.fieldValue,
      parentNodeId: input.parentNodeId,
      cardOrder: order,
      updatedBy: userId,
      updatedAt: timestamp,
    };

    await db.transaction('rw', db.fields, db.history, db.syncQueue, async () => {
      await db.fields.put(field);

      // Create history entry
      const rev = await this.nextRev(field.id);
      const hist: DataFieldHistory = {
        id: `${field.id}:${rev}`,
        dataFieldId: field.id,
        parentNodeId: field.parentNodeId,
        action: 'create',
        property: 'fieldValue',
        prevValue: null,
        newValue: field.fieldValue,
        updatedBy: userId,
        updatedAt: timestamp,
        rev,
      };
      await db.history.put(hist);

      await this.enqueueSyncOperation({
        operation: 'create-field',
        entityType: 'field',
        entityId: field.id,
        payload: field,
      });
    });

    console.log('[IDBAdapter] Field created in IDB:', field.id, field.fieldName);
    return createResult(field);
  }

  async updateFieldValue(id: string, input: StorageFieldUpdate): Promise<StorageResult<void>> {
    const field = await db.fields.get(id);
    if (!field) {
      throw makeStorageError('not-found', 'Field not found', { retryable: false });
    }

    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.fields, db.history, db.syncQueue, async () => {
      await db.fields.update(id, {
        fieldValue: input.fieldValue,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      // Create history entry
      const rev = await this.nextRev(id);
      const hist: DataFieldHistory = {
        id: `${id}:${rev}`,
        dataFieldId: id,
        parentNodeId: field.parentNodeId,
        action: 'update',
        property: 'fieldValue',
        prevValue: field.fieldValue,
        newValue: input.fieldValue,
        updatedBy: userId,
        updatedAt: timestamp,
        rev,
      };
      await db.history.put(hist);

      // Get the updated field for the sync payload
      const updated = await db.fields.get(id);
      if (updated) {
        await this.enqueueSyncOperation({
          operation: 'update-field',
          entityType: 'field',
          entityId: id,
          payload: updated,
        });
      }
    });

    console.log('[IDBAdapter] Field updated in IDB:', id, input.fieldValue);
    return createResult(undefined);
  }

  async deleteField(id: string): Promise<StorageResult<void>> {
    const field = await db.fields.get(id);
    if (!field) return createResult(undefined);

    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.fields, db.history, db.syncQueue, async () => {
      await db.fields.delete(id);

      // Create history entry
      const rev = await this.nextRev(id);
      const hist: DataFieldHistory = {
        id: `${id}:${rev}`,
        dataFieldId: id,
        parentNodeId: field.parentNodeId,
        action: 'delete',
        property: 'fieldValue',
        prevValue: field.fieldValue,
        newValue: null,
        updatedBy: userId,
        updatedAt: timestamp,
        rev,
      };
      await db.history.put(hist);

      await this.enqueueSyncOperation({
        operation: 'delete-field',
        entityType: 'field',
        entityId: id,
        payload: { id },
      });
    });

    console.log('[IDBAdapter] Field deleted from IDB:', id);
    return createResult(undefined);
  }

  // ============================================================================
  // History Operations
  // ============================================================================

  async getFieldHistory(dataFieldId: string): Promise<StorageResult<DataFieldHistory[]>> {
    const history = await db.history.where('dataFieldId').equals(dataFieldId).toArray();
    // Sort by rev ascending
    history.sort((a, b) => a.rev - b.rev);
    return createResult(history);
  }

  // ============================================================================
  // Sync Queue Operations
  // ============================================================================

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    // Return only pending items, sorted by timestamp (FIFO)
    const items = await db.syncQueue.where('status').equals('pending').toArray();
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }

  async markSynced(queueItemId: string): Promise<void> {
    // Remove the item from the queue once synced
    await db.syncQueue.delete(queueItemId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async markFailed(queueItemId: string, error: any): Promise<void> {
    const item = await db.syncQueue.get(queueItemId);
    if (!item) return;

    await db.syncQueue.update(queueItemId, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastError: error?.message || String(error),
    });
  }

  async getLastSyncTimestamp(): Promise<number> {
    const meta = await db.syncMetadata.get('lastSyncTimestamp');
    return meta?.value ?? 0;
  }

  async setLastSyncTimestamp(timestamp: number): Promise<void> {
    await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: timestamp });
  }

  async applyRemoteUpdate(entityType: 'node' | 'field', entity: TreeNode | DataField): Promise<void> {
    if (entityType === 'node') {
      await db.nodes.put(entity as TreeNode);
    } else {
      await db.fields.put(entity as DataField);
    }
  }

  // ============================================================================
  // Full Collection Sync Operations
  // ============================================================================

  async getAllNodes(): Promise<TreeNode[]> {
    return await db.nodes.toArray();
  }

  async getAllFields(): Promise<DataField[]> {
    return await db.fields.toArray();
  }

  async deleteNodeLocal(id: string): Promise<void> {
    // Silent delete - no sync queue entry, no transaction needed
    await db.nodes.delete(id);
  }

  async deleteFieldLocal(id: string): Promise<void> {
    // Silent delete - no sync queue entry, no history entry, no transaction needed
    await db.fields.delete(id);
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async nextRev(dataFieldId: string): Promise<number> {
    const history = await db.history.where('dataFieldId').equals(dataFieldId).toArray();
    if (history.length === 0) return 0;

    const maxRev = Math.max(...history.map(h => h.rev));
    return maxRev + 1;
  }

  private async enqueueSyncOperation(params: {
    operation: SyncOperation;
    entityType: 'node' | 'field' | 'field-history';
    entityId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any; // Dynamic payload for different entity types
  }): Promise<void> {
    const item: SyncQueueItem = {
      id: generateId(),
      operation: params.operation,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      timestamp: now(),
      status: 'pending',
      retryCount: 0,
    };

    await db.syncQueue.put(item);
  }
}
