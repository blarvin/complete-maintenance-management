/**
 * IDBAdapter - IndexedDB implementation of StorageAdapter
 *
 * This is the PRIMARY storage adapter for offline-first operation.
 * All reads/writes go to IndexedDB via Dexie.
 * Operations are queued for sync to Firestore.
 */

import Dexie from 'dexie';
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
import { createElementHistoryEntry, diffElementChanges } from './historyHelpers';
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
 * Maps Dexie / IndexedDB error names to StorageError codes. Dexie surfaces
 * failures via the DOMException-style `.name`.
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
    return this.run(async () => {
      const all = await db.fieldDefinitions.toArray();
      const active = filterActive(all);
      active.sort((a, b) => a.label.localeCompare(b.label));
      return createResult(active);
    });
  }

  async getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>> {
    return this.run(async () => {
      const def = await db.fieldDefinitions.get(id);
      return createResult(def ?? null);
    });
  }

  async createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>> {
    return this.run(async () => {
      const timestamp = now();
      const userId = getCurrentUserId();

      const definition: FieldDefinition = {
        id: input.id,
        kind: input.kind,
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
    });
  }

  async updateFieldDefinition(id: string, updates: StorageFieldDefinitionUpdate): Promise<StorageResult<void>> {
    return this.run(async () => {
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
    });
  }

  // ============================================================================
  // Sync Metadata Operations
  // ============================================================================

  async getLastSyncTimestamp(): Promise<number> {
    return this.run(async () => {
      const meta = await db.syncMetadata.get('lastSyncTimestamp');
      return meta?.value ?? 0;
    });
  }

  async setLastSyncTimestamp(timestamp: number): Promise<void> {
    return this.run(async () => {
      await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: timestamp });
    });
  }

  async applyRemoteFieldDefinition(def: FieldDefinition): Promise<void> {
    return this.run(async () => {
      await db.fieldDefinitions.put(def);
      storageEventBus.emit({ type: 'FIELD_DEFINITION_WRITTEN', definition: { id: def.id, deletedAt: def.deletedAt } });
    });
  }

  // ============================================================================
  // Full Collection Sync Operations
  // ============================================================================

  async getAllFieldDefinitions(): Promise<FieldDefinition[]> {
    return this.run(() => db.fieldDefinitions.toArray());
  }

  // ============================================================================
  // Element Operations (unified primitive)
  // ============================================================================

  async listRootElements(): Promise<StorageResult<Element[]>> {
    return this.run(async () => {
      const all = await db.elements.toArray();
      const active = all.filter(e => e.parentId === null && e.deletedAt === null);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    });
  }

  async getElement(id: string): Promise<StorageResult<Element | null>> {
    return this.run(async () => {
      const e = await db.elements.get(id);
      return createResult(e ?? null);
    });
  }

  async listChildElements(parentId: string): Promise<StorageResult<Element[]>> {
    return this.run(async () => {
      const all = await db.elements.where('parentId').equals(parentId).toArray();
      const active = filterActive(all);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    });
  }

  async listChildElementsByKind(parentId: string, kind: Kind): Promise<StorageResult<Element[]>> {
    return this.run(async () => {
      const all = await db.elements.where('parentId').equals(parentId).toArray();
      const active = filterActive(all).filter(e => e.kind === kind);
      active.sort((a, b) => a.siblingOrder - b.siblingOrder);
      return createResult(active);
    });
  }

  async nextSiblingOrder(parentId: string | null): Promise<StorageResult<number>> {
    return this.run(async () => {
      const all = parentId === null
        ? (await db.elements.toArray()).filter(e => e.parentId === null)
        : await db.elements.where('parentId').equals(parentId).toArray();
      if (all.length === 0) return createResult(0);
      return createResult(Math.max(...all.map(e => e.siblingOrder)) + 1);
    });
  }

  async createElement(input: StorageElementCreate): Promise<StorageResult<Element>> {
    return this.run(async () => {
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

        const rev = 0; // brand-new element — no prior history, so the first entry is rev 0
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
    });
  }

  async updateElement(id: string, updates: StorageElementUpdate): Promise<StorageResult<void>> {
    return this.run(async () => {
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
    });
  }

  async softDeleteElement(id: string): Promise<StorageResult<void>> {
    return this.run(async () => {
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
    });
  }

  async restoreElement(id: string): Promise<StorageResult<void>> {
    return this.run(async () => {
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
    });
  }

  async getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>> {
    return this.run(async () => {
      const all = await db.elementHistory.where('elementId').equals(elementId).toArray();
      all.sort((a, b) => a.rev - b.rev);
      return createResult(all);
    });
  }

  // ---- Element sync ----

  async getAllElements(): Promise<Element[]> {
    return this.run(() => db.elements.toArray());
  }

  async getAllElementHistory(): Promise<ElementHistory[]> {
    return this.run(() => db.elementHistory.toArray());
  }

  async applyRemoteElement(element: Element): Promise<void> {
    return this.run(async () => {
      await db.elements.put(element);
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, deletedAt: element.deletedAt },
      });
    });
  }

  async applyRemoteElementHistory(history: ElementHistory): Promise<void> {
    return this.run(async () => {
      await db.elementHistory.put(history);
    });
  }

  async deleteElementLocal(id: string): Promise<void> {
    return this.run(async () => {
      await db.elements.delete(id);
      storageEventBus.emit({ type: 'ELEMENT_HARD_DELETED', elementId: id });
    });
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Wrap a storage operation with error normalization: hand-thrown
   * StorageErrors pass through unwrapped; Dexie/IndexedDB failures are
   * mapped to StorageErrors with the right code.
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapDexieError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  private async nextElementRev(elementId: string): Promise<number> {
    // Single index seek on the `[elementId+rev]` compound index: the last row
    // in the element's range carries the highest rev. O(log n) — no full-history
    // load just to read one number.
    const last = await db.elementHistory
      .where('[elementId+rev]')
      .between([elementId, Dexie.minKey], [elementId, Dexie.maxKey])
      .last();
    return last ? last.rev + 1 : 0;
  }
}
