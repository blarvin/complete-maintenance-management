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
import { initializeDevTools } from '../sync/devTools';
import type { TreeNode, DataField, DataFieldHistory } from '../models';
import { COLLECTIONS } from '../../constants';
import { db as firestoreDb } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

let initialized = false;

/**
 * Initialize storage and sync.
 * Should be called once on client-side app startup.
 */
export async function initializeStorage(): Promise<void> {
  if (initialized) {
    console.log('[Storage] Already initialized');
    return;
  }

  console.log('[Storage] Initializing...');

  try {
    // Ensure database is open
    await db.open();

    // Check if we need to migrate from Firestore
    const nodeCount = await db.nodes.count();

    if (nodeCount === 0) {
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
      console.log('[Storage] IDB has', nodeCount, 'nodes, using existing data');
    }

    // Create adapters for sync manager
    const idbAdapter = new IDBAdapter();
    const firestoreAdapter = new FirestoreAdapter();

    // Start the sync manager
    const syncManager = initializeSyncManager(idbAdapter, firestoreAdapter);

    // Initialize dev tools (exposes window.__sync() and window.__syncStatus())
    initializeDevTools();

    // Trigger immediate sync on startup if online (to detect remote deletions, get latest changes)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[Storage] Triggering initial sync on startup...');
      syncManager.syncOnce().catch(err => {
        console.error('[Storage] Initial sync failed:', err);
        // Don't throw - app should still work even if initial sync fails
      });
    }

    initialized = true;
    console.log('[Storage] Initialization complete');
  } catch (err) {
    console.error('[Storage] Initialization failed:', err);
    // Don't throw - app should still work offline with empty IDB
    initialized = true;
  }
}

/**
 * Migrate all data from Firestore to IDB.
 * This is a one-time operation on first load.
 */
async function migrateFromFirestore(): Promise<void> {
  console.log('[Migration] Starting migration from Firestore...');

  try {
    // Fetch all nodes
    const nodesSnap = await getDocs(
      query(collection(firestoreDb, COLLECTIONS.NODES), orderBy('updatedAt', 'asc'))
    );
    const nodes = nodesSnap.docs.map(d => d.data() as TreeNode);
    console.log('[Migration] Found', nodes.length, 'nodes');

    // Fetch all fields
    const fieldsSnap = await getDocs(
      query(collection(firestoreDb, COLLECTIONS.FIELDS), orderBy('updatedAt', 'asc'))
    );
    const fields = fieldsSnap.docs.map(d => d.data() as DataField);
    console.log('[Migration] Found', fields.length, 'fields');

    // Fetch all history
    const historySnap = await getDocs(
      query(collection(firestoreDb, COLLECTIONS.HISTORY), orderBy('updatedAt', 'asc'))
    );
    const history = historySnap.docs.map(d => d.data() as DataFieldHistory);
    console.log('[Migration] Found', history.length, 'history entries');

    // Bulk insert into IDB
    await db.transaction('rw', db.nodes, db.fields, db.history, db.syncMetadata, async () => {
      if (nodes.length > 0) {
        await db.nodes.bulkPut(nodes);
      }
      if (fields.length > 0) {
        await db.fields.bulkPut(fields);
      }
      if (history.length > 0) {
        await db.history.bulkPut(history);
      }

      // Set last sync timestamp to now (we're in sync with Firestore)
      await db.syncMetadata.put({ key: 'lastSyncTimestamp', value: Date.now() });
    });

    console.log('[Migration] Migration complete');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    // Don't throw - app should still work with empty IDB
  }
}

/**
 * Check if storage is initialized.
 */
export function isStorageInitialized(): boolean {
  return initialized;
}

/**
 * Clear all IDB data (for testing or reset).
 */
export async function clearStorage(): Promise<void> {
  await db.delete();
  initialized = false;
  console.log('[Storage] Cleared all data');
}
