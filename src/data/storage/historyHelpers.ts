import type { DataFieldHistory, ComponentType, DataFieldValue } from '../models';
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
  componentType: ComponentType;
  action: 'create' | 'update' | 'delete';
  prevValue: DataFieldValue | null;
  newValue: DataFieldValue | null;
  rev: number;
}): DataFieldHistory {
  const { dataFieldId, parentNodeId, componentType, action, prevValue, newValue, rev } = params;
  // Phase 1 only has text-kv; when new variants land, branch on componentType.
  return {
    id: `${dataFieldId}:${rev}`,
    dataFieldId,
    parentNodeId,
    componentType,
    action,
    property: 'value',
    prevValue,
    newValue,
    updatedBy: getCurrentUserId(),
    updatedAt: now(),
    rev,
  };
}
