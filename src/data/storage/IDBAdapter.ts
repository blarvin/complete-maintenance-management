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
  StorageFieldDefinitionCreate,
  StorageFieldDefinitionUpdate,
  StorageElementCreate,
  StorageElementUpdate,
} from './storageAdapter';
import type { FieldDefinition, Element, ElementHistory, Kind } from '../models';
import { filterActive } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';
import { computeNextRev, createElementHistoryEntry, diffElementChanges } from './historyHelpers';
import { makeStorageError, toStorageError, isStorageError } from './storageErrors';
import type { StorageErrorCode } from './storageErrors';
import { storageEventBus } from '../storageEventBus';
import { IDBSyncQueueManager } from '../sync/SyncQueueManager';
import type { SyncQueueManager } from '../sync/SyncQueueManager';

import { createResult as _createResult } from './storageResult';

function createResult<T>(data: T, fromCache = true): StorageResult<T> {
  return _createResult(data, 'idb', fromCache);
}

/**
 * Maps Dexie / IndexedDB error names to StorageError codes (mirror of
 * FirestoreAdapter's `mapFirestoreError`). Dexie surfaces failures via the
 * DOMException-style `.name`.
 */
function mapDexieError(err: unknown): { code: StorageErrorCode; retryable: boolean } {
  const name = (err as { name?: string } | null | undefined)?.name;
  switch (name) {
    case 'QuotaExceededError':
      return { code: 'unavailable', retryable: true };
    case 'ConstraintError':
      return { code: 'conflict', retryable: false };
    case 'NotFoundError':
      return { code: 'not-found', retryable: false };
    case 'DataError':
    case 'DataCloneError':
      return { code: 'validation', retryable: false };
    case 'AbortError':
    case 'TransactionInactiveError':
    case 'InvalidStateError':
    case 'DatabaseClosedError':
    case 'VersionError':
      return { code: 'unavailable', retryable: true };
    default:
      return { code: 'internal', retryable: false };
  }
}

export class IDBAdapter implements SyncableStorageAdapter {
  readonly syncQueue: SyncQueueManager;

  constructor(syncQueue?: SyncQueueManager) {
    this.syncQueue = syncQueue ?? new IDBSyncQueueManager();
  }

  // ============================================================================
  // FieldDefinition Operations
  // ============================================================================

  async listFieldDefinitions(): Promise<StorageResult<FieldDefinition[]>> {
    try {
      const all = await db.fieldDefinitions.toArray();
      const active = filterActive(all);
      active.sort((a, b) => a.label.localeCompare(b.label));
      return createResult(active);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>> {
    try {
      const def = await db.fieldDefinitions.get(id);
      return createResult(def ?? null);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>> {
    try {
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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async updateFieldDefinition(id: string, updates: StorageFieldDefinitionUpdate): Promise<StorageResult<void>> {
    try {
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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  // ============================================================================
  // Sync Metadata Operations
  // ============================================================================

  async getLastSyncTimestamp(): Promise<number> {
    try {
      const meta = await db.syncMetadata.get('lastSyncTimestamp');
      return meta?.value ?? 0;
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async setLastSyncTimestamp(timestamp: number): Promise<void> {
    try {
      await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: timestamp });
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async applyRemoteFieldDefinition(def: FieldDefinition): Promise<void> {
    try {
      await db.fieldDefinitions.put(def);
      storageEventBus.emit({ type: 'FIELD_DEFINITION_WRITTEN', definition: { id: def.id, deletedAt: def.deletedAt } });
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  // ============================================================================
  // Full Collection Sync Operations
  // ============================================================================

  async getAllFieldDefinitions(): Promise<FieldDefinition[]> {
    try {
      return await db.fieldDefinitions.toArray();
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  // ============================================================================
  // Element Operations (unified primitive)
  // ============================================================================

  async listRootElements(): Promise<StorageResult<Element[]>> {
    try {
      const all = await db.elements.toArray();
      const active = all.filter(e => e.parentId === null && e.deletedAt === null);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getElement(id: string): Promise<StorageResult<Element | null>> {
    try {
      const e = await db.elements.get(id);
      return createResult(e ?? null);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async listChildElements(parentId: string): Promise<StorageResult<Element[]>> {
    try {
      const all = await db.elements.where('parentId').equals(parentId).toArray();
      const active = filterActive(all);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async listChildElementsByKind(parentId: string, kind: Kind): Promise<StorageResult<Element[]>> {
    try {
      const all = await db.elements.where('parentId').equals(parentId).toArray();
      const active = filterActive(all).filter(e => e.kind === kind);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async nextSiblingOrder(parentId: string | null): Promise<StorageResult<number>> {
    try {
      const all = parentId === null
        ? (await db.elements.toArray()).filter(e => e.parentId === null)
        : await db.elements.where('parentId').equals(parentId).toArray();
      if (all.length === 0) return createResult(0);
      return createResult(Math.max(...all.map(e => e.siblingOrder)) + 1);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async createElement(input: StorageElementCreate): Promise<StorageResult<Element>> {
    try {
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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async updateElement(id: string, updates: StorageElementUpdate): Promise<StorageResult<void>> {
    try {
      const existing = await db.elements.get(id);
      if (!existing) {
        throw makeStorageError('not-found', `Element not found: ${id}`, { retryable: false });
      }

      const timestamp = now();
      const userId = getCurrentUserId();

      const changedProps = diffElementChanges(existing, updates);

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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async softDeleteElement(id: string): Promise<StorageResult<void>> {
    try {
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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async restoreElement(id: string): Promise<StorageResult<void>> {
    try {
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
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>> {
    try {
      const all = await db.elementHistory.where('elementId').equals(elementId).toArray();
      all.sort((a, b) => a.rev - b.rev);
      return createResult(all);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  // ---- Element sync ----

  async getAllElements(): Promise<Element[]> {
    try {
      return await db.elements.toArray();
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getAllElementHistory(): Promise<ElementHistory[]> {
    try {
      return await db.elementHistory.toArray();
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async applyRemoteElement(element: Element): Promise<void> {
    try {
      await db.elements.put(element);
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, deletedAt: element.deletedAt },
      });
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async applyRemoteElementHistory(history: ElementHistory): Promise<void> {
    try {
      await db.elementHistory.put(history);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async deleteElementLocal(id: string): Promise<void> {
    try {
      await db.elements.delete(id);
      storageEventBus.emit({ type: 'ELEMENT_HARD_DELETED', elementId: id });
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async nextElementRev(elementId: string): Promise<number> {
    const history = await db.elementHistory.where('elementId').equals(elementId).toArray();
    return computeNextRev(history);
  }
}
