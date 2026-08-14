/**
 * Wires sync triggering to the StorageEventBus.
 *
 * After calling `subscribeSyncTrigger()`, every local CUD event automatically
 * schedules a debounced sync — no caller needs to call triggerSync() manually.
 *
 * **Local only.** A sync pull emits the same events a local edit does (the UI has
 * to repaint either way), so subscribing to all of them made a pull trigger another
 * pull: every delta sync that applied N rows scheduled one more 500 ms later, which
 * pulled nothing and stopped. Self-limiting, but it spent a round-trip and advanced
 * the delta cursor a second time without pulling anything — and since that cursor is
 * local `now()` measured against server-stamped rows, the extra advance widens the
 * window in which a server write can be skipped. Observed in the 2026-08-12
 * `syncDelta()` hand-test as two cycles logged for one call.
 */

import { storageEventBus, type StorageEvent } from './storageEventBus';
import { triggerSync } from '../hooks/useSyncTrigger';

/**
 * The subscriber body. Exported so the test drives *this* rather than a copy of it
 * (the same shape as `nodeIndexSubscriber.handleStorageEvent`) — it previously
 * re-implemented the one-liner inline, which would have passed no matter what the
 * real subscriber did.
 *
 * Origin decides, not event type: a hard delete is remote today, but a local purge
 * would still be a local change worth pushing.
 */
export function handleStorageEvent(event: StorageEvent): void {
  if (event.origin === 'remote') return;
  triggerSync();
}

/** Subscribe sync trigger to the singleton event bus. Returns unsubscribe. */
export function subscribeSyncTrigger(): () => void {
  return storageEventBus.subscribe(handleStorageEvent);
}
