import type { FieldDefinition, DataFieldValue, FieldDefinitionConfig, Element, ElementHistory, ElementHistoryProperty, Kind } from "../models";
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

export type StorageFieldDefinitionCreate = {
  id: string;
  kind: Kind;
  label: string;
  config: FieldDefinitionConfig;
};

// ============================================================================
// Unified Element inputs
// ============================================================================

export type StorageElementCreate = {
  id: string;
  kind: Kind;
  parentId: string | null;
  name: string;
  subtitle?: string | null;
  /** Required for inline (field-like) kinds; null for re-root (node-like) kinds. */
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
  // FieldDefinition operations (the Library — `library`-tree Elements, assembled
  // into FieldDefinition views; no separate table). Phase 1 has no edit path
  // (fork-not-mutate), so there is no updateFieldDefinition.
  listFieldDefinitions(): Promise<StorageResult<FieldDefinition[]>>;
  getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>>;
  createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>>;

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

  // ---- Element sync ---- (library Definitions ride this lane too)
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

  // Delta sync methods (only rows updated since the given timestamp)
  pullElementsSince(since: number): Promise<Element[]>;
  pullElementHistorySince(since: number): Promise<ElementHistory[]>;
}
