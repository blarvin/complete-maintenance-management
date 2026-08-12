/**
 * FirestoreAdapter exercised against the Firestore emulator.
 *
 * The suite SKIPS rather than fails when the emulator isn't reachable, so it
 * can sit in the default `npm run test` run. To exercise it for real:
 *   npm run emulator        # terminal 1
 *   npm run test:firestore  # terminal 2
 *
 * Two hazards this file is shaped around, both already paid for once:
 *
 * 1. PRODUCTION SAFETY. In Node, `syncTarget` resolves to 'production' and
 *    firebase.ts gates its `connectFirestoreEmulator` call on `isBrowser` — so
 *    the real `db` export points at the LIVE project. That is the globalSetup
 *    bug recorded in vitest.config.ts. `../data/firebase` is therefore mocked
 *    with an emulator-bound Firestore; the adapter's hardcoded
 *    `import { db } from "../firebase"` binds to that and has no path to
 *    production.
 * 2. RUNNER HANG. The SDK opens a session it never closes, which wedged the
 *    runner after a green suite (ISSUES Tech Debt #1). `afterAll` terminates
 *    the instance and deletes the app.
 *
 * The emulator is wiped before each test: `pullAll*` reads whole collections,
 * so one test's leftover document changes the next test's result. Cypress
 * already treats a wipe as the norm (`cy.freshVisit()`).
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { doc, getDoc, terminate } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { FirestoreAdapter } from '../data/storage/firestoreAdapter';
import type { Element, ElementHistory } from '../data/models';
import type { SyncOperation, SyncQueueItem } from '../data/storage/db';
import { COLLECTIONS, USER_ID } from '../constants';

// Hoisted above the imports so the `vi.mock` factory below can reach it. The
// factory is what actually builds the Firestore instance — it's the earliest
// point that can legally `await import` the SDK — and it writes the handles
// back here for the tests and for teardown.
const emu = vi.hoisted(() => ({
  HOST: '127.0.0.1',
  PORT: 8080,
  PROJECT_ID: 'treeview-blarapp',
  app: null as FirebaseApp | null,
  db: null as Firestore | null,
}));

vi.mock('../data/firebase', async () => {
  const { initializeApp } = await import('firebase/app');
  const { initializeFirestore, connectFirestoreEmulator, memoryLocalCache } =
    await import('firebase/firestore');

  // A *named* app, so this can never collide with the default app the real
  // firebase.ts creates as an import-time side effect.
  const app = initializeApp({ projectId: emu.PROJECT_ID }, 'vitest-emulator');
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

function emuDb(): Firestore {
  if (!emu.db) throw new Error('Emulator Firestore missing — the firebase mock did not run.');
  return emu.db;
}

async function emulatorReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${EMULATOR_ROOT}/`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Drop every document in the emulator project. */
async function wipeEmulator(): Promise<void> {
  const res = await fetch(
    `${EMULATOR_ROOT}/emulator/v1/projects/${emu.PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Emulator wipe failed: ${res.status} ${res.statusText}`);
}

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-pump',
    kind: 'node',
    name: 'Pump A',
    subtitle: null,
    value: null,
    parentId: null,
    siblingOrder: 0,
    definitionId: null,
    treeType: 'business',
    updatedBy: USER_ID,
    updatedAt: Date.now(),
    deletedAt: null,
    ...overrides,
  };
}

function queueItem(
  operation: SyncOperation,
  entityId: string,
  payload: unknown,
): SyncQueueItem {
  return {
    id: `q-${operation}-${entityId}`,
    operation,
    entityType: operation === 'create-element-history' ? 'element-history' : 'element',
    entityId,
    payload,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };
}

const emulatorUp = await emulatorReachable();

if (!emulatorUp) {
  console.warn(
    `[firestoreAdapter.test] Firestore emulator unreachable at ${EMULATOR_ROOT} — suite skipped. Start it with \`npm run emulator\`.`,
  );
}

describe.skipIf(!emulatorUp)('FirestoreAdapter — emulator round-trip', () => {
  let adapter: FirestoreAdapter;

  beforeEach(async () => {
    await wipeEmulator();
    adapter = new FirestoreAdapter();
  });

  afterAll(async () => {
    if (emu.db) await terminate(emu.db);
    if (emu.app) await deleteApp(emu.app);
  });

  it('create-element writes the document with a server-side updatedAt', async () => {
    const el = makeElement({ id: 'el-a', name: 'Pump A' });
    await adapter.applySyncItem(queueItem('create-element', el.id, el));

    const pulled = await adapter.pullAllElements();
    expect(pulled).toHaveLength(1);
    expect(pulled[0].id).toBe('el-a');
    expect(pulled[0].name).toBe('Pump A');
    // serverTimestamp() lands as a Timestamp; coerceTimestamps returns epoch ms.
    expect(typeof pulled[0].updatedAt).toBe('number');
    expect(pulled[0].updatedAt).toBeGreaterThan(0);
  });

  it('update-element merges, leaving untouched columns intact', async () => {
    const el = makeElement({ id: 'el-a', name: 'Pump A', subtitle: 'original subtitle' });
    await adapter.applySyncItem(queueItem('create-element', el.id, el));

    // A partial payload — the shape a single-property edit produces. Without
    // { merge: true } this write clobbers every column it omits.
    await adapter.applySyncItem(
      queueItem('update-element', 'el-a', { id: 'el-a', name: 'Pump A renamed' }),
    );

    const pulled = await adapter.pullAllElements();
    expect(pulled[0].name).toBe('Pump A renamed');
    expect(pulled[0].subtitle).toBe('original subtitle');
  });

  it('delete-element soft-deletes: the document survives with deletedAt set', async () => {
    await adapter.applySyncItem(queueItem('create-element', 'el-a', makeElement({ id: 'el-a' })));
    await adapter.applySyncItem(queueItem('delete-element', 'el-a', null));

    // Delta sync detects deletions by reading the tombstone, so the document
    // itself must still be there.
    const snap = await getDoc(doc(emuDb(), COLLECTIONS.ELEMENTS, 'el-a'));
    expect(snap.exists()).toBe(true);

    const pulled = await adapter.pullAllElements();
    expect(pulled[0].deletedAt).toEqual(expect.any(Number));
  });

  it('create-element-history writes to the elementHistory collection only', async () => {
    const history: ElementHistory = {
      id: 'el-a:0',
      elementId: 'el-a',
      rev: 0,
      action: 'create',
      property: 'name',
      prevValue: null,
      newValue: 'Pump A',
      updatedBy: USER_ID,
      updatedAt: Date.now(),
    };
    await adapter.applySyncItem(queueItem('create-element-history', history.id, history));

    const pulled = await adapter.pullAllElementHistory();
    expect(pulled.map(h => h.id)).toEqual(['el-a:0']);
    expect(await adapter.pullAllElements()).toEqual([]);
  });

  it('an unknown operation warns and resolves rather than throwing', async () => {
    // SyncPusher treats a rejection as a retryable failure; an unrecognised op
    // would then be retried until it exhausts MAX_SYNC_RETRIES.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bogus = {
      ...queueItem('create-element', 'el-a', makeElement({ id: 'el-a' })),
      operation: 'frobnicate',
    } as unknown as SyncQueueItem;

    await expect(adapter.applySyncItem(bogus)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(await adapter.pullAllElements()).toEqual([]);
    warn.mockRestore();
  });

  it('pullElementsSince returns only elements written after the cursor', async () => {
    await adapter.applySyncItem(
      queueItem('create-element', 'el-old', makeElement({ id: 'el-old' })),
    );

    // Take the cursor from the server's own stamp rather than the local clock:
    // the emulator assigns updatedAt, and SyncManager likewise persists a value
    // it read back from a pull.
    const [old] = await adapter.pullAllElements();
    const cursor = old.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 50));
    await adapter.applySyncItem(
      queueItem('create-element', 'el-new', makeElement({ id: 'el-new' })),
    );

    // pullElementHistorySince has the identical filter shape, so whatever this
    // proves about the element lane holds for history too.
    const delta = await adapter.pullElementsSince(cursor);
    expect(delta.map(e => e.id)).toEqual(['el-new']);
  });
});
