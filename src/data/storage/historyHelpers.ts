import type { DataFieldHistory } from '../models';
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

export function createHistoryEntry(params: {
  dataFieldId: string;
  parentNodeId: string;
  action: 'create' | 'update' | 'delete';
  prevValue: string | null;
  newValue: string | null;
  rev: number;
}): DataFieldHistory {
  const { dataFieldId, parentNodeId, action, prevValue, newValue, rev } = params;
  return {
    id: `${dataFieldId}:${rev}`,
    dataFieldId,
    parentNodeId,
    action,
    property: 'fieldValue',
    prevValue,
    newValue,
    updatedBy: getCurrentUserId(),
    updatedAt: now(),
    rev,
  };
}
