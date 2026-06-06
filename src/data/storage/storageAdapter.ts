import type { DataField, DataFieldHistory, FieldDefinition, DataFieldValue, FieldDefinitionConfig, ComponentType, TreeNode, Element, ElementHistory, ElementHistoryProperty, Kind } from "../models";
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

// ============================================================================
// Unified Element inputs (additive — coexist with legacy node/field inputs)
// ============================================================================

export type StorageElementCreate = {
  id: string;
  kind: Kind;
  parentId: string | null;
  name: string;
  subtitle?: string | null;
  /** Required when kind !== "node". */
  fieldDefinitionId?: string | null;
  /** Optional initial value (for value-bearing kinds). */
  value?: DataFieldValue | null;
  /** Optional explicit sibling order; auto-minted via nextSiblingOrder when omitted. */
  siblingOrder?: number;
};

export type StorageElementUpdate = Partial<{
  name: string;
  subtitle: string | null;
  value: DataFieldValue | null;
  parentId: string | null;
  siblingOrder: number;
}>;

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

  // ============================================================================
  // Element operations (unified primitive — see plan: unified-element-data-model)
  // ============================================================================
  listRootElements(): Promise<StorageResult<Element[]>>;
  getElement(id: string): Promise<StorageResult<Element | null>>;
  listChildElements(parentId: string): Promise<StorageResult<Element[]>>;
  listChildElementsByKind(parentId: string, kind: Kind): Promise<StorageResult<Element[]>>;
  nextSiblingOrder(parentId: string | null): Promise<StorageResult<number>>;
  createElement(input: StorageElementCreate): Promise<StorageResult<Element>>;
  updateElement(id: string, updates: StorageElementUpdate): Promise<StorageResult<void>>;
  softDeleteElement(id: string): Promise<StorageResult<void>>;
  restoreElement(id: string): Promise<StorageResult<void>>;
  getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>>;
}

/**
 * Property metadata for element history bookkeeping.
 */
export type ElementHistoryAction = 'create' | 'update' | 'delete';
export type { ElementHistoryProperty };

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

  // FieldDefinition remote apply (server-authority upsert from a pull).
  applyRemoteFieldDefinition(entity: FieldDefinition): Promise<void>;
  getAllFieldDefinitions(): Promise<FieldDefinition[]>;

  // ---- Element sync ----
  getAllElements(): Promise<Element[]>;
  getAllElementHistory(): Promise<ElementHistory[]>;
  applyRemoteElement(element: Element): Promise<void>;
  applyRemoteElementHistory(history: ElementHistory): Promise<void>;
  /** Silent hard delete (no sync queue entry) — used by full-collection reconcile. */
  deleteElementLocal(id: string): Promise<void>;
}

/**
 * Remote storage adapter interface for sync operations.
 * Handles applying sync items and pulling changes from remote storage.
 */
export interface RemoteSyncAdapter {
  applySyncItem(item: SyncQueueItem): Promise<void>;

  // Full collection pull methods
  pullAllElements(): Promise<Element[]>;
  pullAllElementHistory(): Promise<ElementHistory[]>;
  pullAllFieldDefinitions(): Promise<FieldDefinition[]>;

  // Delta sync methods (only rows updated since the given timestamp)
  pullElementsSince(since: number): Promise<Element[]>;
  pullElementHistorySince(since: number): Promise<ElementHistory[]>;
  pullFieldDefinitionsSince(since: number): Promise<FieldDefinition[]>;
}
