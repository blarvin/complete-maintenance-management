/**
 * Dexie Database Schema.
 */

import Dexie, { Table } from 'dexie';
import type { TreeNode, DataField, DataFieldHistory, DataFieldTemplate } from '../models';

export type SyncOperation =
  | 'create-node'
  | 'update-node'
  | 'delete-node'
  | 'create-field'
  | 'update-field'
  | 'delete-field'
  | 'create-history'
  | 'create-template'
  | 'update-template'
  | 'delete-template';

export type SyncQueueItem = {
  id: string;
  operation: SyncOperation;
  entityType: 'node' | 'field' | 'field-history' | 'template';
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any; // Dynamic payload for different entity types
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
};

export type SyncMetadata = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any; // Generic metadata value
};

export class AppDatabase extends Dexie {
  nodes!: Table<TreeNode, string>;
  templates!: Table<DataFieldTemplate, string>;
  fields!: Table<DataField, string>;
  history!: Table<DataFieldHistory, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('complete-maintenance-management');

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
  }
}

export const db = new AppDatabase();
