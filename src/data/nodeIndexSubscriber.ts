/**
 * Wires the in-memory node index to the StorageEventBus.
 *
 * After calling `subscribeNodeIndex()`, every ELEMENT_WRITTEN (re-root kind) /
 * ELEMENT_HARD_DELETED event keeps the index current — no caller needs to touch
 * the index directly. Inline elements (DataFields) are ignored: the index
 * only tracks the navigable node tree for breadcrumb/ancestry computation.
 */

import type { StorageEvent } from './storageEventBus';
import { storageEventBus } from './storageEventBus';
import { upsertNodeSummary, removeNodeSummary } from './nodeIndex';
import { isReRoot } from '../kinds/placement';

/** Process a single storage event and update the node index. */
export function handleStorageEvent(event: StorageEvent): void {
  switch (event.type) {
    case 'ELEMENT_WRITTEN':
      if (!isReRoot(event.element.kind)) break; // only re-root (navigable) nodes are indexed
      if (event.element.deletedAt === null) {
        upsertNodeSummary({
          id: event.element.id,
          parentId: event.element.parentId,
          name: event.element.name,
        });
      } else {
        removeNodeSummary(event.element.id);
      }
      break;
    case 'ELEMENT_HARD_DELETED':
      removeNodeSummary(event.elementId);
      break;
    default:
      break;
  }
}

/** Subscribe the node index handler to the singleton event bus. Returns unsubscribe. */
export function subscribeNodeIndex(): () => void {
  return storageEventBus.subscribe(handleStorageEvent);
}
