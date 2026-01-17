/*
 * Service Worker for Complete Maintenance Management
 *
 * Caching Strategy:
 * - App Shell (JS chunks, CSS, icons): Precached on install, cache-first
 * - HTML: Network-first (fresh when online, fallback to cache offline)
 * - Data: IndexedDB (handled by application code, not SW)
 *
 * The PRECACHE_MANIFEST constant is injected at build time by vite-plugin-precache.
 */

// Service Worker type assertion - needed because tsconfig includes both DOM and WebWorker
const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

// This will be injected by vite-plugin-precache at build time
declare const PRECACHE_MANIFEST: string[] | undefined;

const CACHE_VERSION = 'v2';
const CACHE_NAME = `cmm-app-shell-${CACHE_VERSION}`;

/**
 * Install Event: Eagerly precache all app shell assets
 */
sw.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Check if PRECACHE_MANIFEST exists (injected at build time)
      if (typeof PRECACHE_MANIFEST !== 'undefined' && Array.isArray(PRECACHE_MANIFEST)) {
        console.log(`[SW] Precaching ${PRECACHE_MANIFEST.length} assets...`);

        // Precache all assets from the manifest
        // Use addAll for atomic caching - if one fails, none are cached
        try {
          await cache.addAll(PRECACHE_MANIFEST);
          console.log('[SW] All assets precached successfully');
        } catch (error) {
          console.error('[SW] Precaching failed:', error);
          // Try to cache assets individually to identify problematic ones
          for (const url of PRECACHE_MANIFEST) {
            try {
              await cache.add(url);
            } catch (e) {
              console.warn(`[SW] Failed to cache: ${url}`, e);
            }
          }
        }
      } else {
        console.warn('[SW] PRECACHE_MANIFEST not found - running without precaching');
        // Fallback: cache critical assets manually
        const criticalAssets = [
          '/',
          '/manifest.json',
          '/icon-192.png',
          '/icon-512.png',
        ];
        try {
          await cache.addAll(criticalAssets);
        } catch (e) {
          console.warn('[SW] Failed to cache critical assets:', e);
        }
      }

      // Skip waiting to activate immediately
      await sw.skipWaiting();
    })()
  );
});

/**
 * Activate Event: Clean up old caches, take control
 */
sw.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );

      // Take control of all pages immediately
      await sw.clients.claim();
      console.log('[SW] Service worker activated and controlling pages');
    })()
  );
});

/**
 * Fetch Event: Handle requests with appropriate strategy
 *
 * - Static assets (JS, CSS, images): Cache-first
 * - HTML navigation: Network-first with cache fallback
 * - API/external: Network only
 */
sw.addEventListener('fetch', (event) => {
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

  // Skip cross-origin requests (Firebase, external APIs, etc.)
  if (url.origin !== sw.location.origin) {
    return;
  }

  // Determine request type and apply appropriate strategy
  const acceptHeader = request.headers.get('accept') || '';

  if (acceptHeader.includes('text/html') || request.mode === 'navigate') {
    // HTML/Navigation: Network-first with cache fallback
    event.respondWith(networkFirstWithCache(request));
  } else if (isStaticAsset(url.pathname)) {
    // Static assets: Cache-first
    event.respondWith(cacheFirstWithNetwork(request));
  } else {
    // Other requests: Network-first
    event.respondWith(networkFirstWithCache(request));
  }
});

/**
 * Check if a path is a static asset that should use cache-first
 */
function isStaticAsset(pathname: string): boolean {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.json'
  ];

  // Check file extension
  const ext = pathname.substring(pathname.lastIndexOf('.'));
  if (staticExtensions.includes(ext.toLowerCase())) {
    return true;
  }

  // Check if it's in the build directory (Qwik chunks)
  if (pathname.startsWith('/build/') || pathname.startsWith('/assets/')) {
    return true;
  }

  return false;
}

/**
 * Cache-first strategy: Try cache, fall back to network
 * Used for static assets that don't change (hashed filenames)
 */
async function cacheFirstWithNetwork(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log('[SW] Cache HIT:', request.url);
    return cachedResponse;
  }

  // Not in cache, fetch from network and cache for next time
  console.log('[SW] Cache MISS, fetching:', request.url);
  try {
    const networkResponse = await fetch(request);

    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached for future use:', request.url);
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', request.url, error);
    // Return a fallback response for failed asset loads
    return new Response('Asset unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network-first strategy: Try network, fall back to cache
 * Used for HTML to get fresh content when online
 */
async function networkFirstWithCache(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    console.log('[SW] Network SUCCESS:', request.url);

    // Cache the fresh response for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[SW] Network FAILED, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log('[SW] Cache HIT (fallback):', request.url);
      return cachedResponse;
    }

    // For navigation requests, try to return cached index.html
    if (request.mode === 'navigate') {
      const fallbackResponse = await caches.match('/index.html');
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    // No cache available
    return new Response('Offline - content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * Message handler for runtime commands
 */
sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }

  // Report cache status
  if (event.data?.type === 'GET_CACHE_STATUS') {
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      event.ports[0]?.postMessage({
        cacheName: CACHE_NAME,
        cachedUrls: keys.map(r => r.url),
        count: keys.length,
      });
    })();
  }
});
