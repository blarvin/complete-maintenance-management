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
  useVisibleTask$(async () => {
    // Initialize storage
    await initializeStorage();

    // Log service worker registration status
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log('[App] ServiceWorker registered:', registration.scope);
      } catch (err) {
        console.error('[App] ServiceWorker registration check failed:', err);
      }
    } else {
      console.warn('[App] ServiceWorker not supported in this browser');
    }

    // Log initial network state and set up listeners
    if (typeof navigator !== 'undefined') {
      console.log('[App] Initial network state:', navigator.onLine ? 'ONLINE' : 'OFFLINE');

      window.addEventListener('online', () => {
        console.log('[App] Network: ONLINE');
      });

      window.addEventListener('offline', () => {
        console.log('[App] Network: OFFLINE');
      });
    }
  }, { strategy: 'document-ready' });
}
