/**
 * Wires the in-memory node index to the StorageEventBus.
 *
 * After calling `subscribeNodeIndex()`, every ELEMENT_WRITTEN (re-root kind)
 * event keeps the index current — no caller needs to touch the index directly.
 * Inline elements (DataFields) are ignored: the index only tracks the navigable
 * node tree for breadcrumb/ancestry computation.
 *
 * Removal is soft-delete only: a non-null `deletedAt` on the written element is
 * what drops a node out of the index. No row is ever hard-deleted.
 */

import type { StorageEvent } from './storageEventBus';
import { storageEventBus } from './storageEventBus';
import { upsertNodeSummary, removeNodeSummary } from './nodeIndex';
import { isReRoot } from '../kinds/placement';
import { isLibraryChrome } from './libraryChrome';

/** Process a single storage event and update the node index. */
export function handleStorageEvent(event: StorageEvent): void {
  switch (event.type) {
    case 'ELEMENT_WRITTEN':
      if (!isReRoot(event.element.kind)) break; // only re-root (navigable) nodes are indexed
      // Business tree + Library chrome: a re-root policy Definition (logbook) is
      // a library row of a re-root kind — e.g. arriving via sync pull — not a
      // tree node; the chrome rows ARE navigable (breadcrumbs inside the Library).
      if (event.element.treeType !== 'business' && !isLibraryChrome(event.element.kind)) break;
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
    default:
      break;
  }
}

/** Subscribe the node index handler to the singleton event bus. Returns unsubscribe. */
export function subscribeNodeIndex(): () => void {
  return storageEventBus.subscribe(handleStorageEvent);
}
