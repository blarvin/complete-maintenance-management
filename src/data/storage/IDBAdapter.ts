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
  StorageDefinitionCreate,
  StorageElementCreate,
  StorageElementUpdate,
} from './storageAdapter';
import type { Definition, Element, ElementHistory, Kind, TreeType } from '../models';
import { filterActive } from '../models';
import { shouldSyncTreeType, shouldLogHistory } from '../treePolicy';
import { serializeConfig, assembleConfig, readDefinedKind } from '../../kinds/configElements';
import { CONFIG_VALIDATORS } from '../../kinds/configSchema';
import { isInline } from '../../kinds/placement';
import { LIBRARY_ROOT_ID } from '../definitionIds';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';
import { devLog } from '../../utils/devMode';
import { compareHistory, createElementHistoryEntry, diffElementChanges } from './historyHelpers';
import { makeStorageError, toStorageError, isStorageError } from './storageErrors';
import type { StorageErrorCode } from './storageErrors';
import { storageEventBus } from '../storageEventBus';
import { IDBSyncQueueManager } from '../sync/SyncQueueManager';
import type { SyncQueueManager, EnqueueParams } from '../sync/SyncQueueManager';

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

/**
 * **What identifies a Definition: `definitionId === id`** — a Definition points at
 * itself (SPEC → *What identifies a Definition*). This replaced `parentId === null`,
 * which was the test only for as long as Definitions were tree roots; they hang
 * under the Library Node now. The self-reference is position-independent, so it
 * survives folders inside the Library and the eventual move of the whole Library
 * beneath an app-level Node.
 *
 * The three cases are disjoint on the one column: a Definition carries its own id,
 * an instance carries the Definition's, and a config Field (or any plain Node)
 * carries `null`.
 */
const isDefinitionRow = (e: Element): boolean => e.definitionId === e.id;

/** A config sub-field Element: a `library` row bound to nothing (the inverse of
 *  `isDefinitionRow` within the library tree). */
const isConfigChildRow = (e: Element): boolean => e.definitionId === null;

export class IDBAdapter implements SyncableStorageAdapter {
  readonly syncQueue: SyncQueueManager;

  constructor(syncQueue?: SyncQueueManager) {
    this.syncQueue = syncQueue ?? new IDBSyncQueueManager();
  }

  // ============================================================================
  // Definition Operations
  // ============================================================================

  async listDefinitions(): Promise<StorageResult<Definition[]>> {
    return this.run(async () => {
      const all = await db.elements.toArray();
      const defs = all.filter(
        (e) => e.treeType === 'library' && isDefinitionRow(e) && e.deletedAt === null,
      );
      defs.sort((a, b) => a.name.localeCompare(b.name));
      // Group active library config children by id once, so assembly is O(n) not
      // N+1. The inverse of the identity test, not of the parent test: Definitions
      // have a parent now (the Library Node), so `parentId !== null` would have
      // swept every Definition into this map.
      const childById = new Map<string, Element>();
      for (const e of all) {
        if (e.treeType === 'library' && isConfigChildRow(e) && e.deletedAt === null) {
          childById.set(e.id, e);
        }
      }
      const views = defs.map((def) =>
        this.buildDefinitionView(def, (cid) => childById.get(cid)),
      );
      return createResult(views);
    });
  }

  async getDefinition(id: string): Promise<StorageResult<Definition | null>> {
    return this.run(async () => {
      const def = await db.elements.get(id);
      if (!def || def.treeType !== 'library' || !isDefinitionRow(def)) {
        return createResult(null);
      }
      const children = filterActive(await db.elements.where('parentId').equals(id).toArray());
      const byId = new Map(children.map((c) => [c.id, c]));
      return createResult(this.buildDefinitionView(def, (cid) => byId.get(cid)));
    });
  }

  /**
   * Assemble the Definition read-model view from a `library`-tree Definition
   * Element and its config sub-field children (config-as-Elements). `config` is
   * assembled on read — there is no stored blob. `authorId` mirrors the
   * Definition Element's `updatedBy` (the old separate column folds into it).
   *
   * **This is the seam that absorbs kind-as-a-Field.** A Definition's Element is
   * `kind: 'node'` now (SPEC → *A FieldDefinition is a Node*), so the kind it
   * *defines* is read from its `::cfg::kind` child and surfaced here under the
   * view's `kind`. Every consumer of a Definition — `handlers.ts`'s mint,
   * `useLensPolicy`, the Kind band, all four kv renderers — reads this view and
   * therefore needed no change. The `?? def.kind` fallback covers a row written
   * before the kind child existed.
   */
  private buildDefinitionView(
    def: Element,
    getChild: (childId: string) => Element | undefined,
  ): Definition {
    const definedKind = readDefinedKind(def.id, getChild) ?? def.kind;
    const config = assembleConfig(def.id, definedKind, getChild);
    return {
      id: def.id,
      kind: definedKind,
      label: def.name,
      config,
      authorId: def.updatedBy,
      updatedBy: def.updatedBy,
      updatedAt: def.updatedAt,
      deletedAt: def.deletedAt,
    };
  }

  async createDefinition(input: StorageDefinitionCreate): Promise<StorageResult<Definition>> {
    return this.run(async () => {
      const timestamp = now();
      const userId = getCurrentUserId();

      const defElement: Element = {
        id: input.id,
        // Every Definition is a `node` so that every Definition is alike — same
        // row, same card, same gestures, same place. The kind it *defines* rides
        // in `serializeConfig`'s leading `::cfg::kind` child below.
        kind: 'node',
        name: input.label,
        subtitle: null,
        value: null,
        parentId: LIBRARY_ROOT_ID,
        siblingOrder: 0,
        // The self-reference *is* the identity test.
        definitionId: input.id,
        treeType: 'library',
        updatedBy: userId,
        updatedAt: timestamp,
        deletedAt: null,
      };
      const children: Element[] = serializeConfig(input.id, input.kind, input.config).map((d) => ({
        ...d,
        updatedBy: userId,
        updatedAt: timestamp,
        deletedAt: null,
      }));

      await db.transaction('rw', db.elements, db.elementHistory, db.syncQueue, async () => {
        for (const el of [defElement, ...children]) {
          await db.elements.put(el);
          await this.enqueueIfSynced(el.treeType, {
            operation: 'create-element',
            entityType: 'element',
            entityId: el.id,
            payload: el,
          });
          await this.writeHistory(el.treeType, {
            elementId: el.id,
            rev: 0,
            action: 'create',
            property: 'value',
            prevValue: null,
            newValue: el.value,
          });
        }
      });

      const byId = new Map(children.map((c) => [c.id, c]));
      const view = this.buildDefinitionView(defElement, (cid) => byId.get(cid));
      devLog('[IDBAdapter] Definition (library Element) created:', view.id, view.label);
      // Keep DEFINITION_WRITTEN as the "Library changed" signal the Composer
      // subscribes to — its payload is just { id, deletedAt }.
      storageEventBus.emit({
        type: 'DEFINITION_WRITTEN',
        origin: 'local',
        definition: { id: defElement.id, deletedAt: defElement.deletedAt },
      });
      return createResult(view);
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

  // ============================================================================
  // Element Operations (unified primitive)
  // ============================================================================

  async listRootElements(): Promise<StorageResult<Element[]>> {
    return this.run(async () => {
      const all = await db.elements.toArray();
      // The business-tree roots plus the Library Node, which is the only `library`
      // row left at the top level now that Definitions hang beneath it. It is
      // seeded at `siblingOrder: -1`, which is the whole of the "pinned at the top
      // of ROOT" rule — no view-level special case (SPEC → *The Library*).
      const active = all.filter(e =>
        e.parentId === null
        && e.deletedAt === null
        && (e.treeType === 'business' || e.treeType === 'library'),
      );
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

  async nextSiblingOrder(parentId: string | null, kind?: Kind): Promise<StorageResult<number>> {
    return this.run(async () => {
      const all = parentId === null
        ? (await db.elements.toArray()).filter(e => e.parentId === null && e.treeType === 'business')
        : await db.elements.where('parentId').equals(parentId).toArray();
      // Count only live siblings in the same placement section as the kind
      // being minted: fields order among fields, node-like children among
      // node-like children — matching how the two display lists read them.
      // Soft-deleted rows release their slot.
      const siblings = all.filter(e =>
        e.deletedAt === null && (kind === undefined || isInline(e.kind) === isInline(kind))
      );
      if (siblings.length === 0) return createResult(0);
      return createResult(Math.max(...siblings.map(e => e.siblingOrder)) + 1);
    });
  }

  async createElement(input: StorageElementCreate): Promise<StorageResult<Element>> {
    return this.run(async () => {
      if (isInline(input.kind) && !input.definitionId) {
        throw makeStorageError('validation', `definitionId required for kind=${input.kind}`, { retryable: false });
      }
      if (input.definitionId) {
        const def = await db.elements.get(input.definitionId);
        if (!def || def.treeType !== 'library' || !isDefinitionRow(def)) {
          throw makeStorageError('not-found', `Definition not found: ${input.definitionId}`, { retryable: false });
        }
      }

      const timestamp = now();
      const userId = getCurrentUserId();
      const order = input.siblingOrder ?? (await this.nextSiblingOrder(input.parentId, input.kind)).data;

      const element: Element = {
        id: input.id,
        kind: input.kind,
        name: input.name,
        subtitle: input.subtitle ?? null,
        value: input.value ?? null,
        parentId: input.parentId,
        siblingOrder: order,
        definitionId: input.definitionId ?? null,
        // createElement only mints business-tree elements; library Definitions
        // and their config sub-fields go through createDefinition / the seed.
        treeType: 'business',
        updatedBy: userId,
        updatedAt: timestamp,
        deletedAt: null,
      };

      await db.transaction('rw', db.elements, db.elementHistory, db.syncQueue, async () => {
        await db.elements.put(element);

        await this.enqueueIfSynced(element.treeType, {
          operation: 'create-element',
          entityType: 'element',
          entityId: element.id,
          payload: element,
        });
        await this.writeHistory(element.treeType, {
          elementId: element.id,
          rev: 0, // brand-new element — no prior history, so the first entry is rev 0
          action: 'create',
          property: 'value',
          prevValue: null,
          newValue: element.value,
        });
      });

      devLog('[IDBAdapter] Element created in IDB:', element.id, element.kind, element.name);
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'local',
        element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, treeType: element.treeType, deletedAt: element.deletedAt },
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

      // A Definition is editable for its whole life now, so the kind's cross-field
      // rules run on **every** config-Field write rather than once at a pre-Create
      // gate (SPEC → *Required config is enforced on every write*). Unbypassable
      // because it sits in the adapter, not in a form.
      const owningDefinition = await this.owningDefinition(existing);
      if (owningDefinition && 'value' in updates) {
        await this.assertConfigCoherent(owningDefinition, id, updates.value ?? null);
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

        // treeType is immutable, so the pre-update row routes history/sync.
        if (shouldLogHistory(existing.treeType)) {
          let rev = await this.nextElementRev(id);
          for (const c of changedProps) {
            await this.writeHistory(existing.treeType, {
              elementId: id,
              rev: rev++,
              action: 'update',
              property: c.property,
              prevValue: c.prev,
              newValue: c.next,
            });
          }
        }

        if (written) {
          await this.enqueueIfSynced(existing.treeType, {
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
          origin: 'local',
          element: { id: written.id, kind: written.kind, parentId: written.parentId, name: written.name, value: written.value, treeType: written.treeType, deletedAt: written.deletedAt },
        });
        // Editing a config Field *is* editing the Definition — this is the event
        // every mounted instance re-reads its config on (SPEC → *Downstream only*).
        // Without it a units change would sit in the Library, visible to nobody.
        if (owningDefinition) {
          storageEventBus.emit({
            type: 'DEFINITION_WRITTEN',
            origin: 'local',
            definition: { id: owningDefinition.id, deletedAt: owningDefinition.deletedAt },
          });
        }
      }
      return createResult(undefined);
    });
  }

  /**
   * The Definition an Element is a config Field of, or null. A config child is a
   * `library` row bound to nothing whose parent points at itself.
   */
  private async owningDefinition(el: Element): Promise<Element | null> {
    if (el.treeType !== 'library' || !isConfigChildRow(el) || el.parentId === null) return null;
    const parent = await db.elements.get(el.parentId);
    return parent && isDefinitionRow(parent) ? parent : null;
  }

  /**
   * Reassemble the Definition's config with `childId` set to `nextValue` and run
   * the kind's cross-field validator, throwing on failure. Reassembling rather
   * than checking the one value is the point: the rules that matter here
   * (`enum-kv` needs two options, the `LL ≤ L ≤ H ≤ HH` chain) span sub-fields, so
   * no single-value check could see them — and the threshold chain became exactly
   * this kind of rule when `compound` was retired.
   */
  private async assertConfigCoherent(
    def: Element,
    childId: string,
    nextValue: Element['value'],
  ): Promise<void> {
    const children = filterActive(await db.elements.where('parentId').equals(def.id).toArray());
    const byId = new Map(children.map((c) => [c.id, c]));
    const definedKind = readDefinedKind(def.id, (cid) => byId.get(cid)) ?? def.kind;
    const validate = CONFIG_VALIDATORS[definedKind];
    if (!validate) return;
    const next = assembleConfig(def.id, definedKind, (cid) =>
      cid === childId ? { value: nextValue } : byId.get(cid),
    );
    const error = validate(next);
    if (error) {
      throw makeStorageError('validation', error, { retryable: false });
    }
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

        if (shouldLogHistory(existing.treeType)) {
          const rev = await this.nextElementRev(id);
          await this.writeHistory(existing.treeType, {
            elementId: id,
            rev,
            action: 'delete',
            property: 'value',
            prevValue: existing.value,
            newValue: null,
          });
        }

        const updated = await db.elements.get(id);
        if (updated) {
          await this.enqueueIfSynced(existing.treeType, {
            operation: 'update-element',
            entityType: 'element',
            entityId: id,
            payload: updated,
          });
        }
      });

      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'local',
        element: { id, kind: existing.kind, parentId: existing.parentId, name: existing.name, value: existing.value, treeType: existing.treeType, deletedAt: timestamp },
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
          await this.enqueueIfSynced(restored.treeType, {
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
          origin: 'local',
          element: { id: restored.id, kind: restored.kind, parentId: restored.parentId, name: restored.name, value: restored.value, treeType: restored.treeType, deletedAt: restored.deletedAt },
        });
      }
      return createResult(undefined);
    });
  }

  async getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>> {
    return this.run(async () => {
      const all = await db.elementHistory.where('elementId').equals(elementId).toArray();
      all.sort(compareHistory);
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
      // `origin: 'remote'` — the UI still repaints off these, but the sync
      // subscriber must not read a pulled row back as a local change to push.
      storageEventBus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'remote',
        element: { id: element.id, kind: element.kind, parentId: element.parentId, name: element.name, value: element.value, treeType: element.treeType, deletedAt: element.deletedAt },
      });
      // A library row arriving from a pull is a Library change — signal it the same
      // way a local write does. Both halves count: the Definition Element itself,
      // and one of its config Fields (a pulled units change has to repaint every
      // mounted instance exactly like a local edit). A config child names its
      // Definition by `parentId`.
      if (element.treeType === 'library') {
        const definitionId = isDefinitionRow(element) ? element.id : element.parentId;
        if (definitionId !== null) {
          storageEventBus.emit({
            type: 'DEFINITION_WRITTEN',
            origin: 'remote',
            definition: { id: definitionId, deletedAt: element.deletedAt },
          });
        }
      }
    });
  }

  async applyRemoteElementHistory(history: ElementHistory): Promise<void> {
    return this.run(async () => {
      await db.elementHistory.put(history);
    });
  }

  // No `deleteElementLocal` here: nothing in the app removes an element row.
  // Deletion is `softDeleteElement` (sets `deletedAt`) throughout — see
  // FullCollectionSync for why the sync-side purge that used to call it went.

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

  /**
   * Enqueue a sync op only when the element's tree syncs (treePolicy). A
   * `view-state` element never enqueues; business/library/config do. Inert for
   * Phase-1 content (business + library both sync) — the gate only diverges once
   * a `view-state` element is written, which nothing produces yet.
   */
  private async enqueueIfSynced(treeType: TreeType, params: EnqueueParams): Promise<void> {
    if (shouldSyncTreeType(treeType)) {
      await this.syncQueue.enqueue(params);
    }
  }

  /**
   * Write a history entry and enqueue its sync, both routed by the element's
   * tree: `shouldLogHistory` decides whether the audit row is written at all
   * (`view-state` keeps none), and sync of that row follows the same policy as
   * its element. No-op for the untracked trees; identical to before for
   * business/library.
   */
  private async writeHistory(
    treeType: TreeType,
    entry: Parameters<typeof createElementHistoryEntry>[0],
  ): Promise<void> {
    if (!shouldLogHistory(treeType)) return;
    const hist = createElementHistoryEntry(entry);
    await db.elementHistory.put(hist);
    await this.enqueueIfSynced(treeType, {
      operation: 'create-element-history',
      entityType: 'element-history',
      entityId: hist.id,
      payload: hist,
    });
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
