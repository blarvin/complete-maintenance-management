import type { DataField, DataFieldHistory, FieldDefinition, DataFieldValue, FieldDefinitionConfig, ComponentType, TreeNode } from "../models";
import type { SyncQueueItem } from "./db";

/**
 * Lightweight metadata returned with adapter results.
 * Keep minimal for Phase 1; extensible later for sync state.
 */
export type StorageMeta = {
  adapter: string; // identifier for diagnostics (e.g., "firestore", "memory")
  fromCache?: boolean;
  latencyMs?: number;
};

export type StorageResult<T> = {
  data: T;
  meta?: StorageMeta;
};

export type StorageNodeCreate = {
  id: string;
  parentId: string | null;
  nodeName: string;
  nodeSubtitle: string;
};

export type StorageNodeUpdate = {
  nodeName?: string;
  nodeSubtitle?: string;
};

export type StorageFieldDefinitionCreate = {
  id: string;
  componentType: ComponentType;
  label: string;
  config: FieldDefinitionConfig;
};

export type StorageFieldDefinitionUpdate = {
  label?: string;
  config?: FieldDefinitionConfig;
};

export type StorageFieldCreate = {
  id: string;
  parentNodeId: string;
  fieldDefinitionId: string;
  cardOrder?: number;
  /** Optional initial value. When provided, the create-event history row
   *  carries this value instead of null, avoiding a redundant "Empty" entry
   *  followed by an immediate update. */
  initialValue?: DataFieldValue | null;
};

export type StorageFieldUpdate = {
  value: DataFieldValue | null;
};

/**
 * Domain-shaped storage adapter contract (backend-agnostic).
 * Does not mirror Firestore; focuses on current domain operations.
 */
export interface StorageAdapter {
  // Tree node operations
  listRootNodes(): Promise<StorageResult<TreeNode[]>>;
  getNode(id: string): Promise<StorageResult<TreeNode | null>>;
  listChildren(parentId: string): Promise<StorageResult<TreeNode[]>>;
  createNode(input: StorageNodeCreate): Promise<StorageResult<TreeNode>>;
  updateNode(id: string, updates: StorageNodeUpdate): Promise<StorageResult<void>>;
  deleteNode(
    id: string,
    opts?: { cascade?: boolean } // Phase 1: expect cascade=false; leaf-only enforced upstream or inside adapter
  ): Promise<StorageResult<void>>;

  // FieldDefinition operations
  listFieldDefinitions(): Promise<StorageResult<FieldDefinition[]>>;
  getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>>;
  createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>>;
  updateFieldDefinition(id: string, updates: StorageFieldDefinitionUpdate): Promise<StorageResult<void>>;

  // Data field operations
  listFields(parentNodeId: string): Promise<StorageResult<DataField[]>>;
  nextCardOrder(parentNodeId: string): Promise<StorageResult<number>>;
  createField(input: StorageFieldCreate): Promise<StorageResult<DataField>>;
  updateFieldValue(id: string, input: StorageFieldUpdate): Promise<StorageResult<void>>;
  deleteField(id: string): Promise<StorageResult<void>>;

  // History
  getFieldHistory(dataFieldId: string): Promise<StorageResult<DataFieldHistory[]>>;

  // Soft delete support - Nodes
  listDeletedNodes(): Promise<StorageResult<TreeNode[]>>;
  listDeletedChildren(parentId: string): Promise<StorageResult<TreeNode[]>>;
  restoreNode(id: string): Promise<StorageResult<void>>;

  // Soft delete support - Fields
  listDeletedFields(parentNodeId: string): Promise<StorageResult<DataField[]>>;
  restoreField(id: string): Promise<StorageResult<void>>;
}

/**
 * Storage adapter with sync capabilities.
 * Extends StorageAdapter with methods for managing sync state.
 *
 * Note: Sync queue operations (getSyncQueue, markSynced, markFailed, enqueue)
 * are handled by SyncQueueManager (see src/data/sync/SyncQueueManager.ts).
 */
export interface SyncableStorageAdapter extends StorageAdapter {
  getLastSyncTimestamp(): Promise<number>;
  setLastSyncTimestamp(timestamp: number): Promise<void>;
  applyRemoteUpdate(entityType: 'node' | 'field' | 'fieldDefinition', entity: TreeNode | DataField | FieldDefinition): Promise<void>;

  // Full collection retrieval methods
  getAllNodes(): Promise<TreeNode[]>;
  getAllFields(): Promise<DataField[]>;
  getAllHistory(): Promise<DataFieldHistory[]>;
  getAllFieldDefinitions(): Promise<FieldDefinition[]>;

  // History sync methods
  applyRemoteHistory(history: DataFieldHistory): Promise<void>;

  // Silent delete methods (no sync queue entry)
  deleteNodeLocal(id: string): Promise<void>;
  deleteFieldLocal(id: string): Promise<void>;
}

/**
 * Remote storage adapter interface for sync operations.
 * Handles applying sync items and pulling changes from remote storage.
 */
export interface RemoteSyncAdapter {
  applySyncItem(item: SyncQueueItem): Promise<void>;
  pullEntitiesSince(type: 'node' | 'field' | 'fieldDefinition', since: number): Promise<Array<TreeNode | DataField | FieldDefinition>>;

  // Full collection pull methods
  pullAllNodes(): Promise<TreeNode[]>;
  pullAllFields(): Promise<DataField[]>;
  pullAllHistory(): Promise<DataFieldHistory[]>;
  pullAllFieldDefinitions(): Promise<FieldDefinition[]>;

  // Delta sync methods
  pullHistorySince(since: number): Promise<DataFieldHistory[]>;
}
