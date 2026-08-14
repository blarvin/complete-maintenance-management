/**
 * Which remote this session syncs against.
 *
 * Read by `firebase.ts` (whether to connect the emulator) and by
 * `storage/db.ts` (which Dexie database to open), so it lives in its own
 * module: `db.ts` must not import `firebase.ts`, whose module body initializes
 * the Firebase app as an import-time side effect.
 *
 * Resolved once, at module load. The target cannot change without a reload —
 * Dexie fixes its database name at construction, and the emulator connection is
 * made once against the Firestore instance.
 */

export type SyncTarget = 'production' | 'emulator';

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

function resolveSyncTarget(): SyncTarget {
    // Node / Vitest never talks to a remote; production keeps the unsuffixed
    // database name, so the test suite is unaffected by target scoping.
    if (!isBrowser) return 'production';
    try {
        // localStorage — set by Cypress before page load, and the only way into
        // emulator mode in an installed PWA, whose `start_url` carries no query
        // string (IMPLEMENTATION.md → *One database per sync target*).
        if (localStorage.getItem('USE_FIRESTORE_EMULATOR') === 'true') return 'emulator';
        // URL param — the manual-testing hatch on the dev server.
        if (new URLSearchParams(window.location.search).get('emulator') === 'true') return 'emulator';
    } catch {
        // SSR or blocked storage — treat as production.
    }
    return 'production';
}

export const syncTarget: SyncTarget = resolveSyncTarget();

export const isEmulatorTarget = syncTarget === 'emulator';
