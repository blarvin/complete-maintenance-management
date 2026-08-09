/**
 * Storage Initialization
 *
 * Handles first-time setup and migration from Firestore to IDB.
 * This module should only run on the client side.
 *
 * On first load:
 * 1. Check if IDB is empty
 * 2. If empty and online, migrate data from Firestore
 * 3. Start the SyncManager for ongoing sync
 */

import { db } from './db';
import { IDBAdapter } from './IDBAdapter';
import { FirestoreAdapter } from './firestoreAdapter';
import { initializeSyncManager } from '../sync/syncManager';
import { IDBSyncQueueManager } from '../sync/SyncQueueManager';
import { initializeDevTools } from '../sync/devTools';
import { now } from '../../utils/time';
import { initializeNodeIndex } from '../nodeIndex';
import { subscribeNodeIndex } from '../nodeIndexSubscriber';
import { isReRoot } from '../../kinds/placement';
import { subscribeSyncTrigger } from '../syncSubscriber';
import { initializeCommandBus } from '../commands';
import { initializeQueries } from '../queries';
import { seedDefinitions } from '../services/seedDefinitions';

/**
 * Memoized init state. All callers share the same promise so concurrent
 * `await initializeStorage()` calls (e.g. one from App's onMount and one from
 * useElementChildren) never re-enter the init body and do duplicate work.
 *
 * Pinned on globalThis so it survives dev-server (Vite) module re-evaluation:
 * a re-instanced copy of this module would otherwise see `initPromise: null`
 * and re-run the full init — new SyncManager, duplicate bus subscriptions,
 * another startup syncFull — per edit-triggered reload (ISSUES Bugs #2).
 * Client-only state — the app is a client-only SPA with no server render.
 */
type InitState = { initialized: boolean; initPromise: Promise<void> | null };
const globalState = globalThis as typeof globalThis & { __cmmInitState?: InitState };
const state: InitState =
  globalState.__cmmInitState ?? (globalState.__cmmInitState = { initialized: false, initPromise: null });

/**
 * Initialize storage and sync.
 * Idempotent: safe to call from multiple hooks; first call does the work,
 * subsequent calls return the same promise.
 */
export function initializeStorage(): Promise<void> {
  if (state.initPromise) return state.initPromise;
  state.initPromise = doInitializeStorage();
  return state.initPromise;
}

async function doInitializeStorage(): Promise<void> {
  if (state.initialized) {
    console.log('[Storage] Already initialized');
    return;
  }

  console.log('[Storage] Initializing...');

  try {
    // Ensure database is open
    await db.open();

    // Check if we need to migrate from Firestore
    const elementCount = await db.elements.count();

    if (elementCount === 0) {
      // Check for Cypress test mode - IDB was seeded by Cypress, skip migration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== 'undefined' && (window as any).__CYPRESS_SEED_MODE__) {
        console.log('[Storage] Cypress test mode - skipping Firestore migration');
      } else {
        console.log('[Storage] IDB is empty, checking for Firestore data...');

        // Only migrate if online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          await migrateFromFirestore();
        } else {
          console.log('[Storage] Offline, skipping migration');
        }
      }
    } else {
      console.log('[Storage] IDB has', elementCount, 'elements, using existing data');
    }

    await seedNodeIndexFromDb();
    subscribeNodeIndex();
    subscribeSyncTrigger();

    // Create adapters and sync queue for sync manager
    const syncQueue = new IDBSyncQueueManager();
    // Fresh launch = fresh retry budget: re-arm failed items so they ride the
    // startup syncFull() even if the exhaustion toast was missed last session.
    await syncQueue.requeueFailed();
    const idbAdapter = new IDBAdapter(syncQueue);
    const firestoreAdapter = new FirestoreAdapter();

    // Initialize CQRS command bus and query layer
    initializeCommandBus(idbAdapter);
    initializeQueries(idbAdapter);

    // Seed dev Definitions (idempotent; no sync enqueue).
    await seedDefinitions();

    // Start the sync manager
    const syncManager = initializeSyncManager(idbAdapter, firestoreAdapter, syncQueue);

    // Initialize dev tools (exposes window.__sync() and window.__syncStatus())
    initializeDevTools();

    // Trigger immediate full sync on startup if online (to detect remote deletions, get latest changes)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[Storage] Triggering initial full sync on startup...');
      syncManager.syncFull().catch(err => {
        console.error('[Storage] Initial sync failed:', err);
        // Don't throw - app should still work even if initial sync fails
      });
    }

    state.initialized = true;
    console.log('[Storage] Initialization complete');
    // No completion notification needed: data hooks await initializeStorage()
    // before their first query (and this promise resolves on failure too).
  } catch (err) {
    console.error('[Storage] Initialization failed:', err);
    // Don't throw - app should still work offline with empty IDB
    state.initialized = true;
  }
}

/**
 * Migrate all data from Firestore to IDB.
 * This is a one-time operation on first load.
 * Uses FirestoreAdapter for clean abstraction (DIP compliance).
 */
async function migrateFromFirestore(): Promise<void> {
  console.log('[Migration] Starting migration from Firestore...');

  try {
    const firestoreAdapter = new FirestoreAdapter();

    // Fetch all data via adapter methods. Library Definitions are `library`-tree
    // Elements, so they come down with the elements pull — no separate fetch.
    const elements = await firestoreAdapter.pullAllElements();
    console.log('[Migration] Found', elements.length, 'elements');

    const elementHistory = await firestoreAdapter.pullAllElementHistory();
    console.log('[Migration] Found', elementHistory.length, 'element history entries');

    // Bulk insert into IDB
    await db.transaction('rw', [db.elements, db.elementHistory, db.syncMetadata], async () => {
      if (elements.length > 0) {
        await db.elements.bulkPut(elements);
      }
      if (elementHistory.length > 0) {
        await db.elementHistory.bulkPut(elementHistory);
      }

      // Set last sync timestamp to now (we're in sync with Firestore)
      await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: now() });
    });

    console.log('[Migration] Migration complete');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    // Don't throw - app should still work with empty IDB
  }
}

async function seedNodeIndexFromDb(): Promise<void> {
  const elements = await db.elements.toArray();
  const activeNodes = elements
    // Business tree only: a re-root policy Definition (logbook) is a library
    // row of a re-root kind and must not enter the node index.
    .filter(el => isReRoot(el.kind) && el.deletedAt === null && el.treeType === 'business')
    .map(el => ({ id: el.id, parentId: el.parentId, name: el.name }));
  initializeNodeIndex(activeNodes);
}

/**
 * Check if storage is initialized.
 */
export function isStorageInitialized(): boolean {
  return state.initialized;
}

/**
 * Clear all IDB data (for testing or reset).
 */
export async function clearStorage(): Promise<void> {
  await db.delete();
  state.initialized = false;
  state.initPromise = null;
  console.log('[Storage] Cleared all data');
}
