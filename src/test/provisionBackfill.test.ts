/**
 * Lens backfill — reconciling `PROVISIONED_LENSES` onto nodes that already exist.
 * Provisioning is otherwise create-time only, so a node minted before a lens kind
 * existed never grows one (`logbook` landing after `jobs` is the case that already
 * happened). Real IDBAdapter + fake-indexeddb; lens rows are written straight to
 * the table to simulate a DB from before the lens kind.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { backfillProvisionedLenses } from '../data/services/provisionLenses';
import { PROVISIONED_LENSES } from '../kinds/provisionPolicy';
import type { Element, Kind, TreeType } from '../data/models';

const row = (id: string, kind: Kind, parentId: string | null, over: Partial<Element> = {}): Element => ({
  id,
  kind,
  name: id,
  subtitle: null,
  value: null,
  parentId,
  siblingOrder: 0,
  definitionId: null,
  treeType: 'business' as TreeType,
  updatedBy: 'localUser',
  updatedAt: 0,
  deletedAt: null,
  ...over,
});

const SUFFIXES = PROVISIONED_LENSES.map((l) => l.suffix);

describe('backfillProvisionedLenses', () => {
  let adapter: IDBAdapter;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    adapter = new IDBAdapter();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('grows every declared lens on a node that predates them', async () => {
    await db.elements.put(row('n1', 'node', null));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(SUFFIXES.length);
    for (const suffix of SUFFIXES) {
      expect((await db.elements.get(`n1::${suffix}`))?.parentId).toBe('n1');
    }
  });

  it('adds only what is missing when a node has some lenses already', async () => {
    // The real shape of the problem: `jobs` existed, `logbook` arrived later.
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row('n1::jobs', 'jobs', 'n1'));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(SUFFIXES.length - 1);
    expect((await db.elements.get('n1::logbook'))?.kind).toBe('logbook');
  });

  it('is idempotent — a second run writes nothing', async () => {
    await db.elements.put(row('n1', 'node', null));
    await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    const countAfterFirst = await db.elements.count();
    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(0);
    expect(await db.elements.count()).toBe(countAfterFirst);
  });

  it('skips deleted rows, non-business trees, and the kinds that never hold a lens', async () => {
    await db.elements.put(row('gone', 'node', null, { deletedAt: 1 }));
    // A re-root policy Definition is a `library` row of a lens kind.
    await db.elements.put(row('fd_policy', 'logbook', null, { treeType: 'library' as TreeType }));
    // Lens-surfaced kinds are rolled up by a lens, so they never nest their own.
    await db.elements.put(row('j1', 'job', null));
    await db.elements.put(row('le1', 'log-entry', null));
    // A lens itself gets no lens-on-lens.
    await db.elements.put(row('n1::jobs', 'jobs', null));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(0);
  });

  it('backfills each container node independently', async () => {
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row('o1', 'org', 'n1'));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(SUFFIXES.length * 2);
    expect((await db.elements.get(`o1::${SUFFIXES[0]}`))?.parentId).toBe('o1');
  });
});
