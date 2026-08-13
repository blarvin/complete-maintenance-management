import type { Element, ElementHistory, ElementHistoryProperty } from '../models';
import type { StorageElementUpdate } from './storageAdapter';
import { getCurrentUserId } from '../../context/userContext';
import { generateId } from '../../utils/id';
import { now } from '../../utils/time';

/**
 * Diff an element update against its current state, returning one entry per
 * changed tracked property (`name | subtitle | value | parentId | siblingOrder`).
 * `subtitle` and `parentId` are normalized with `?? null` to match storage shape.
 * Shared by IDBAdapter and FirestoreAdapter so the audit log is identical
 * regardless of backend.
 */
export function diffElementChanges(
  existing: Element,
  updates: StorageElementUpdate,
): Array<{ property: ElementHistoryProperty; prev: unknown; next: unknown }> {
  const changed: Array<{ property: ElementHistoryProperty; prev: unknown; next: unknown }> = [];
  if ('name' in updates && updates.name !== existing.name) {
    changed.push({ property: 'name', prev: existing.name, next: updates.name });
  }
  if ('subtitle' in updates && (updates.subtitle ?? null) !== existing.subtitle) {
    changed.push({ property: 'subtitle', prev: existing.subtitle, next: updates.subtitle ?? null });
  }
  if ('value' in updates && updates.value !== existing.value) {
    changed.push({ property: 'value', prev: existing.value, next: updates.value });
  }
  if ('parentId' in updates && (updates.parentId ?? null) !== existing.parentId) {
    changed.push({ property: 'parentId', prev: existing.parentId, next: updates.parentId ?? null });
  }
  if ('siblingOrder' in updates && updates.siblingOrder !== existing.siblingOrder) {
    changed.push({ property: 'siblingOrder', prev: existing.siblingOrder, next: updates.siblingOrder });
  }
  return changed;
}

/**
 * Create an ElementHistory entry. Generic over property — supports
 * `value | name | subtitle | parentId | siblingOrder` per the unified model.
 *
 * **The id ends in a random token so the log converges** (ISSUES Tech Debt #4).
 * It used to be exactly `${elementId}:${rev}`, and `rev` is minted by reading
 * *local* history for its max — a read that cannot see another client. Two
 * clients editing the same element offline both minted rev 5, both produced
 * `el:5`, and the push (`setDoc`, no merge) plus the pull (`put`, keyed) turned
 * two distinct appends into one row. Silent loss of an audit entry.
 *
 * Uniqueness makes the log a grow-only set: appends are immutable, ids never
 * collide, so merging two clients is union and needs no coordination. That is
 * the whole of the convergence story — `put` becomes idempotent rather than
 * destructive, and a full sync can re-apply everything safely.
 *
 * `elementId` and `rev` stay in the key as a readable prefix (the random tail
 * alone would already be unique). Nothing parses the id — it is an opaque
 * primary key in Dexie and a document id in Firestore — so the shape is for
 * humans reading a row, and older two-part ids remain valid alongside new ones.
 */
export function createElementHistoryEntry(params: {
  elementId: string;
  rev: number;
  action: 'create' | 'update' | 'delete';
  property: ElementHistoryProperty;
  prevValue: unknown;
  newValue: unknown;
}): ElementHistory {
  const { elementId, rev, action, property, prevValue, newValue } = params;
  return {
    id: `${elementId}:${rev}:${generateId()}`,
    elementId,
    rev,
    action,
    property,
    prevValue,
    newValue,
    updatedBy: getCurrentUserId(),
    updatedAt: now(),
  };
}

/**
 * Total order for displaying an element's history. Defined once here because
 * two readers need it (`IDBAdapter.getElementHistory` and `DataFieldDetails`),
 * and they must agree — worse than a wrong order is two surfaces disagreeing.
 *
 * `rev` first: within one client it is a true sequence, which is the everyday
 * case and the order the author expects to see. It is *not* a total order
 * across clients — two offline clients can both mint rev 5 — so two more keys
 * follow. `updatedAt` next: server-stamped once pushed (`serverTimestamp()` in
 * FirestoreAdapter), so concurrent same-rev appends fall into the order the
 * server accepted them. Then `id`, which never ties, so every client sorts an
 * identical set identically. Deterministic beats notionally-true here: nothing
 * can recover the real authoring order of two offline edits, but all clients
 * agreeing is achievable and is what convergence actually needs.
 */
export function compareHistory(a: ElementHistory, b: ElementHistory): number {
  if (a.rev !== b.rev) return a.rev - b.rev;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
