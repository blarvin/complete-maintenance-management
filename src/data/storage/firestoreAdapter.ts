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
} from "firebase/firestore";
import type { TreeNode, DataField, DataFieldHistory } from "../models";
import type { StorageAdapter, StorageResult, StorageNodeCreate, StorageNodeUpdate, StorageFieldCreate, StorageFieldUpdate } from "./storageAdapter";
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

export class FirestoreAdapter implements StorageAdapter {
  // ============================================================================
  // Node Operations
  // ============================================================================

  async listRootNodes(): Promise<StorageResult<TreeNode[]>> {
    try {
      const q = query(
        collection(db, COLLECTIONS.NODES),
        where("parentId", "==", null),
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

  async deleteNode(id: string, _opts?: { cascade?: boolean }): Promise<StorageResult<void>> {
    try {
      // Phase 1: enforce leaf-only by checking child count.
      const childCount = await getCountFromServer(
        query(collection(db, COLLECTIONS.NODES), where("parentId", "==", id))
      );
      if (childCount.data().count > 0) {
        throw makeStorageError("validation", "Only leaf nodes can be deleted in Phase 1", {
          retryable: false,
        });
      }
      await deleteDoc(doc(db, COLLECTIONS.NODES, id));
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
      await deleteDoc(ref);

      // Create history entry
      const ts = now();
      const rev = await this.nextRev(id);
      const hist: DataFieldHistory = {
        id: `${id}:${rev}`,
        dataFieldId: id,
        parentNodeId: prev.parentNodeId,
        action: "delete",
        property: "fieldValue",
        prevValue: prev.fieldValue,
        newValue: null,
        updatedBy: getCurrentUserId(),
        updatedAt: ts,
        rev,
      };
      await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);

      // Recompute cardOrder to close gaps
      await this.recomputeCardOrder(prev.parentNodeId);
      
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
