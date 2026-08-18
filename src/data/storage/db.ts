/**
 * Dexie Database Schema.
 */

import Dexie, { Table } from 'dexie';
import type { Element, ElementHistory } from '../models';
import { syncTarget } from '../syncTarget';

/**
 * The Dexie database name, scoped by sync target.
 *
 * The two targets must not share one database. `FullCollectionSync` deletes
 * local elements absent from *its* remote, so on a shared database every flip
 * between production and the emulator wipes the other target's data (observed:
 * flipping to the emulator blanked the seeded tree).
 *
 * Production deliberately keeps the original unsuffixed name so existing local
 * data survives this change; only the emulator moves.
 */
const DB_NAME_BY_TARGET: Record<typeof syncTarget, string> = {
  production: 'complete-maintenance-management',
  emulator: 'complete-maintenance-management-emulator',
};

export const DB_NAME = DB_NAME_BY_TARGET[syncTarget];

export type SyncOperation =
  | 'create-element'
  | 'update-element'
  | 'delete-element'
  | 'create-element-history';

export type SyncQueueItem = {
  id: string;
  operation: SyncOperation;
  entityType: 'element' | 'element-history';
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any; // Dynamic payload for different entity types
  timestamp: number;
  status: 'pending' | 'failed';
  retryCount: number;
  lastError?: string;
};

export type SyncMetadata = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any; // Generic metadata value
};

export class AppDatabase extends Dexie {
  elements!: Table<Element, string>;
  elementHistory!: Table<ElementHistory, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      nodes: 'id, parentId, updatedAt',
      fields: 'id, parentNodeId, cardOrder, updatedAt',
      history: 'id, dataFieldId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    });

    // Version 2: Add deletedAt indexes for soft delete support
    this.version(2).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      fields: 'id, parentNodeId, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    });

    // Version 3: Components/Templates/Instances spine.
    // DataField shape changed (fieldValue -> templateId + componentType + value).
    // No migration path — wipe all non-schema state so the old shape cannot leak.
    this.version(3).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      templates: 'id, componentType, updatedAt',
      fields: 'id, parentNodeId, templateId, componentType, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      // Clear everything — plan explicitly opts out of migration.
      await Promise.all([
        tx.table('nodes').clear(),
        tx.table('fields').clear(),
        tx.table('history').clear(),
        tx.table('templates').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 4: Template → FieldDefinition rename.
    // Renames the `templates` store to `fieldDefinitions` and DataField
    // `templateId` → `fieldDefinitionId`. Clear-on-upgrade — no migration path.
    this.version(4).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      templates: null, // drop old store
      fieldDefinitions: 'id, componentType, updatedAt',
      fields: 'id, parentNodeId, fieldDefinitionId, componentType, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('nodes').clear(),
        tx.table('fields').clear(),
        tx.table('history').clear(),
        tx.table('fieldDefinitions').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 5: FieldDefinition gains `authorId` (sync wiring) and
    // `deletedAt` (admin-only soft delete tombstone). Index both: authorId for
    // future "my contributions" queries; deletedAt for filtered listings.
    // Clear-on-upgrade — no migration path.
    this.version(5).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      fieldDefinitions: 'id, componentType, authorId, updatedAt, deletedAt',
      fields: 'id, parentNodeId, fieldDefinitionId, componentType, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('nodes').clear(),
        tx.table('fields').clear(),
        tx.table('history').clear(),
        tx.table('fieldDefinitions').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 6: `measurement-kv` componentType → `number-kv` (new richer
    // config shape: unitsSymbol, displayFormat, nominal range/discrete, ISA
    // L/LL/H/HH thresholds, expectedRefreshSeconds). Schema indexes
    // unchanged; the rename lives in row payloads. Clear-on-upgrade — no
    // migration path for prototype data.
    this.version(6).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      fieldDefinitions: 'id, componentType, authorId, updatedAt, deletedAt',
      fields: 'id, parentNodeId, fieldDefinitionId, componentType, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('nodes').clear(),
        tx.table('fields').clear(),
        tx.table('history').clear(),
        tx.table('fieldDefinitions').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 7: Unified Element model. Adds `elements` and `elementHistory`
    // stores alongside the legacy `nodes`/`fields`/`history` stores. Legacy
    // stores remain until adapters are rewritten (next commit), at which
    // point a v8 drops them. Clear-on-upgrade — no migration path.
    this.version(7).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      fieldDefinitions: 'id, componentType, authorId, updatedAt, deletedAt',
      fields: 'id, parentNodeId, fieldDefinitionId, componentType, cardOrder, updatedAt, deletedAt',
      history: 'id, dataFieldId, parentNodeId, updatedAt, rev',
      elements: 'id, parentId, kind, fieldDefinitionId, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('nodes').clear(),
        tx.table('fields').clear(),
        tx.table('history').clear(),
        tx.table('fieldDefinitions').clear(),
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 8: Drop the legacy `nodes` / `fields` / `history` stores now that
    // the entire data + sync path runs on `elements` / `elementHistory`.
    // Setting a store to `null` deletes it. Clear-on-upgrade — no migration.
    this.version(8).stores({
      nodes: null,
      fields: null,
      history: null,
      fieldDefinitions: 'id, componentType, authorId, updatedAt, deletedAt',
      elements: 'id, parentId, kind, fieldDefinitionId, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('fieldDefinitions').clear(),
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 9: FieldDefinition `componentType` field/index → `kind`, aligning
    // the Library discriminant with Element.kind ahead of the registry widening.
    // The index is renamed; the rename also lives in row payloads. `elements`
    // already indexes `kind` — unchanged. Clear-on-upgrade — no migration path.
    this.version(9).stores({
      fieldDefinitions: 'id, kind, authorId, updatedAt, deletedAt',
      elements: 'id, parentId, kind, fieldDefinitionId, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('fieldDefinitions').clear(),
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 10: Config-as-Elements. FieldDefinitions collapse into the
    // `elements` store as `treeType: 'library'` Elements whose config is their
    // child sub-field subtree — the standalone `fieldDefinitions` table (and its
    // `config` blob) is dropped. `elements` gains a `treeType` index so business
    // root/sibling queries can scope to the business tree. Clear-on-upgrade — no
    // migration path (prototype data, freely wiped).
    this.version(10).stores({
      fieldDefinitions: null, // drop the table — Library now lives in `elements`
      elements: 'id, parentId, kind, fieldDefinitionId, treeType, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 11: the binding column un-field-specifics — `fieldDefinitionId` →
    // `definitionId` (the Definition-binding seam; re-root policy containers bind
    // through the same column fields use). Index renamed to match the Element
    // shape. Clear-on-upgrade — no migration path (prototype data, freely wiped).
    this.version(11).stores({
      elements: 'id, parentId, kind, definitionId, treeType, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });

    // Version 12: the Library becomes a place in the tree. Every stored library
    // row changes shape at once — a Definition is now `kind: 'node'` with
    // `definitionId === id` under the `Field Library` Node, its defined kind moved
    // into a `::cfg::kind` child, config is materialized rather than sparse, and
    // the `compound` kind is gone. Identical stores to v11; the change is entirely
    // in row payloads, so this version exists only for its clear-on-upgrade — an
    // old row would fail the new identity test and read as an orphan.
    this.version(12).stores({
      elements: 'id, parentId, kind, definitionId, treeType, siblingOrder, updatedAt, deletedAt',
      elementHistory: 'id, elementId, updatedAt, rev, [elementId+rev]',
      syncQueue: 'id, status, timestamp, entityType',
      syncMetadata: 'key',
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table('elements').clear(),
        tx.table('elementHistory').clear(),
        tx.table('syncQueue').clear(),
        tx.table('syncMetadata').clear(),
      ]);
    });
  }
}

export const db = new AppDatabase();
