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
  const base = {
    id: `${dataFieldId}:${rev}`,
    dataFieldId,
    parentNodeId,
    action,
    property: 'value' as const,
    updatedBy: getCurrentUserId(),
    updatedAt: now(),
    rev,
  };
  // TS discriminated-union narrowing: per-branch literal componentType.
  switch (componentType) {
    case 'text-kv':
      return { ...base, componentType: 'text-kv', prevValue: prevValue as string | null, newValue: newValue as string | null };
    case 'enum-kv':
      return { ...base, componentType: 'enum-kv', prevValue: prevValue as string | null, newValue: newValue as string | null };
    case 'measurement-kv':
      return { ...base, componentType: 'measurement-kv', prevValue: prevValue as number | null, newValue: newValue as number | null };
    case 'single-image':
      return {
        ...base,
        componentType: 'single-image',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prevValue: prevValue as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: newValue as any,
      };
  }
}
