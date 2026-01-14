/**
 * useInitStorage - Qwik hook for storage initialization
 *
 * This hook initializes IndexedDB storage and the SyncManager
 * on the client side after hydration.
 *
 * Usage: Call useInitStorage() in root.tsx or a layout component.
 */

import { useVisibleTask$ } from '@builder.io/qwik';
import { initializeStorage } from '../data/storage/initStorage';

/**
 * Initialize storage on client-side.
 * This hook should be called once in the root component.
 */
export function useInitStorage() {
  // Client-side initialization is intentional here
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  useVisibleTask$(async () => {
    await initializeStorage();
  }, { strategy: 'document-ready' });
}
