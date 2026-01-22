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
  | 'delete-field'
  | 'create-history';

export type SyncQueueItem = {
  id: string;
  operation: SyncOperation;
  entityType: 'node' | 'field' | 'field-history';
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
  }
}

export const db = new AppDatabase();
