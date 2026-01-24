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
  deleteDoc,
  writeBatch,
  getCountFromServer,
  FirestoreError,
  serverTimestamp,
} from "firebase/firestore";
import type { TreeNode, DataField, DataFieldHistory } from "../models";
import { filterActive, filterDeleted } from "../models";
import type { StorageAdapter, RemoteSyncAdapter, StorageResult, StorageNodeCreate, StorageNodeUpdate, StorageFieldCreate, StorageFieldUpdate } from "./storageAdapter";
import type { SyncQueueItem } from "./db";
import { COLLECTIONS } from "../../constants";
import { getCurrentUserId } from "../../context/userContext";
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

/**
 * Creates a StorageResult with Firestore metadata.
 */
function createResult<T>(data: T): StorageResult<T> {
  return {
    data,
    meta: {
      adapter: "firestore",
    },
  };
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
      const nodes = snap.docs.map((d) => d.data() as TreeNode);
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
      const node = snap.exists() ? (snap.data() as TreeNode) : null;
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
      const nodes = snap.docs.map((d) => d.data() as TreeNode);
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
      const fields = snap.docs.map((d) => d.data() as DataField);
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
      const ts = now();
      const userId = getCurrentUserId();
      
      // Use provided cardOrder, or compute next available
      const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;
      
      const field: DataField = {
        ...input,
        cardOrder: order,
        updatedBy: userId,
        updatedAt: ts,
        deletedAt: null, // Initialize as active (not soft-deleted)
      };
      
      await setDoc(doc(collection(db, COLLECTIONS.FIELDS), field.id), field);

      // Create history entry
      const rev = await this.nextRev(field.id);
      const hist: DataFieldHistory = {
        id: `${field.id}:${rev}`,
        dataFieldId: field.id,
        parentNodeId: field.parentNodeId,
        action: "create",
        property: "fieldValue",
        prevValue: null,
        newValue: field.fieldValue,
        updatedBy: userId,
        updatedAt: ts,
        rev,
      };
      await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);
      
      return createResult(field);
    } catch (err) {
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
      
      const prev = snap.data() as DataField;
      const ts = now();
      const userId = getCurrentUserId();
      
      await updateDoc(ref, {
        fieldValue: input.fieldValue,
        updatedAt: ts,
        updatedBy: userId,
      });

      // Create history entry
      const rev = await this.nextRev(id);
      const hist: DataFieldHistory = {
        id: `${id}:${rev}`,
        dataFieldId: id,
        parentNodeId: prev.parentNodeId,
        action: "update",
        property: "fieldValue",
        prevValue: prev.fieldValue,
        newValue: input.fieldValue,
        updatedBy: userId,
        updatedAt: ts,
        rev,
      };
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
      
      const prev = snap.data() as DataField;
      const ts = now();
      const userId = getCurrentUserId();

      // Soft delete: set deletedAt timestamp instead of hard delete
      await updateDoc(ref, {
        deletedAt: ts,
        updatedAt: ts,
        updatedBy: userId,
      });

      // Create history entry for the delete action
      const rev = await this.nextRev(id);
      const hist: DataFieldHistory = {
        id: `${id}:${rev}`,
        dataFieldId: id,
        parentNodeId: prev.parentNodeId,
        action: "delete",
        property: "fieldValue",
        prevValue: prev.fieldValue,
        newValue: null,
        updatedBy: userId,
        updatedAt: ts,
        rev,
      };
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
      const history = snap.docs.map((d) => d.data() as DataFieldHistory);
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
      const nodes = snap.docs.map((d) => d.data() as TreeNode);
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
      const allChildren = snap.docs.map((d) => d.data() as TreeNode);
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
      const allFields = snap.docs.map((d) => d.data() as DataField);
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
      default:
        console.warn('[FirestoreAdapter] Unknown sync operation:', item.operation);
    }
  }

  /**
   * Pull entities updated since the given timestamp from Firestore.
   * Returns an array of TreeNode or DataField entities.
   */
  async pullEntitiesSince(type: 'node' | 'field', since: number): Promise<Array<TreeNode | DataField>> {
    const collectionName = type === 'node' ? COLLECTIONS.NODES : COLLECTIONS.FIELDS;
    const q = query(
      collection(db, collectionName),
      where('updatedAt', '>', since)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return [];
    }

    return snap.docs.map((docSnap) => docSnap.data() as TreeNode | DataField);
  }

  /**
   * Pull all nodes from Firestore (full collection).
   * Used for full collection sync to detect deletions.
   */
  async pullAllNodes(): Promise<TreeNode[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.NODES));
    return snap.docs.map(d => d.data() as TreeNode);
  }

  /**
   * Pull all fields from Firestore (full collection).
   * Used for full collection sync to detect deletions.
   */
  async pullAllFields(): Promise<DataField[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.FIELDS));
    return snap.docs.map(d => d.data() as DataField);
  }

  /**
   * Pull all history from Firestore (full collection).
   * Used for history sync across devices.
   */
  async pullAllHistory(): Promise<DataFieldHistory[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.HISTORY));
    return snap.docs.map(d => d.data() as DataFieldHistory);
  }

  /**
   * Pull history updated since the given timestamp from Firestore.
   * Used for delta sync to fetch only new/changed history entries.
   */
  async pullHistorySince(since: number): Promise<DataFieldHistory[]> {
    const q = query(
      collection(db, COLLECTIONS.HISTORY),
      where('updatedAt', '>', since)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DataFieldHistory);
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
    const rev = snap.docs.length ? (snap.docs[0].data() as DataFieldHistory).rev + 1 : 0;
    return rev;
  }

  /**
   * Recompute cardOrder values to close gaps after deletion.
   * Assigns sequential cardOrder (0, 1, 2, ...) based on current order.
   */
  private async recomputeCardOrder(parentNodeId: string): Promise<void> {
    const fieldsResult = await this.listFields(parentNodeId);
    const fields = fieldsResult.data;
    if (fields.length === 0) return;

    const batch = writeBatch(db);
    const ts = now();
    const userId = getCurrentUserId();

    fields.forEach((field, index) => {
      if (field.cardOrder !== index) {
        const ref = doc(db, COLLECTIONS.FIELDS, field.id);
        batch.update(ref, { cardOrder: index, updatedAt: ts, updatedBy: userId });
      }
    });

    await batch.commit();
  }
}
