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
  StorageFieldDefinitionCreate,
  StorageFieldDefinitionUpdate,
  StorageFieldCreate,
  StorageFieldUpdate,
  StorageElementCreate,
  StorageElementUpdate,
} from './storageAdapter';
import type { TreeNode, DataField, DataFieldHistory, FieldDefinition, Element, ElementHistory, Kind, ElementHistoryProperty } from '../models';
import { filterActive, filterDeleted } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';
import { createHistoryEntry, computeNextRev, createElementHistoryEntry } from './historyHelpers';
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
  // FieldDefinition Operations
  // ============================================================================

  async listFieldDefinitions(): Promise<StorageResult<FieldDefinition[]>> {
    const all = await db.fieldDefinitions.toArray();
    const active = filterActive(all);
    active.sort((a, b) => a.label.localeCompare(b.label));
    return createResult(active);
  }

  async getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>> {
    const def = await db.fieldDefinitions.get(id);
    return createResult(def ?? null);
  }

  async createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    const definition: FieldDefinition = {
      id: input.id,
      componentType: input.componentType,
      label: input.label,
      config: input.config,
      authorId: userId,
      updatedBy: userId,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await db.transaction('rw', db.fieldDefinitions, db.syncQueue, async () => {
      await db.fieldDefinitions.put(definition);
      await this.syncQueue.enqueue({
        operation: 'create-fieldDefinition',
        entityType: 'fieldDefinition',
        entityId: definition.id,
        payload: definition,
      });
    });

    console.log('[IDBAdapter] FieldDefinition created in IDB:', definition.id, definition.label);
    return createResult(definition);
  }

  async updateFieldDefinition(id: string, updates: StorageFieldDefinitionUpdate): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.fieldDefinitions, db.syncQueue, async () => {
      await db.fieldDefinitions.update(id, {
        ...updates,
        updatedBy: userId,
        updatedAt: timestamp,
      });
      const updated = await db.fieldDefinitions.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-fieldDefinition',
          entityType: 'fieldDefinition',
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
    const definition = await db.fieldDefinitions.get(input.fieldDefinitionId);
    if (!definition) {
      throw makeStorageError('not-found', `FieldDefinition not found: ${input.fieldDefinitionId}`, { retryable: false });
    }

    const timestamp = now();
    const userId = getCurrentUserId();

    const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;

    const field: DataField = {
      id: input.id,
      parentNodeId: input.parentNodeId,
      fieldDefinitionId: definition.id,
      componentType: definition.componentType,
      fieldName: definition.label, // snapshot
      value: input.initialValue ?? null,
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
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id: field.id, parentNodeId: field.parentNodeId, value: field.value, deletedAt: field.deletedAt } });
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
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id, parentNodeId: field.parentNodeId, value: input.value, deletedAt: field.deletedAt } });
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
    storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id, parentNodeId: field.parentNodeId, value: field.value, deletedAt: timestamp } });
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

  async applyRemoteUpdate(entityType: 'node' | 'field' | 'fieldDefinition', entity: TreeNode | DataField | FieldDefinition): Promise<void> {
    if (entityType === 'node') {
      const node = entity as TreeNode;
      await db.nodes.put(node);
      storageEventBus.emit({ type: 'NODE_WRITTEN', node });
    } else if (entityType === 'fieldDefinition') {
      const def = entity as FieldDefinition;
      await db.fieldDefinitions.put(def);
      storageEventBus.emit({ type: 'FIELD_DEFINITION_WRITTEN', definition: { id: def.id, deletedAt: def.deletedAt } });
    } else {
      const incoming = entity as DataField;
      await db.fields.put(incoming);
      storageEventBus.emit({ type: 'FIELD_WRITTEN', field: { id: incoming.id, parentNodeId: incoming.parentNodeId, value: incoming.value, deletedAt: incoming.deletedAt } });
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

  async getAllFieldDefinitions(): Promise<FieldDefinition[]> {
    return await db.fieldDefinitions.toArray();
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
  // Element Operations (unified primitive)
  // ============================================================================

  async listRootElements(): Promise<StorageResult<Element[]>> {
    const all = await db.elements.toArray();
    const active = all.filter(e => e.parentId === null && e.deletedAt === null);
    active.sort((a, b) => a.siblingOrder - b.siblingOrder);
    return createResult(active);
  }

  async getElement(id: string): Promise<StorageResult<Element | null>> {
    const e = await db.elements.get(id);
    return createResult(e ?? null);
  }

  async listChildElements(parentId: string): Promise<StorageResult<Element[]>> {
    const all = await db.elements.where('parentId').equals(parentId).toArray();
    const active = filterActive(all);
    active.sort((a, b) => a.siblingOrder - b.siblingOrder);
    return createResult(active);
  }

  async listChildElementsByKind(parentId: string, kind: Kind): Promise<StorageResult<Element[]>> {
    const all = await db.elements.where('parentId').equals(parentId).toArray();
    const active = filterActive(all).filter(e => e.kind === kind);
    active.sort((a, b) => a.siblingOrder - b.siblingOrder);
    return createResult(active);
  }

  async nextSiblingOrder(parentId: string | null): Promise<StorageResult<number>> {
    const all = parentId === null
      ? (await db.elements.toArray()).filter(e => e.parentId === null)
      : await db.elements.where('parentId').equals(parentId).toArray();
    if (all.length === 0) return createResult(0);
    return createResult(Math.max(...all.map(e => e.siblingOrder)) + 1);
  }

  async createElement(input: StorageElementCreate): Promise<StorageResult<Element>> {
    if (input.kind !== 'node' && !input.fieldDefinitionId) {
      throw makeStorageError('validation', `fieldDefinitionId required for kind=${input.kind}`, { retryable: false });
    }
    if (input.fieldDefinitionId) {
      const def = await db.fieldDefinitions.get(input.fieldDefinitionId);
      if (!def) {
        throw makeStorageError('not-found', `FieldDefinition not found: ${input.fieldDefinitionId}`, { retryable: false });
      }
    }

    const timestamp = now();
    const userId = getCurrentUserId();
    const order = input.siblingOrder ?? (await this.nextSiblingOrder(input.parentId)).data;

    const element: Element = {
      id: input.id,
      kind: input.kind,
      name: input.name,
      subtitle: input.subtitle ?? null,
      value: input.value ?? null,
      parentId: input.parentId,
      siblingOrder: order,
      fieldDefinitionId: input.fieldDefinitionId ?? null,
      updatedBy: userId,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await db.transaction('rw', db.elements, db.elementHistory, db.syncQueue, async () => {
      await db.elements.put(element);

      const rev = await this.nextElementRev(element.id);
      const hist = createElementHistoryEntry({
        elementId: element.id,
        rev,
        action: 'create',
        property: 'value',
        prevValue: null,
        newValue: element.value,
      });
      await db.elementHistory.put(hist);

      await this.syncQueue.enqueue({
        operation: 'create-element',
        entityType: 'element',
        entityId: element.id,
        payload: element,
      });
      await this.syncQueue.enqueue({
        operation: 'create-element-history',
        entityType: 'element-history',
        entityId: hist.id,
        payload: hist,
      });
    });

    console.log('[IDBAdapter] Element created in IDB:', element.id, element.kind, element.name);
    storageEventBus.emit({
      type: 'ELEMENT_WRITTEN',
      element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, deletedAt: element.deletedAt },
    });
    return createResult(element);
  }

  async updateElement(id: string, updates: StorageElementUpdate): Promise<StorageResult<void>> {
    const existing = await db.elements.get(id);
    if (!existing) {
      throw makeStorageError('not-found', `Element not found: ${id}`, { retryable: false });
    }

    const timestamp = now();
    const userId = getCurrentUserId();

    const changedProps: Array<{ property: ElementHistoryProperty; prev: unknown; next: unknown }> = [];
    if ('name' in updates && updates.name !== existing.name) {
      changedProps.push({ property: 'name', prev: existing.name, next: updates.name });
    }
    if ('subtitle' in updates && (updates.subtitle ?? null) !== existing.subtitle) {
      changedProps.push({ property: 'subtitle', prev: existing.subtitle, next: updates.subtitle ?? null });
    }
    if ('value' in updates && updates.value !== existing.value) {
      changedProps.push({ property: 'value', prev: existing.value, next: updates.value });
    }
    if ('parentId' in updates && (updates.parentId ?? null) !== existing.parentId) {
      changedProps.push({ property: 'parentId', prev: existing.parentId, next: updates.parentId ?? null });
    }
    if ('siblingOrder' in updates && updates.siblingOrder !== existing.siblingOrder) {
      changedProps.push({ property: 'siblingOrder', prev: existing.siblingOrder, next: updates.siblingOrder });
    }

    let written: Element | undefined;
    await db.transaction('rw', db.elements, db.elementHistory, db.syncQueue, async () => {
      await db.elements.update(id, {
        ...updates,
        updatedBy: userId,
        updatedAt: timestamp,
      });
      written = await db.elements.get(id);

      let rev = await this.nextElementRev(id);
      for (const c of changedProps) {
        const hist = createElementHistoryEntry({
          elementId: id,
          rev: rev++,
          action: 'update',
          property: c.property,
          prevValue: c.prev,
          newValue: c.next,
        });
        await db.elementHistory.put(hist);
        await this.syncQueue.enqueue({
          operation: 'create-element-history',
          entityType: 'element-history',
          entityId: hist.id,
          payload: hist,
        });
      }

      if (written) {
        await this.syncQueue.enqueue({
          operation: 'update-element',
          entityType: 'element',
          entityId: id,
          payload: written,
        });
      }
    });

    if (written) {
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        element: { id: written.id, kind: written.kind, parentId: written.parentId, name: written.name, value: written.value, deletedAt: written.deletedAt },
      });
    }
    return createResult(undefined);
  }

  async softDeleteElement(id: string): Promise<StorageResult<void>> {
    const existing = await db.elements.get(id);
    if (!existing) return createResult(undefined);

    const timestamp = now();
    const userId = getCurrentUserId();

    await db.transaction('rw', db.elements, db.elementHistory, db.syncQueue, async () => {
      await db.elements.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
        updatedBy: userId,
      });

      const rev = await this.nextElementRev(id);
      const hist = createElementHistoryEntry({
        elementId: id,
        rev,
        action: 'delete',
        property: 'value',
        prevValue: existing.value,
        newValue: null,
      });
      await db.elementHistory.put(hist);

      const updated = await db.elements.get(id);
      if (updated) {
        await this.syncQueue.enqueue({
          operation: 'update-element',
          entityType: 'element',
          entityId: id,
          payload: updated,
        });
      }
      await this.syncQueue.enqueue({
        operation: 'create-element-history',
        entityType: 'element-history',
        entityId: hist.id,
        payload: hist,
      });
    });

    storageEventBus.emit({
      type: 'ELEMENT_WRITTEN',
      element: { id, kind: existing.kind, parentId: existing.parentId, name: existing.name, value: existing.value, deletedAt: timestamp },
    });
    return createResult(undefined);
  }

  async restoreElement(id: string): Promise<StorageResult<void>> {
    const timestamp = now();
    const userId = getCurrentUserId();

    let restored: Element | undefined;
    await db.transaction('rw', db.elements, db.syncQueue, async () => {
      await db.elements.update(id, {
        deletedAt: null,
        updatedAt: timestamp,
        updatedBy: userId,
      });
      restored = await db.elements.get(id);
      if (restored) {
        await this.syncQueue.enqueue({
          operation: 'update-element',
          entityType: 'element',
          entityId: id,
          payload: restored,
        });
      }
    });
    if (restored) {
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        element: { id: restored.id, kind: restored.kind, parentId: restored.parentId, name: restored.name, value: restored.value, deletedAt: restored.deletedAt },
      });
    }
    return createResult(undefined);
  }

  async getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>> {
    const all = await db.elementHistory.where('elementId').equals(elementId).toArray();
    all.sort((a, b) => a.rev - b.rev);
    return createResult(all);
  }

  // ---- Element sync ----

  async getAllElements(): Promise<Element[]> {
    return await db.elements.toArray();
  }

  async getAllElementHistory(): Promise<ElementHistory[]> {
    return await db.elementHistory.toArray();
  }

  async applyRemoteElement(element: Element): Promise<void> {
    await db.elements.put(element);
    storageEventBus.emit({
      type: 'ELEMENT_WRITTEN',
      element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, deletedAt: element.deletedAt },
    });
  }

  async applyRemoteElementHistory(history: ElementHistory): Promise<void> {
    await db.elementHistory.put(history);
  }

  async deleteElementLocal(id: string): Promise<void> {
    await db.elements.delete(id);
    storageEventBus.emit({ type: 'ELEMENT_HARD_DELETED', elementId: id });
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async nextRev(dataFieldId: string): Promise<number> {
    const history = await db.history.where('dataFieldId').equals(dataFieldId).toArray();
    return computeNextRev(history);
  }

  private async nextElementRev(elementId: string): Promise<number> {
    const history = await db.elementHistory.where('elementId').equals(elementId).toArray();
    return computeNextRev(history);
  }
}
