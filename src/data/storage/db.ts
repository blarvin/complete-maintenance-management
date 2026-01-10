/**
 * Dexie Database Schema (Stub for TDD)
 *
 * This is a minimal stub so tests can import it.
 * All methods will fail until you implement them.
 */

import Dexie, { Table } from 'dexie';
import type { TreeNode, DataField, DataFieldHistory } from '../models';

export type SyncOperation =
  | 'create-node'
  | 'update-node'
  | 'delete-node'
  | 'create-field'
  | 'update-field'
  | 'delete-field';

export type SyncQueueItem = {
  id: string;
  operation: SyncOperation;
  entityType: 'node' | 'field' | 'field-history';
  entityId: string;
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
};

export type SyncMetadata = {
  key: string;
  value: any;
};

export class AppDatabase extends Dexie {
  nodes!: Table<TreeNode, string>;
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
  }
}

export const db = new AppDatabase();
