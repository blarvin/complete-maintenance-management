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
  StorageTemplateCreate,
  StorageTemplateUpdate,
  StorageFieldCreate,
  StorageFieldUpdate,
} from './storageAdapter';
import type { TreeNode, DataField, DataFieldHistory, DataFieldTemplate } from '../models';
import { filterActive, filterDeleted } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';
import { createHistoryEntry, computeNextRev } from './historyHelpers';
import { computeCardOrderUpdates, sortByCardOrder } from '../utils/cardOrder';
import { makeStorageError } from './storageErrors';
import { storageEventBus } from '../storageEventBus';
import { IDBSyncQueueManager } from '../sync/SyncQueueManager';
import type { SyncQueueManager } from '../sync/SyncQueueManager';

import { createResult as _createResult } from './storageResult';

function createResult<T>(data: T, fromCache = true): StorageResult<T> {
  return _createResult(data, 'idb', fromCache);
}

export class IDBAdapter implements SyncableStorageAdapter {
  readonly syncQueue: SyncQueueManager;

  constructor(syncQueue?: SyncQueueManager) {
    this.syncQueue = syncQueue ?? new IDBSyncQueueManager();
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  async listRootNodes(): Promise<StorageResult<TreeNode[]>> {
    // Dexie doesn't support querying for null values with .equals()
    const allNodes = await db.nodes.toArray();
    const nodes = allNodes.filter(n => n.parentId === null && n.deletedAt === null);
    nodes.sort((a, b) => a.updatedAt - b.updatedAt);
    return createResult(nodes);
  }

  async getNode(id: string): Promise<StorageResult<TreeNode | null>> {
    const node = await db.nodes.get(id);
    return createResult(node ?? null);
  }

  async listChildren(parentId: string): Promise<StorageResult<TreeNode[]>> {
    const children = await db.nodes.where('parentId').equals(parentId).toArray();
    const activeChildren = filterActive(children);
    activeChildren.sort((a, b) => a.updatedAt - b.updatedAt);
    return createResult(activeChildren);
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
      deletedAt: null,
    };

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.put(node);
      await this.syncQueue.enqueue({
        operation: 'create-node',
        entityType: 'node',
        entityId: node.id,
        payload: node,
      });
    });

    console.log('[IDBAdapter] Node created in IDB:', node.id, node.nodeName);
    storageEventBus.emit({ type: 'NODE_WRITTEN', node });
    return createResult(node);
  }

  async updateNode(id: string, updates: StorageNodeUpdate): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    let updatedNode: TreeNode | undefined;

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.update(id, {
        ...updates,
        updatedBy: userId,
        updatedAt: timestamp,
      });

      const updated = await db.nodes.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-node',
          entityType: 'node',
          entityId: id,
          payload: updated,
        });
        updatedNode = updated;
      }
    });

    console.log('[IDBAdapter] Node updated in IDB:', id);
    if (updatedNode) {
      storageEventBus.emit({ type: 'NODE_WRITTEN', node: updatedNode });
    }
    return createResult(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteNode(id: string, _opts?: { cascade?: boolean }): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    let softDeletedNode: TreeNode | undefined;

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const updated = await db.nodes.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-node',
          entityType: 'node',
          entityId: id,
          payload: updated,
        });
        softDeletedNode = updated;
      }
    });

    console.log('[IDBAdapter] Node soft-deleted in IDB:', id);
    if (softDeletedNode) {
      storageEventBus.emit({ type: 'NODE_WRITTEN', node: softDeletedNode });
    }
    return createResult(undefined);
  }

  // ============================================================================
  // Template Operations
  // ============================================================================

  async listTemplates(): Promise<StorageResult<DataFieldTemplate[]>> {
    const templates = await db.templates.toArray();
    templates.sort((a, b) => a.label.localeCompare(b.label));
    return createResult(templates);
  }

  async getTemplate(id: string): Promise<StorageResult<DataFieldTemplate | null>> {
    const tpl = await db.templates.get(id);
    return createResult(tpl ?? null);
  }

  async createTemplate(input: StorageTemplateCreate): Promise<StorageResult<DataFieldTemplate>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    const template: DataFieldTemplate = {
      id: input.id,
      componentType: input.componentType,
      label: input.label,
      config: input.config,
      updatedBy: userId,
      updatedAt: timestamp,
    };

    await db.transaction('rw', db.templates, db.syncQueue, async () => {
      await db.templates.put(template);
      await this.syncQueue.enqueue({
        operation: 'create-template',
        entityType: 'template',
        entityId: template.id,
        payload: template,
      });
    });

    console.log('[IDBAdapter] Template created in IDB:', template.id, template.label);
    return createResult(template);
  }

  async updateTemplate(id: string, updates: StorageTemplateUpdate): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.templates, db.syncQueue, async () => {
      await db.templates.update(id, {
        ...updates,
        updatedBy: userId,
        updatedAt: timestamp,
      });
      const updated = await db.templates.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-template',
          entityType: 'template',
          entityId: id,
          payload: updated,
        });
      }
    });

    return createResult(undefined);
  }

  // ============================================================================
  // Field Operations
  // ============================================================================

  async listFields(parentNodeId: string): Promise<StorageResult<DataField[]>> {
    const fields = await db.fields.where('parentNodeId').equals(parentNodeId).toArray();
    const activeFields = filterActive(fields);
    activeFields.sort((a, b) => a.cardOrder - b.cardOrder);
    return createResult(activeFields);
  }

  async nextCardOrder(parentNodeId: string): Promise<StorageResult<number>> {
    const fields = await db.fields.where('parentNodeId').equals(parentNodeId).toArray();
    if (fields.length === 0) return createResult(0);

    const maxOrder = Math.max(...fields.map(f => f.cardOrder));
    return createResult(maxOrder + 1);
  }

  async createField(input: StorageFieldCreate): Promise<StorageResult<DataField>> {
    const template = await db.templates.get(input.templateId);
    if (!template) {
      throw makeStorageError('not-found', `Template not found: ${input.templateId}`, { retryable: false });
    }

    const timestamp = now();
    const userId = getCurrentUserId();

    const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;

    const field: DataField = {
      id: input.id,
      parentNodeId: input.parentNodeId,
      templateId: template.id,
      componentType: template.componentType,
      fieldName: template.label, // snapshot
      value: null,
      cardOrder: order,
      updatedBy: userId,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await db.transaction('rw', db.fields, db.history, db.syncQueue, async () => {
      await db.fields.put(field);

      const rev = await this.nextRev(field.id);
      const hist = createHistoryEntry({
        dataFieldId: field.id,
        parentNodeId: field.parentNodeId,
        componentType: field.componentType,
        action: 'create',
        prevValue: null,
        newValue: field.value,
        rev,
      });
      await db.history.put(hist);

      await this.syncQueue.enqueue({
        operation: 'create-field',
        entityType: 'field',
        entityId: field.id,
        payload: field,
      });

      await this.syncQueue.enqueue({
        operation: 'create-history',
        entityType: 'field-history',
        entityId: hist.id,
        payload: hist,
      });
    });

    console.log('[IDBAdapter] Field created in IDB:', field.id, field.fieldName);
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field });
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
        value: input.value,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const rev = await this.nextRev(id);
      const hist = createHistoryEntry({
        dataFieldId: id,
        parentNodeId: field.parentNodeId,
        componentType: field.componentType,
        action: 'update',
        prevValue: field.value,
        newValue: input.value,
        rev,
      });
      await db.history.put(hist);

      const updated = await db.fields.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-field',
          entityType: 'field',
          entityId: id,
          payload: updated,
        });
      }

      await this.syncQueue.enqueue({
        operation: 'create-history',
        entityType: 'field-history',
        entityId: hist.id,
        payload: hist,
      });
    });

    console.log('[IDBAdapter] Field updated in IDB:', id, input.value);
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id, parentNodeId: field.parentNodeId, deletedAt: field.deletedAt } });
    return createResult(undefined);
  }

  async deleteField(id: string): Promise<StorageResult<void>> {
    const field = await db.fields.get(id);
    if (!field) return createResult(undefined);

    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.fields, db.history, db.syncQueue, async () => {
      await db.fields.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const rev = await this.nextRev(id);
      const hist = createHistoryEntry({
        dataFieldId: id,
        parentNodeId: field.parentNodeId,
        componentType: field.componentType,
        action: 'delete',
        prevValue: field.value,
        newValue: null,
        rev,
      });
      await db.history.put(hist);

      const updated = await db.fields.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-field',
          entityType: 'field',
          entityId: id,
          payload: updated,
        });
      }

      await this.syncQueue.enqueue({
        operation: 'create-history',
        entityType: 'field-history',
        entityId: hist.id,
        payload: hist,
      });
    });

    console.log('[IDBAdapter] Field soft-deleted in IDB:', id);
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id, parentNodeId: field.parentNodeId, deletedAt: timestamp } });
    return createResult(undefined);
  }

  // ============================================================================
  // History Operations
  // ============================================================================

  async getFieldHistory(dataFieldId: string): Promise<StorageResult<DataFieldHistory[]>> {
    const history = await db.history.where('dataFieldId').equals(dataFieldId).toArray();
    history.sort((a, b) => a.rev - b.rev);
    return createResult(history);
  }

  // ============================================================================
  // Soft Delete Operations - Nodes
  // ============================================================================

  async listDeletedNodes(): Promise<StorageResult<TreeNode[]>> {
    const allNodes = await db.nodes.toArray();
    const deletedNodes = filterDeleted(allNodes);
    deletedNodes.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return createResult(deletedNodes);
  }

  async listDeletedChildren(parentId: string): Promise<StorageResult<TreeNode[]>> {
    const children = await db.nodes.where('parentId').equals(parentId).toArray();
    const deletedChildren = filterDeleted(children);
    deletedChildren.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return createResult(deletedChildren);
  }

  async restoreNode(id: string): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    let restoredNode: TreeNode | undefined;

    await db.transaction('rw', db.nodes, db.syncQueue, async () => {
      await db.nodes.update(id, {
        deletedAt: null,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const updated = await db.nodes.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-node',
          entityType: 'node',
          entityId: id,
          payload: updated,
        });
        restoredNode = updated;
      }
    });

    console.log('[IDBAdapter] Node restored in IDB:', id);
    if (restoredNode) {
      storageEventBus.emit({ type: 'NODE_WRITTEN', node: restoredNode });
    }
    return createResult(undefined);
  }

  // ============================================================================
  // Soft Delete Operations - Fields
  // ============================================================================

  async listDeletedFields(parentNodeId: string): Promise<StorageResult<DataField[]>> {
    const fields = await db.fields.where('parentNodeId').equals(parentNodeId).toArray();
    const deletedFields = filterDeleted(fields);
    deletedFields.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return createResult(deletedFields);
  }

  async restoreField(id: string): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    let restoredField: DataField | undefined;

    await db.transaction('rw', db.fields, db.syncQueue, async () => {
      await db.fields.update(id, {
        deletedAt: null,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const updated = await db.fields.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-field',
          entityType: 'field',
          entityId: id,
          payload: updated,
        });
        restoredField = updated;
      }
    });

    console.log('[IDBAdapter] Field restored in IDB:', id);
    if (restoredField) {
      storageEventBus.emit({ type: 'FIELD_WRITTEN', field: restoredField });
    }
    return createResult(undefined);
  }

  // ============================================================================
  // Sync Metadata Operations
  // ============================================================================

  async getLastSyncTimestamp(): Promise<number> {
    const meta = await db.syncMetadata.get('lastSyncTimestamp');
    return meta?.value ?? 0;
  }

  async setLastSyncTimestamp(timestamp: number): Promise<void> {
    await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: timestamp });
  }

  async applyRemoteUpdate(entityType: 'node' | 'field' | 'template', entity: TreeNode | DataField | DataFieldTemplate): Promise<void> {
    if (entityType === 'node') {
      const node = entity as TreeNode;
      await db.nodes.put(node);
      storageEventBus.emit({ type: 'NODE_WRITTEN', node });
    } else if (entityType === 'template') {
      await db.templates.put(entity as DataFieldTemplate);
    } else {
      const incoming = entity as DataField;
      await db.fields.put(incoming);
      const siblings = await db.fields.where('parentNodeId').equals(incoming.parentNodeId).toArray();
      const active = filterActive(siblings);
      const sorted = sortByCardOrder(active);
      const updates = computeCardOrderUpdates(sorted);
      if (updates.length > 0) {
        await db.transaction('rw', db.fields, async () => {
          for (const u of updates) {
            await db.fields.update(u.id, { cardOrder: u.cardOrder });
          }
        });
      }
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

  async getAllHistory(): Promise<DataFieldHistory[]> {
    return await db.history.toArray();
  }

  async getAllTemplates(): Promise<DataFieldTemplate[]> {
    return await db.templates.toArray();
  }

  async applyRemoteHistory(history: DataFieldHistory): Promise<void> {
    await db.history.put(history);
  }

  async deleteNodeLocal(id: string): Promise<void> {
    await db.nodes.delete(id);
    storageEventBus.emit({ type: 'NODE_HARD_DELETED', nodeId: id });
  }

  async deleteFieldLocal(id: string): Promise<void> {
    await db.fields.delete(id);
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async nextRev(dataFieldId: string): Promise<number> {
    const history = await db.history.where('dataFieldId').equals(dataFieldId).toArray();
    return computeNextRev(history);
  }
}
