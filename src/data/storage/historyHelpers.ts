import type { Element, ElementHistory, ElementHistoryProperty } from '../models';
import type { StorageElementUpdate } from './storageAdapter';
import { getCurrentUserId } from '../../context/userContext';
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
 * Compute next revision number from existing history entries.
 * Returns max(rev) + 1, or 0 if no history exists.
 */
export function computeNextRev(histories: { rev: number }[]): number {
  if (histories.length === 0) return 0;
  return Math.max(...histories.map(h => h.rev)) + 1;
}

/**
 * Create an ElementHistory entry. Generic over property — supports
 * `value | name | subtitle | parentId | siblingOrder` per the unified model.
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
    id: `${elementId}:${rev}`,
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
