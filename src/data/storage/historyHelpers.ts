import type { DataFieldHistory } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';

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
