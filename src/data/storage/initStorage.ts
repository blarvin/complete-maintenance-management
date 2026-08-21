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
import { devLog } from '../../utils/devMode';
import { initializeNodeIndex } from '../nodeIndex';
import { subscribeNodeIndex } from '../nodeIndexSubscriber';
import { isReRoot } from '../../kinds/placement';
import { isLibraryChrome } from '../libraryChrome';
import { subscribeSyncTrigger } from '../syncSubscriber';
import { initializeCommandBus } from '../commands';
import { initializeQueries } from '../queries';
import { runBootstrap } from '../services/bootstrap';
import { backfillProvisionedLenses, restampUnboundLenses } from '../services/provisionLenses';

/**
 * Memoized init state. All callers share the same promise so concurrent
 * `await initializeStorage()` calls (e.g. one from App's onMount and one from
 * useElementChildren) never re-enter the init body and do duplicate work.
 *
 * Pinned on globalThis so it survives dev-server (Vite) module re-evaluation:
 * a re-instanced copy of this module would otherwise see `initPromise: null`
 * and re-run the full init — new SyncManager, duplicate bus subscriptions,
 * another startup syncFull — per edit-triggered reload.
 * Client-only state — the app is a client-only SPA with no server render.
 */
type InitState = { initialized: boolean; degraded: boolean; initPromise: Promise<void> | null };
const globalState = globalThis as typeof globalThis & { __cmmInitState?: InitState };
const state: InitState =
  globalState.__cmmInitState ??
  (globalState.__cmmInitState = { initialized: false, degraded: false, initPromise: null });

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
    devLog('[Storage] Already initialized');
    return;
  }

  devLog('[Storage] Initializing...');

  try {
    // Ensure database is open
    await db.open();

    // Check if we need to migrate from Firestore
    const elementCount = await db.elements.count();

    if (elementCount === 0) {
      devLog('[Storage] IDB is empty, checking for Firestore data...');

      // Only migrate if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await migrateFromFirestore();
      } else {
        devLog('[Storage] Offline, skipping migration');
      }
    } else {
      devLog('[Storage] IDB has', elementCount, 'elements, using existing data');
    }

    // Write the app-owned populations — Library chrome + the active pack's
    // Definitions (idempotent; no sync enqueue). Must run BEFORE the node-index
    // seed: the runner writes `db.elements` directly with no bus emit, so a
    // fresh DB would otherwise miss the chrome rows in the index.
    await runBootstrap();

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

    // Reconcile lens containers onto nodes that predate a lens kind. Provisioning
    // is otherwise create-time only, so every node minted before `logbook` landed
    // has a Jobs box and no Logbook — and the next lens kind repeats that. Runs
    // after the migration/seed so it sees the full local set; idempotent, so a
    // steady-state startup writes nothing.
    const storedElements = await idbAdapter.getAllElements();
    const backfilled = await backfillProvisionedLenses(storedElements, idbAdapter);
    if (backfilled > 0) devLog('[Storage] Backfilled', backfilled, 'lens containers');

    // The other half of the same degradation: a lens *created* while its policy
    // Definition was unresolvable minted with `definitionId: null` and nothing
    // ever looked again. Reads the same pre-backfill snapshot — lenses the
    // backfill just minted stamped themselves if resolvable.
    const restamped = await restampUnboundLenses(storedElements);
    if (restamped > 0) devLog('[Storage] Re-stamped', restamped, 'lens policies');

    // Start the sync manager
    const syncManager = initializeSyncManager(idbAdapter, firestoreAdapter, syncQueue);

    // Dev-only console helpers; no-ops unless DEV_TOOLS_ENABLED (utils/devMode).
    initializeDevTools();

    // Trigger immediate full sync on startup if online. Purely a catch-up pull
    // now — the full sync no longer purges local rows (IMPLEMENTATION.md →
    // *Retention over reconciliation*), so the
    // requeueFailed() above is an ordinary fresh-retry-budget call rather than
    // the load-bearing ordering it used to be.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      devLog('[Storage] Triggering initial full sync on startup...');
      syncManager.syncFull().catch(err => {
        console.error('[Storage] Initial sync failed:', err);
        // Don't throw - app should still work even if initial sync fails
      });
    }

    state.initialized = true;
    devLog('[Storage] Initialization complete');
    // No completion notification needed: data hooks await initializeStorage()
    // before their first query (and this promise resolves on failure too).
  } catch (err) {
    console.error('[Storage] Initialization failed:', err);
    // Don't throw — the app should still render rather than showing nothing.
    // `initialized` stays true so the data hooks stop waiting, but `degraded`
    // is what says the boot got no further than the throw: no Library, no
    // command bus, every write failing. `getBootState()` is how the UI can tell
    // the two apart; one boolean covering both is what made a failed init
    // report success (IMPLEMENTATION.md → *Per-population bootstrap*).
    state.initialized = true;
    state.degraded = true;
  }
}

/**
 * Migrate all data from Firestore to IDB.
 * This is a one-time operation on first load.
 * Uses FirestoreAdapter for clean abstraction (DIP compliance).
 */
async function migrateFromFirestore(): Promise<void> {
  devLog('[Migration] Starting migration from Firestore...');

  try {
    const firestoreAdapter = new FirestoreAdapter();

    // Fetch all data via adapter methods. Library Definitions are `library`-tree
    // Elements, so they come down with the elements pull — no separate fetch.
    const elements = await firestoreAdapter.pullAllElements();
    devLog('[Migration] Found', elements.length, 'elements');

    const elementHistory = await firestoreAdapter.pullAllElementHistory();
    devLog('[Migration] Found', elementHistory.length, 'element history entries');

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

    devLog('[Migration] Migration complete');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    // Don't throw - app should still work with empty IDB
  }
}

async function seedNodeIndexFromDb(): Promise<void> {
  const elements = await db.elements.toArray();
  const activeNodes = elements
    // Business tree + Library chrome: a re-root policy Definition (logbook) is a
    // library row of a re-root kind and must not enter the node index, but the
    // chrome rows are navigable (breadcrumbs/links inside the Library).
    .filter(el => isReRoot(el.kind) && el.deletedAt === null && (el.treeType === 'business' || isLibraryChrome(el.kind)))
    .map(el => ({ id: el.id, parentId: el.parentId, name: el.name }));
  initializeNodeIndex(activeNodes);
}

/**
 * Check if storage is initialized.
 */
export function isStorageInitialized(): boolean {
  return state.initialized;
}

/** How the boot actually went. `degraded` = init threw; see the catch above. */
export type BootState = 'pending' | 'ok' | 'degraded';

/**
 * The boot outcome the UI can read. `pending` until `initializeStorage()`
 * settles, then `ok` or `degraded` — a degraded app renders, but has no Library
 * and no command bus, so it is worth telling the user about.
 */
export function getBootState(): BootState {
  if (state.degraded) return 'degraded';
  return state.initialized ? 'ok' : 'pending';
}

/**
 * Clear all IDB data (for testing or reset).
 */
export async function clearStorage(): Promise<void> {
  await db.delete();
  state.initialized = false;
  state.degraded = false;
  state.initPromise = null;
  devLog('[Storage] Cleared all data');
}
