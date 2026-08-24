/**
 * SyncManager exercised against the Firestore emulator.
 *
 * `firestoreAdapter.test.ts` covers the *adapter* lane — one `applySyncItem`
 * or one pull at a time. Nothing covered the *sync* lane: a real push→pull
 * cycle, server-authority resolution against a row genuinely sitting in the
 * queue, or the cursor advancing across cycles off server-stamped rows. Both
 * 2026-08-13 fixes live exactly there and were mock-only until this file — the
 * high-water cursor and history convergence (IMPLEMENTATION.md → *The delta
 * cursor is a high-water mark, not the clock* / *History ID Scheme*), whose
 * real proof is two appends surviving a round trip *through Firestore*, which
 * is where the collision happened, rather than through two local `put` calls.
 *
 * Shaped after firestoreAdapter.test.ts, which already paid for the two
 * hazards here: `../data/firebase` is mocked with an emulator-bound Firestore
 * (in Node the real one resolves to PRODUCTION — see vitest.config.ts), and
 * `afterAll` terminates the SDK session that otherwise wedges the runner.
 *
 * It runs against its **own project id**. `fileParallelism: false` means the
 * two emulator files cannot currently interleave their wipes, but that is a
 * config setting rather than a property of these tests; separate projects make
 * the isolation real either way. Skips rather than fails when the emulator is
 * down, so it sits in the default `npm run test` run.
 */

import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest';
import { terminate } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { db as localDb } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { FirestoreAdapter } from '../data/storage/firestoreAdapter';
import { IDBSyncQueueManager } from '../data/sync/SyncQueueManager';
import { SyncManager } from '../data/sync/syncManager';
import { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import { FullCollectionSync } from '../data/sync/strategies';
import { createElementHistoryEntry } from '../data/storage/historyHelpers';
import { setSnackbarService } from '../services/snackbar';
import type { SyncQueueItem } from '../data/storage/db';
import type { ElementHistory } from '../data/models';
import { USER_ID } from '../constants';

const emu = vi.hoisted(() => ({
  HOST: '127.0.0.1',
  PORT: 8080,
  // Distinct from firestoreAdapter.test.ts's project so neither file's
  // whole-project wipe can reach the other's documents.
  PROJECT_ID: 'treeview-blarapp-syncmgr',
  app: null as FirebaseApp | null,
  db: null as Firestore | null,
}));

vi.mock('../data/firebase', async () => {
  const { initializeApp } = await import('firebase/app');
  const { initializeFirestore, connectFirestoreEmulator, memoryLocalCache } =
    await import('firebase/firestore');

  const app = initializeApp({ projectId: emu.PROJECT_ID }, 'vitest-syncmgr-emulator');
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, emu.HOST, emu.PORT);

  emu.app = app;
  emu.db = db;

  return {
    db,
    projectId: emu.PROJECT_ID,
    isBrowserEnv: false,
    clearFirebaseIndexedDB: async () => {},
  };
});

const EMULATOR_ROOT = `http://${emu.HOST}:${emu.PORT}`;

async function emulatorReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${EMULATOR_ROOT}/`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function wipeEmulator(): Promise<void> {
  const res = await fetch(
    `${EMULATOR_ROOT}/emulator/v1/projects/${emu.PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Emulator wipe failed: ${res.status} ${res.statusText}`);
}

/** Drop the local store — the honest way to simulate "a different client". */
async function freshLocalStore(): Promise<void> {
  await localDb.delete();
  await localDb.open();
}

function historyItem(entry: ElementHistory): SyncQueueItem {
  return {
    id: `q-${entry.id}`,
    operation: 'create-element-history',
    entityType: 'element-history',
    entityId: entry.id,
    payload: entry,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };
}

const emulatorUp = await emulatorReachable();

if (!emulatorUp) {
  console.warn(
    `[syncManagerEmulator.test] Firestore emulator unreachable at ${EMULATOR_ROOT} — suite skipped. Start it with \`npm run emulator\`.`,
  );
}

describe.skipIf(!emulatorUp)('SyncManager — emulator round-trip', () => {
  let local: IDBAdapter;
  let remote: FirestoreAdapter;
  let queue: IDBSyncQueueManager;
  let manager: SyncManager;

  beforeAll(() => {
    // canSync() reads navigator.onLine; Node's bare navigator global lacks it,
    // so an unstubbed run would take every sync as "offline" and no-op.
    vi.stubGlobal('navigator', { onLine: true });
    // notifyIfExhausted resolves the snackbar service on any exhausted push.
    setSnackbarService({
      show: () => {},
      dismiss: () => {},
      pauseTimer: () => {},
      resumeTimer: () => {},
    });
  });

  beforeEach(async () => {
    await wipeEmulator();
    await freshLocalStore();
    queue = new IDBSyncQueueManager();
    local = new IDBAdapter(queue);
    remote = new FirestoreAdapter();
    manager = new SyncManager(local, remote, queue);
  });

  afterAll(async () => {
    setSnackbarService(null);
    vi.unstubAllGlobals();
    if (emu.db) await terminate(emu.db);
    if (emu.app) await deleteApp(emu.app);
  });

  describe('push → pull cycle', () => {
    it('a locally created element reaches the server and comes back to a fresh client', async () => {
      await local.createElement({ id: 'el-pump', kind: 'node', parentId: null, name: 'Pump A' });

      await manager.syncDelta();

      // It genuinely left the machine.
      const onServer = await remote.pullAllElements();
      expect(onServer.map(e => e.id)).toContain('el-pump');
      // And the queue drained rather than silently parking the item.
      expect(await queue.getSyncQueue()).toHaveLength(0);

      // A different client: empty local store, same server.
      await freshLocalStore();
      expect((await local.listRootElements()).data).toHaveLength(0);

      await manager.syncFull();

      const arrived = await local.listRootElements();
      expect(arrived.data.map(e => e.id)).toEqual(['el-pump']);
      expect(arrived.data[0].name).toBe('Pump A');
    });

    it('a local soft delete travels as a tombstone, not an absence', async () => {
      await local.createElement({ id: 'el-pump', kind: 'node', parentId: null, name: 'Pump A' });
      await manager.syncDelta();
      await local.softDeleteElement('el-pump');
      await manager.syncDelta();

      const onServer = await remote.pullAllElements();
      const row = onServer.find(e => e.id === 'el-pump');
      expect(row).toBeDefined();
      expect(row!.deletedAt).toEqual(expect.any(Number));
    });
  });

  describe('server authority', () => {
    /**
     * The resolver skips a remote row whose id is sitting in the sync queue —
     * the local edit has not been pushed yet and must not be clobbered by the
     * server state it is about to overwrite. Driven through the strategy
     * rather than `syncDelta()` on purpose: syncDelta pushes first, which
     * would drain the queue and destroy the very condition under test.
     */
    it('does not overwrite a local row that still has a pending edit queued', async () => {
      await local.createElement({ id: 'el-pump', kind: 'node', parentId: null, name: 'Pump A' });
      await manager.syncDelta(); // push it, queue drains

      // Another client renames it on the server.
      const [serverRow] = await remote.pullAllElements();
      await remote.applySyncItem({
        id: 'q-other-client',
        operation: 'update-element',
        entityType: 'element',
        entityId: 'el-pump',
        payload: { ...serverRow, name: 'Renamed by other client' },
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      });

      // Meanwhile this client edits it and has not pushed.
      await local.updateElement('el-pump', { name: 'Renamed locally, unpushed' });
      const pending = await queue.getSyncQueue();
      expect(pending.some(i => i.entityId === 'el-pump')).toBe(true);

      const strategy = new FullCollectionSync(local, remote, new ServerAuthorityResolver(local, queue));
      await strategy.sync();

      const after = await local.getElement('el-pump');
      expect(after.data!.name).toBe('Renamed locally, unpushed');
    });

    it('applies the server row once nothing is pending for it', async () => {
      await local.createElement({ id: 'el-pump', kind: 'node', parentId: null, name: 'Pump A' });
      await manager.syncDelta();

      const [serverRow] = await remote.pullAllElements();
      await remote.applySyncItem({
        id: 'q-other-client',
        operation: 'update-element',
        entityType: 'element',
        entityId: 'el-pump',
        payload: { ...serverRow, name: 'Renamed by other client' },
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      });

      await manager.syncFull();

      const after = await local.getElement('el-pump');
      expect(after.data!.name).toBe('Renamed by other client');
    });
  });

  describe('the cursor advances off server stamps', () => {
    /**
     * The high-water-mark cursor against a real server: `updatedAt` here is a genuine
     * `serverTimestamp()`, not a fixture, so this is the first test where the
     * cursor and the rows it is compared against come from different clocks
     * for real.
     */
    it('lands on the newest server stamp across both lanes', async () => {
      await local.createElement({ id: 'el-a', kind: 'node', parentId: null, name: 'A' });
      await manager.syncDelta();

      await freshLocalStore();
      await manager.syncFull();

      // Both lanes, because elements and history share the one cursor and the
      // mark is the max over both. They are separate `setDoc` calls, so the
      // history row's stamp is genuinely a few ms later than its element's —
      // an elements-only expectation fails here by exactly that gap.
      const elements = await remote.pullAllElements();
      const history = await remote.pullAllElementHistory();
      const serverStamps = [...elements, ...history].map(r => r.updatedAt);
      const cursor = await local.getLastSyncTimestamp();

      expect(cursor).toBe(Math.max(...serverStamps));
      // The whole point: the cursor is a value the *server* minted, not
      // one this process made up.
      expect(serverStamps).toContain(cursor);
    });

    it('carries the cursor forward across cycles and still sees later writes', async () => {
      await local.createElement({ id: 'el-a', kind: 'node', parentId: null, name: 'A' });
      await manager.syncDelta();

      await freshLocalStore();
      await manager.syncFull();
      const firstCursor = await local.getLastSyncTimestamp();
      expect(firstCursor).toBeGreaterThan(0);

      // A later write from elsewhere, stamped after that cursor.
      await new Promise(resolve => setTimeout(resolve, 50));
      await remote.applySyncItem({
        id: 'q-later',
        operation: 'create-element',
        entityType: 'element',
        entityId: 'el-b',
        payload: {
          id: 'el-b', kind: 'node', name: 'B', subtitle: null, value: null,
          parentId: null, siblingOrder: 1, definitionId: null, treeType: 'business',
          updatedBy: USER_ID, updatedAt: Date.now(), deletedAt: null,
        },
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      });

      await manager.syncDelta();

      // The delta pull found it — the cursor was behind it, not past it.
      const roots = await local.listRootElements();
      expect(roots.data.map(e => e.id).sort()).toEqual(['el-a', 'el-b']);
      expect(await local.getLastSyncTimestamp()).toBeGreaterThan(firstCursor);
    });

    it('leaves the cursor alone when a cycle pulls nothing', async () => {
      await local.createElement({ id: 'el-a', kind: 'node', parentId: null, name: 'A' });
      await manager.syncDelta();
      await freshLocalStore();
      await manager.syncFull();

      const before = await local.getLastSyncTimestamp();
      await manager.syncDelta(); // nothing new on the server
      expect(await local.getLastSyncTimestamp()).toBe(before);
    });
  });

  describe('history convergence through Firestore', () => {
    /**
     * IMPLEMENTATION.md → *History ID Scheme*, on the path where it actually
     * bit. Two clients both at
     * rev 5 on the same element, both pushing — through `applySyncItem`, the
     * real push, whose `setDoc` carries no merge and no create-guard.
     */
    it('two clients at the same rev both survive the round trip', async () => {
      const laptop = createElementHistoryEntry({
        elementId: 'el-pump', rev: 5, action: 'update',
        property: 'value', prevValue: '10', newValue: '99',
      });
      const phone = createElementHistoryEntry({
        elementId: 'el-pump', rev: 5, action: 'update',
        property: 'value', prevValue: '10', newValue: '20',
      });

      await remote.applySyncItem(historyItem(laptop));
      await remote.applySyncItem(historyItem(phone));

      const pulled = await remote.pullAllElementHistory();
      expect(pulled).toHaveLength(2);
      expect(pulled.map(h => h.newValue).sort()).toEqual(['20', '99']);

      // And both land locally, which is what the history viewer reads.
      for (const h of pulled) await local.applyRemoteElementHistory(h);
      const stored = await local.getElementHistory('el-pump');
      expect(stored.data).toHaveLength(2);
    });

    /**
     * The mechanism, stated as a test so the regression can't quietly return:
     * sharing a document id is what destroyed an append. This is the old
     * `${elementId}:${rev}` scheme reproduced by hand.
     */
    it('sharing a document id is what loses an append', async () => {
      const shared = (newValue: string): ElementHistory => ({
        id: 'el-pump:5', // the pre-fix scheme — no discriminator
        elementId: 'el-pump',
        rev: 5,
        action: 'update',
        property: 'value',
        prevValue: '10',
        newValue,
        updatedBy: USER_ID,
        updatedAt: Date.now(),
      });

      await remote.applySyncItem(historyItem(shared('99')));
      await remote.applySyncItem(historyItem(shared('20')));

      const pulled = await remote.pullAllElementHistory();
      expect(pulled).toHaveLength(1); // one append destroyed the other
      expect(pulled[0].newValue).toBe('20'); // last writer won
    });

    it('a locally written history row reaches the server through a sync cycle', async () => {
      await local.createElement({ id: 'el-pump', kind: 'node', parentId: null, name: 'Pump A' });
      await local.updateElement('el-pump', { name: 'Pump B' });

      await manager.syncDelta();

      const pulled = await remote.pullAllElementHistory();
      const forElement = pulled.filter(h => h.elementId === 'el-pump');
      expect(forElement.length).toBeGreaterThanOrEqual(2); // create + the rename
      expect(new Set(forElement.map(h => h.id)).size).toBe(forElement.length);
      expect(forElement.some(h => h.property === 'name' && h.newValue === 'Pump B')).toBe(true);
    });
  });
});
