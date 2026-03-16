/**
 * Wires sync triggering to the StorageEventBus.
 *
 * After calling `subscribeSyncTrigger()`, every local CUD event
 * automatically schedules a debounced sync — no caller needs to
 * call triggerSync() manually.
 */

import { storageEventBus } from './storageEventBus';
import { triggerSync } from '../hooks/useSyncTrigger';

/** Subscribe sync trigger to the singleton event bus. Returns unsubscribe. */
export function subscribeSyncTrigger(): () => void {
  return storageEventBus.subscribe(() => triggerSync());
}
