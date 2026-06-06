/**
 * FirestoreAdapter - Concrete implementation of StorageAdapter for Firestore.
 *
 * Encapsulates all Firestore-specific operations behind the StorageAdapter interface,
 * enabling backend independence and architectural purity.
 */

import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  FirestoreError,
  serverTimestamp,
} from "firebase/firestore";
import type { TreeNode, DataField, DataFieldHistory, FieldDefinition, Element, ElementHistory, ElementHistoryProperty, Kind } from "../models";
import { filterDeleted } from "../models";
import type { StorageAdapter, RemoteSyncAdapter, StorageResult, StorageNodeCreate, StorageNodeUpdate, StorageFieldDefinitionCreate, StorageFieldDefinitionUpdate, StorageFieldCreate, StorageFieldUpdate, StorageElementCreate, StorageElementUpdate } from "./storageAdapter";
import type { SyncQueueItem } from "./db";
import { COLLECTIONS } from "../../constants";
import { getCurrentUserId } from "../../context/userContext";

/**
 * Convert Firestore Timestamp fields to epoch ms numbers.
 * Firestore returns Timestamp objects for serverTimestamp() fields;
 * our domain models expect plain numbers (epoch ms).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceTimestamps<T>(data: any): T {
  if (data && typeof data === 'object') {
    for (const key of ['updatedAt', 'deletedAt']) {
      const val = data[key];
      if (val != null && typeof val === 'object' && typeof val.toMillis === 'function') {
        data[key] = val.toMillis();
      }
    }
  }
  return data as T;
}
import { createHistoryEntry, computeNextRev, createElementHistoryEntry } from "./historyHelpers";
import { now } from "../../utils/time";
import { toStorageError, makeStorageError, isStorageError } from "./storageErrors";

/**
 * Maps Firestore error codes to StorageError codes.
 */
function mapFirestoreError(err: unknown): { code: "not-found" | "validation" | "conflict" | "unauthorized" | "unavailable" | "internal"; retryable: boolean } {
  if (err instanceof FirestoreError) {
    switch (err.code) {
      case "permission-denied":
        return { code: "unauthorized", retryable: false };
      case "not-found":
        return { code: "not-found", retryable: false };
      case "unavailable":
        return { code: "unavailable", retryable: true };
      case "failed-precondition":
        return { code: "conflict", retryable: false };
      case "invalid-argument":
        return { code: "validation", retryable: false };
      default:
        return { code: "internal", retryable: false };
    }
  }
  return { code: "internal", retryable: false };
}

import { createResult as _createResult } from './storageResult';

function createResult<T>(data: T): StorageResult<T> {
  return _createResult(data, 'firestore');
}

export class FirestoreAdapter implements StorageAdapter, RemoteSyncAdapter {
  // ============================================================================
  // Node Operations
  // ============================================================================

  async listRootNodes(): Promise<StorageResult<TreeNode[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.NODES),
        where("parentId", "==", null),
        where("deletedAt", "==", null), // Filter out soft-deleted
        orderBy("updatedAt", "asc")
      );
      const snap = await getDocs(q);
      const nodes = snap.docs.map((d) => coerceTimestamps<TreeNode>(d.data()));
      return createResult(nodes);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async getNode(id: string): Promise<StorageResult<TreeNode | null>> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.NODES, id));
      const node = snap.exists() ? coerceTimestamps<TreeNode>(snap.data()) : null;
      return createResult(node);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async listChildren(parentId: string): Promise<StorageResult<TreeNode[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.NODES),
        where("parentId", "==", parentId),
        where("deletedAt", "==", null), // Filter out soft-deleted
        orderBy("updatedAt", "asc")
      );
      const snap = await getDocs(q);
      const nodes = snap.docs.map((d) => coerceTimestamps<TreeNode>(d.data()));
      return createResult(nodes);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async createNode(input: StorageNodeCreate): Promise<StorageResult<TreeNode>> {
    try {
      const node: TreeNode = {
        ...input,
        updatedBy: getCurrentUserId(),
        updatedAt: now(),
        deletedAt: null, // Initialize as active (not soft-deleted)
      };
      await setDoc(doc(collection(db, COLLECTIONS.NODES), node.id), node);
      return createResult(node);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async updateNode(id: string, updates: StorageNodeUpdate): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.NODES, id);
      await updateDoc(ref, {
        ...updates,
        updatedBy: getCurrentUserId(),
        updatedAt: now(),
      });
      return createResult(undefined);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteNode(id: string, _opts?: { cascade?: boolean }): Promise<StorageResult<void>> {
    try {
      // Soft delete: set deletedAt timestamp instead of hard delete
      // Note: Children are implicitly hidden (not cascade soft-deleted)
      const ts = now();
      const userId = getCurrentUserId();
      const ref = doc(db, COLLECTIONS.NODES, id);

      await updateDoc(ref, {
        deletedAt: ts,
        updatedAt: ts,
        updatedBy: userId,
      });

      return createResult(undefined);
    } catch (err) {
      if (isStorageError(err)) {
        throw err;
      }
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // ============================================================================
  // Field Operations
  // ============================================================================

  async listFields(parentNodeId: string): Promise<StorageResult<DataField[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.FIELDS),
        where("parentNodeId", "==", parentNodeId),
        where("deletedAt", "==", null), // Filter out soft-deleted
        orderBy("cardOrder", "asc")
      );
      const snap = await getDocs(q);
      const fields = snap.docs.map((d) => coerceTimestamps<DataField>(d.data()));
      return createResult(fields);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async nextCardOrder(parentNodeId: string): Promise<StorageResult<number>> {
    try {
      const fieldsResult = await this.listFields(parentNodeId);
      const fields = fieldsResult.data;
      if (fields.length === 0) {
        return createResult(0);
      }
      const maxOrder = Math.max(...fields.map((f) => f.cardOrder));
      return createResult(maxOrder + 1);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async createField(input: StorageFieldCreate): Promise<StorageResult<DataField>> {
    try {
      const defSnap = await getDoc(doc(db, COLLECTIONS.FIELD_DEFINITIONS, input.fieldDefinitionId));
      if (!defSnap.exists()) {
        throw makeStorageError("not-found", `FieldDefinition not found: ${input.fieldDefinitionId}`, { retryable: false });
      }
      const definition = coerceTimestamps<FieldDefinition>(defSnap.data());

      const ts = now();
      const userId = getCurrentUserId();

      const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;

      const field: DataField = {
        id: input.id,
        parentNodeId: input.parentNodeId,
        fieldDefinitionId: definition.id,
        componentType: definition.componentType,
        fieldName: definition.label,
        value: input.initialValue ?? null,
        cardOrder: order,
        updatedBy: userId,
        updatedAt: ts,
        deletedAt: null,
      };

      await setDoc(doc(collection(db, COLLECTIONS.FIELDS), field.id), field);

      const rev = await this.nextRev(field.id);
      const hist = createHistoryEntry({
        dataFieldId: field.id,
        parentNodeId: field.parentNodeId,
        componentType: field.componentType,
        action: "create",
        prevValue: null,
        newValue: field.value,
        rev,
      });
      await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);

      return createResult(field);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async updateFieldValue(id: string, input: StorageFieldUpdate): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.FIELDS, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw makeStorageError("not-found", "Field not found", { retryable: false });
      }

      const prev = coerceTimestamps<DataField>(snap.data());
      const ts = now();
      const userId = getCurrentUserId();

      await updateDoc(ref, {
        value: input.value,
        updatedAt: ts,
        updatedBy: userId,
      });

      const rev = await this.nextRev(id);
      const hist = createHistoryEntry({
        dataFieldId: id,
        parentNodeId: prev.parentNodeId,
        componentType: prev.componentType,
        action: "update",
        prevValue: prev.value,
        newValue: input.value,
        rev,
      });
      await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);

      return createResult(undefined);
    } catch (err) {
      if (isStorageError(err)) {
        throw err;
      }
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async deleteField(id: string): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.FIELDS, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return createResult(undefined);
      }

      const prev = coerceTimestamps<DataField>(snap.data());
      const ts = now();
      const userId = getCurrentUserId();

      await updateDoc(ref, {
        deletedAt: ts,
        updatedAt: ts,
        updatedBy: userId,
      });

      const rev = await this.nextRev(id);
      const hist = createHistoryEntry({
        dataFieldId: id,
        parentNodeId: prev.parentNodeId,
        componentType: prev.componentType,
        action: "delete",
        prevValue: prev.value,
        newValue: null,
        rev,
      });
      await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);

      return createResult(undefined);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // ============================================================================
  // FieldDefinition Operations
  // ============================================================================

  async listFieldDefinitions(): Promise<StorageResult<FieldDefinition[]>> {
    try {
      // Firestore: filter soft-deleted server-side (deletedAt == null).
      const q = query(
        collection(db, COLLECTIONS.FIELD_DEFINITIONS),
        where('deletedAt', '==', null),
      );
      const snap = await getDocs(q);
      const definitions = snap.docs.map(d => coerceTimestamps<FieldDefinition>(d.data()));
      definitions.sort((a, b) => a.label.localeCompare(b.label));
      return createResult(definitions);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, { code: mapped.code, retryable: mapped.retryable });
    }
  }

  async getFieldDefinition(id: string): Promise<StorageResult<FieldDefinition | null>> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.FIELD_DEFINITIONS, id));
      const def = snap.exists() ? coerceTimestamps<FieldDefinition>(snap.data()) : null;
      return createResult(def);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, { code: mapped.code, retryable: mapped.retryable });
    }
  }

  async createFieldDefinition(input: StorageFieldDefinitionCreate): Promise<StorageResult<FieldDefinition>> {
    try {
      const userId = getCurrentUserId();
      const definition: FieldDefinition = {
        id: input.id,
        componentType: input.componentType,
        label: input.label,
        config: input.config,
        authorId: userId,
        updatedBy: userId,
        updatedAt: now(),
        deletedAt: null,
      };
      await setDoc(doc(collection(db, COLLECTIONS.FIELD_DEFINITIONS), definition.id), definition);
      return createResult(definition);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, { code: mapped.code, retryable: mapped.retryable });
    }
  }

  async updateFieldDefinition(id: string, updates: StorageFieldDefinitionUpdate): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.FIELD_DEFINITIONS, id);
      await updateDoc(ref, {
        ...updates,
        updatedBy: getCurrentUserId(),
        updatedAt: now(),
      });
      return createResult(undefined);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, { code: mapped.code, retryable: mapped.retryable });
    }
  }

  // ============================================================================
  // History Operations
  // ============================================================================

  async getFieldHistory(dataFieldId: string): Promise<StorageResult<DataFieldHistory[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.HISTORY),
        where("dataFieldId", "==", dataFieldId),
        orderBy("rev", "asc")
      );
      const snap = await getDocs(q);
      const history = snap.docs.map((d) => coerceTimestamps<DataFieldHistory>(d.data()));
      return createResult(history);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // ============================================================================
  // Soft Delete Operations - Nodes
  // ============================================================================

  async listDeletedNodes(): Promise<StorageResult<TreeNode[]>> {
    try {
      // Query for nodes where deletedAt is set (not null)
      // Note: Firestore doesn't support "!= null", so we use > 0 for timestamp
      const q = query(
        collection(db, COLLECTIONS.NODES),
        where("deletedAt", ">", 0),
        orderBy("deletedAt", "desc")
      );
      const snap = await getDocs(q);
      const nodes = snap.docs.map((d) => coerceTimestamps<TreeNode>(d.data()));
      return createResult(nodes);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async listDeletedChildren(parentId: string): Promise<StorageResult<TreeNode[]>> {
    try {
      // Get all children and filter to deleted ones
      const q = query(
        collection(db, COLLECTIONS.NODES),
        where("parentId", "==", parentId)
      );
      const snap = await getDocs(q);
      const allChildren = snap.docs.map((d) => coerceTimestamps<TreeNode>(d.data()));
      const deletedChildren = filterDeleted(allChildren);
      // Sort by deletedAt descending
      deletedChildren.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
      return createResult(deletedChildren);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async restoreNode(id: string): Promise<StorageResult<void>> {
    try {
      const ts = now();
      const userId = getCurrentUserId();
      const ref = doc(db, COLLECTIONS.NODES, id);

      await updateDoc(ref, {
        deletedAt: null, // Clear soft delete
        updatedAt: ts,
        updatedBy: userId,
      });

      return createResult(undefined);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // ============================================================================
  // Soft Delete Operations - Fields
  // ============================================================================

  async listDeletedFields(parentNodeId: string): Promise<StorageResult<DataField[]>> {
    try {
      // Get all fields for this node and filter to deleted ones
      const q = query(
        collection(db, COLLECTIONS.FIELDS),
        where("parentNodeId", "==", parentNodeId)
      );
      const snap = await getDocs(q);
      const allFields = snap.docs.map((d) => coerceTimestamps<DataField>(d.data()));
      const deletedFields = filterDeleted(allFields);
      // Sort by deletedAt descending
      deletedFields.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
      return createResult(deletedFields);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  async restoreField(id: string): Promise<StorageResult<void>> {
    try {
      const ts = now();
      const userId = getCurrentUserId();
      const ref = doc(db, COLLECTIONS.FIELDS, id);

      await updateDoc(ref, {
        deletedAt: null, // Clear soft delete
        updatedAt: ts,
        updatedBy: userId,
      });

      return createResult(undefined);
    } catch (err) {
      const mapped = mapFirestoreError(err);
      throw toStorageError(err, {
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  }

  // ============================================================================
  // Remote Sync Operations (RemoteSyncAdapter)
  // ============================================================================

  /**
   * Apply a sync queue item to Firestore.
   * Handles create/update/delete operations for nodes and fields.
   * Uses serverTimestamp() for authoritative timestamps (no clock skew).
   * Uses soft delete for delete operations (enables delta sync detection).
   */
  async applySyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create-node': {
        const node = item.payload as TreeNode;
        await setDoc(doc(db, COLLECTIONS.NODES, node.id), {
          ...node,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'update-node': {
        const node = item.payload as TreeNode;
        await setDoc(doc(db, COLLECTIONS.NODES, node.id), {
          ...node,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }
      case 'delete-node': {
        // Soft delete with server timestamp (enables delta sync detection)
        const ref = doc(db, COLLECTIONS.NODES, item.entityId);
        await updateDoc(ref, {
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'create-field': {
        const field = item.payload as DataField;
        await setDoc(doc(db, COLLECTIONS.FIELDS, field.id), {
          ...field,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'update-field': {
        const field = item.payload as DataField;
        await setDoc(doc(db, COLLECTIONS.FIELDS, field.id), {
          ...field,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }
      case 'delete-field': {
        // Soft delete with server timestamp (enables delta sync detection)
        const ref = doc(db, COLLECTIONS.FIELDS, item.entityId);
        await updateDoc(ref, {
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'create-history': {
        const history = item.payload as DataFieldHistory;
        await setDoc(doc(db, COLLECTIONS.HISTORY, history.id), {
          ...history,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'create-fieldDefinition': {
        const def = item.payload as FieldDefinition;
        await setDoc(doc(db, COLLECTIONS.FIELD_DEFINITIONS, def.id), {
          ...def,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'update-fieldDefinition': {
        const def = item.payload as FieldDefinition;
        await setDoc(doc(db, COLLECTIONS.FIELD_DEFINITIONS, def.id), {
          ...def,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }
      case 'create-element': {
        const element = item.payload as Element;
        await setDoc(doc(db, COLLECTIONS.ELEMENTS, element.id), {
          ...element,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'update-element': {
        // Soft delete reuses this op (payload carries deletedAt); merge so a
        // partial update never clobbers untouched columns.
        const element = item.payload as Element;
        await setDoc(doc(db, COLLECTIONS.ELEMENTS, element.id), {
          ...element,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      }
      case 'delete-element': {
        const ref = doc(db, COLLECTIONS.ELEMENTS, item.entityId);
        await updateDoc(ref, {
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        break;
      }
      case 'create-element-history': {
        const history = item.payload as ElementHistory;
        await setDoc(doc(db, COLLECTIONS.ELEMENT_HISTORY, history.id), {
          ...history,
          updatedAt: serverTimestamp(),
        });
        break;
      }
      default:
        console.warn('[FirestoreAdapter] Unknown sync operation:', item.operation);
    }
  }

  /**
   * Pull all elements from Firestore (full collection).
   * Used for full collection sync to detect deletions.
   */
  async pullAllElements(): Promise<Element[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.ELEMENTS));
    return snap.docs.map(d => coerceTimestamps<Element>(d.data()));
  }

  /**
   * Pull all element history from Firestore (full collection).
   */
  async pullAllElementHistory(): Promise<ElementHistory[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.ELEMENT_HISTORY));
    return snap.docs.map(d => coerceTimestamps<ElementHistory>(d.data()));
  }

  /**
   * Pull all FieldDefinitions from Firestore (full collection).
   */
  async pullAllFieldDefinitions(): Promise<FieldDefinition[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.FIELD_DEFINITIONS));
    return snap.docs.map(d => coerceTimestamps<FieldDefinition>(d.data()));
  }

  /**
   * Pull elements updated since the given timestamp (delta sync).
   * Soft deletes surface as rows with deletedAt set and a bumped updatedAt.
   */
  async pullElementsSince(since: number): Promise<Element[]> {
    const q = query(
      collection(db, COLLECTIONS.ELEMENTS),
      where('updatedAt', '>', since)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => coerceTimestamps<Element>(d.data()));
  }

  /**
   * Pull element history updated since the given timestamp (delta sync).
   */
  async pullElementHistorySince(since: number): Promise<ElementHistory[]> {
    const q = query(
      collection(db, COLLECTIONS.ELEMENT_HISTORY),
      where('updatedAt', '>', since)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => coerceTimestamps<ElementHistory>(d.data()));
  }

  /**
   * Pull FieldDefinitions updated since the given timestamp from Firestore.
   * Used for delta sync to fetch only new/changed Library entries.
   */
  async pullFieldDefinitionsSince(since: number): Promise<FieldDefinition[]> {
    const q = query(
      collection(db, COLLECTIONS.FIELD_DEFINITIONS),
      where('updatedAt', '>', since)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => coerceTimestamps<FieldDefinition>(d.data()));
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Get the next revision number for a data field.
   * Returns max(rev) + 1, or 0 if no history exists.
   */
  private async nextRev(dataFieldId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTIONS.HISTORY),
      where("dataFieldId", "==", dataFieldId),
      orderBy("rev", "desc")
    );
    const snap = await getDocs(q);
    const histories = snap.docs.map(d => d.data() as DataFieldHistory);
    return computeNextRev(histories);
  }

  // ============================================================================
  // Element Operations (unified primitive)
  // ============================================================================

  async listRootElements(): Promise<StorageResult<Element[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ELEMENTS),
        where("parentId", "==", null),
        where("deletedAt", "==", null),
        orderBy("siblingOrder", "asc"),
      );
      const snap = await getDocs(q);
      const els = snap.docs.map(d => coerceTimestamps<Element>(d.data()));
      return createResult(els);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getElement(id: string): Promise<StorageResult<Element | null>> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.ELEMENTS, id));
      if (!snap.exists()) return createResult(null);
      return createResult(coerceTimestamps<Element>(snap.data()));
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async listChildElements(parentId: string): Promise<StorageResult<Element[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ELEMENTS),
        where("parentId", "==", parentId),
        where("deletedAt", "==", null),
        orderBy("siblingOrder", "asc"),
      );
      const snap = await getDocs(q);
      const els = snap.docs.map(d => coerceTimestamps<Element>(d.data()));
      return createResult(els);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async listChildElementsByKind(parentId: string, kind: Kind): Promise<StorageResult<Element[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ELEMENTS),
        where("parentId", "==", parentId),
        where("kind", "==", kind),
        where("deletedAt", "==", null),
        orderBy("siblingOrder", "asc"),
      );
      const snap = await getDocs(q);
      const els = snap.docs.map(d => coerceTimestamps<Element>(d.data()));
      return createResult(els);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async nextSiblingOrder(parentId: string | null): Promise<StorageResult<number>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ELEMENTS),
        where("parentId", "==", parentId),
      );
      const snap = await getDocs(q);
      if (snap.empty) return createResult(0);
      const orders = snap.docs.map(d => (d.data() as Element).siblingOrder);
      return createResult(Math.max(...orders) + 1);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async createElement(input: StorageElementCreate): Promise<StorageResult<Element>> {
    try {
      if (input.kind !== "node" && !input.fieldDefinitionId) {
        throw makeStorageError("validation", `fieldDefinitionId required for kind=${input.kind}`, { retryable: false });
      }
      const order = input.siblingOrder ?? (await this.nextSiblingOrder(input.parentId)).data;
      const userId = getCurrentUserId();
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
        updatedAt: now(),
        deletedAt: null,
      };
      await setDoc(doc(collection(db, COLLECTIONS.ELEMENTS), element.id), { ...element, updatedAt: serverTimestamp() });
      const rev = await this.nextElementRev(element.id);
      const hist = createElementHistoryEntry({
        elementId: element.id,
        rev,
        action: "create",
        property: "value",
        prevValue: null,
        newValue: element.value,
      });
      await setDoc(doc(collection(db, COLLECTIONS.ELEMENT_HISTORY), hist.id), { ...hist, updatedAt: serverTimestamp() });
      return createResult(element);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async updateElement(id: string, updates: StorageElementUpdate): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.ELEMENTS, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw makeStorageError("not-found", `Element not found: ${id}`, { retryable: false });
      }
      const existing = coerceTimestamps<Element>(snap.data());

      const changedProps: Array<{ property: ElementHistoryProperty; prev: unknown; next: unknown }> = [];
      if ("name" in updates && updates.name !== existing.name) changedProps.push({ property: "name", prev: existing.name, next: updates.name });
      if ("subtitle" in updates && (updates.subtitle ?? null) !== existing.subtitle) changedProps.push({ property: "subtitle", prev: existing.subtitle, next: updates.subtitle ?? null });
      if ("value" in updates && updates.value !== existing.value) changedProps.push({ property: "value", prev: existing.value, next: updates.value });
      if ("parentId" in updates && (updates.parentId ?? null) !== existing.parentId) changedProps.push({ property: "parentId", prev: existing.parentId, next: updates.parentId ?? null });
      if ("siblingOrder" in updates && updates.siblingOrder !== existing.siblingOrder) changedProps.push({ property: "siblingOrder", prev: existing.siblingOrder, next: updates.siblingOrder });

      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: getCurrentUserId(),
      });

      let rev = await this.nextElementRev(id);
      for (const c of changedProps) {
        const hist = createElementHistoryEntry({
          elementId: id,
          rev: rev++,
          action: "update",
          property: c.property,
          prevValue: c.prev,
          newValue: c.next,
        });
        await setDoc(doc(collection(db, COLLECTIONS.ELEMENT_HISTORY), hist.id), { ...hist, updatedAt: serverTimestamp() });
      }
      return createResult(undefined);
    } catch (err) {
      if (isStorageError(err)) throw err;
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async softDeleteElement(id: string): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.ELEMENTS, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return createResult(undefined);
      const existing = coerceTimestamps<Element>(snap.data());

      await updateDoc(ref, {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: getCurrentUserId(),
      });
      const rev = await this.nextElementRev(id);
      const hist = createElementHistoryEntry({
        elementId: id,
        rev,
        action: "delete",
        property: "value",
        prevValue: existing.value,
        newValue: null,
      });
      await setDoc(doc(collection(db, COLLECTIONS.ELEMENT_HISTORY), hist.id), { ...hist, updatedAt: serverTimestamp() });
      return createResult(undefined);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async restoreElement(id: string): Promise<StorageResult<void>> {
    try {
      const ref = doc(db, COLLECTIONS.ELEMENTS, id);
      await updateDoc(ref, {
        deletedAt: null,
        updatedAt: serverTimestamp(),
        updatedBy: getCurrentUserId(),
      });
      return createResult(undefined);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  async getElementHistory(elementId: string): Promise<StorageResult<ElementHistory[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ELEMENT_HISTORY),
        where("elementId", "==", elementId),
        orderBy("rev", "asc"),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => coerceTimestamps<ElementHistory>(d.data()));
      return createResult(rows);
    } catch (err) {
      const { code, retryable } = mapFirestoreError(err);
      throw toStorageError(err, { code, retryable });
    }
  }

  private async nextElementRev(elementId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTIONS.ELEMENT_HISTORY),
      where("elementId", "==", elementId),
      orderBy("rev", "desc"),
    );
    const snap = await getDocs(q);
    const histories = snap.docs.map(d => d.data() as ElementHistory);
    return computeNextRev(histories);
  }
}
