/**
 * Storage Events - Custom events for storage changes
 * 
 * Allows UI components to react to storage changes triggered by sync or other operations.
 */

import { now } from '../../utils/time';

/**
 * Dispatch a storage change event to trigger UI updates.
 * Components can listen for this event and reload their data.
 */
export function dispatchStorageChangeEvent(): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('storage-change', {
    detail: { timestamp: now() }
  });
  window.dispatchEvent(event);
  console.log('[StorageEvents] Dispatched storage-change event');
}
