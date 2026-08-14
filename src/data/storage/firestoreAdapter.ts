/**
 * FirestoreAdapter - Firestore implementation of RemoteSyncAdapter.
 *
 * Firestore is a sync mirror for the IDB write model, not a swappable CRUD
 * backend: IDBAdapter owns all domain writes (history diffing, rev minting,
 * sibling ordering); this adapter only pushes queued sync items and pulls
 * remote changes.
 */

import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { Element, ElementHistory } from "../models";
import type { RemoteSyncAdapter } from "./storageAdapter";
import type { SyncQueueItem } from "./db";
import { COLLECTIONS } from "../../constants";
import { coerceTimestamps } from "./coerceTimestamps";

export class FirestoreAdapter implements RemoteSyncAdapter {
  // ============================================================================
  // Remote Sync Operations (RemoteSyncAdapter)
  // ============================================================================

  /**
   * Apply a sync queue item to Firestore.
   * Handles create/update/delete operations for elements (incl. `library`-tree
   * Definitions, which ride the element lane — config-as-Elements).
   * Uses serverTimestamp() for authoritative timestamps (no clock skew).
   * Uses soft delete for delete operations (enables delta sync detection).
   */
  async applySyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.operation) {
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
   * Pull elements updated since the given timestamp (delta sync).
   * Soft deletes surface as rows with deletedAt set and a bumped updatedAt.
   *
   * `since` is epoch ms but MUST be compared as a Timestamp: writes stamp
   * `updatedAt` with serverTimestamp(), and Firestore's inequality filters are
   * type-scoped — a raw number operand against a Timestamp field matches zero
   * documents, so delta sync silently pulls nothing. Same applies to
   * pullElementHistorySince below.
   */
  async pullElementsSince(since: number): Promise<Element[]> {
    const q = query(
      collection(db, COLLECTIONS.ELEMENTS),
      where('updatedAt', '>', Timestamp.fromMillis(since))
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
      where('updatedAt', '>', Timestamp.fromMillis(since))
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => coerceTimestamps<ElementHistory>(d.data()));
  }
}
