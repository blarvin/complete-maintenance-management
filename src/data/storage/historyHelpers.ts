import type { ElementHistory, ElementHistoryProperty } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';

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
