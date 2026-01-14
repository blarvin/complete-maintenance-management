/*
 * Service Worker for Complete Maintenance Management
 *
 * Caching Strategy:
 * - App Shell (JS chunks, CSS): Cache-first (precached on install)
 * - HTML: Network-first (fresh SSR when online, fallback to cache)
 * - Data: IndexedDB (handled by application code, not SW)
 */

import type { RequestHandler } from '@builder.io/qwik-city';
import { setupServiceWorker } from '@builder.io/qwik-city/service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'cmm-app-shell-v1';
const DATA_CACHE = 'cmm-data-v1';

/**
 * Qwik City's setupServiceWorker provides:
 * - Automatic precaching of build artifacts
 * - Smart cache invalidation on new deploys
 * - Prefetching of route chunks
 */
setupServiceWorker();

/**
 * Install Event: Precache critical assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  // Skip waiting to activate immediately (good for development)
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] App shell cache opened');
      // Qwik City's setupServiceWorker handles most caching,
      // but you can add critical assets here if needed:
      // return cache.addAll(['/favicon.svg', '/manifest.json']);
    })
  );
});

/**
 * Activate Event: Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all pages immediately
  return self.clients.claim();
});

/**
 * Fetch Event: Handle requests with appropriate strategy
 *
 * Note: Qwik City's setupServiceWorker handles most fetch logic.
 * This handler only runs for requests not handled by Qwik's SW.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // HTML requests: Network-first (fresh SSR when online)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(request).then((response) => {
            return response || new Response('Offline - no cached version available');
          });
        })
    );
    return;
  }

  // All other requests handled by Qwik City's setupServiceWorker
});

/**
 * Message handler for runtime commands
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Export for Qwik City (required even though it's a service worker)
export const onGet: RequestHandler = () => {
  // This route handler is not used - the service worker runs in its own context
};
