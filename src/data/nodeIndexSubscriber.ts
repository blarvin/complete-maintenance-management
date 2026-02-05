/**
 * Wires the in-memory node index to the StorageEventBus.
 *
 * After calling `subscribeNodeIndex()`, every NODE_WRITTEN / NODE_HARD_DELETED
 * event keeps the index current — no caller needs to touch the index directly.
 */

import type { StorageEvent } from './storageEventBus';
import { storageEventBus } from './storageEventBus';
import { upsertNodeSummary, removeNodeSummary } from './nodeIndex';

/** Process a single storage event and update the node index. */
export function handleStorageEvent(event: StorageEvent): void {
  switch (event.type) {
    case 'NODE_WRITTEN':
      if (event.node.deletedAt === null) {
        upsertNodeSummary({
          id: event.node.id,
          parentId: event.node.parentId,
          nodeName: event.node.nodeName,
        });
      } else {
        removeNodeSummary(event.node.id);
      }
      break;
    case 'NODE_HARD_DELETED':
      removeNodeSummary(event.nodeId);
      break;
  }
}

/** Subscribe the node index handler to the singleton event bus. Returns unsubscribe. */
export function subscribeNodeIndex(): () => void {
  return storageEventBus.subscribe(handleStorageEvent);
}
