/**
 * StorageEventBus - Internal pub/sub for data-layer events.
 *
 * Adapters emit events after successful writes; subscribers (e.g. the
 * in-memory node index) react without the adapter knowing about them.
 */

import type { Definition, Element } from './models';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type StorageEvent =
  | { type: 'DEFINITION_WRITTEN'; definition: Pick<Definition, 'id' | 'deletedAt'> }
  | { type: 'ELEMENT_WRITTEN'; element: Pick<Element, 'id' | 'kind' | 'parentId' | 'name' | 'value' | 'treeType' | 'deletedAt'> }
  | { type: 'ELEMENT_HARD_DELETED'; elementId: string };

// ---------------------------------------------------------------------------
// Bus implementation
// ---------------------------------------------------------------------------

type Subscriber = (event: StorageEvent) => void;

export class StorageEventBus {
  private subscribers: Subscriber[] = [];

  /** Subscribe to all events. Returns an unsubscribe function. */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  /** Emit an event to all current subscribers. */
  emit(event: StorageEvent): void {
    for (const fn of this.subscribers) {
      fn(event);
    }
  }

  /** Remove all subscribers (useful in tests). */
  clear(): void {
    this.subscribers = [];
  }
}

// Module-level singleton
export const storageEventBus = new StorageEventBus();
