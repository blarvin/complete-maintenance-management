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

/**
 * Where a write came from. `local` = this client's own create/update/delete;
 * `remote` = a row applied by a sync pull (`applyRemoteElement`, or the hard
 * delete `FullCollectionSync` does when the server no longer has a row).
 *
 * Read by the **sync subscriber only**. UI subscribers deliberately want both: a
 * pulled row must repaint exactly like a local edit, which is why a remote apply
 * emits at all. But a remote apply is not a local change to push, and treating it
 * as one made every non-empty pull schedule another delta sync — an echo costing
 * a spare round-trip and, worse, a second unearned advance of the delta cursor
 * (which is local `now()` against server-stamped rows — see ISSUES Bugs).
 *
 * Required, not optional: absence would default to `local` silently, and a new
 * remote-apply path that forgot the tag would quietly restore the echo. This way
 * the compiler names every emit site.
 */
export type EventOrigin = 'local' | 'remote';

export type StorageEvent =
  | { type: 'DEFINITION_WRITTEN'; origin: EventOrigin; definition: Pick<Definition, 'id' | 'deletedAt'> }
  | { type: 'ELEMENT_WRITTEN'; origin: EventOrigin; element: Pick<Element, 'id' | 'kind' | 'parentId' | 'name' | 'value' | 'treeType' | 'deletedAt'> }
  | { type: 'ELEMENT_HARD_DELETED'; origin: EventOrigin; elementId: string };

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
