import type { DataField, DataFieldHistory, TreeNode } from "../models";

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

export type StorageFieldCreate = {
  id: string;
  parentNodeId: string;
  fieldName: string;
  fieldValue: string | null;
  cardOrder?: number;
};

export type StorageFieldUpdate = {
  fieldValue: string | null;
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

  // Data field operations
  listFields(parentNodeId: string): Promise<StorageResult<DataField[]>>;
  nextCardOrder(parentNodeId: string): Promise<StorageResult<number>>;
  createField(input: StorageFieldCreate): Promise<StorageResult<DataField>>;
  updateFieldValue(id: string, input: StorageFieldUpdate): Promise<StorageResult<void>>;
  deleteField(id: string): Promise<StorageResult<void>>;

  // History
  getFieldHistory(dataFieldId: string): Promise<StorageResult<DataFieldHistory[]>>;
}
