/**
 * Lens backfill — reconciling the provisioning schedule onto nodes that already exist.
 * Provisioning is otherwise create-time only, so a node minted before a lens kind
 * existed never grows one (`logbook` landing after `jobs` is the case that already
 * happened). Real IDBAdapter + fake-indexeddb; lens rows are written straight to
 * the table to simulate a DB from before the lens kind.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { backfillProvisionedLenses, restampUnboundLenses } from '../data/services/provisionLenses';
import { getProvisionedLenses } from '../kinds/provisionPolicy';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';
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

const SUFFIXES = getProvisionedLenses().map((l) => l.suffix);

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

  it('Library chrome rows accrue no lenses', async () => {
    await db.elements.put(row('lib_root', 'library', null, { treeType: 'library' as TreeType, siblingOrder: -1 }));
    await db.elements.put(row('lib_definitions', 'definitions', 'lib_root', { treeType: 'library' as TreeType }));
    await db.elements.put(row('lib_kinds', 'kinds', 'lib_root', { treeType: 'library' as TreeType, siblingOrder: 1 }));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(0);
    expect(await db.elements.get('lib_root::jobs')).toBeUndefined();
    expect(await db.elements.get('lib_root::logbook')).toBeUndefined();
  });

  it('backfills each container node independently', async () => {
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row('o1', 'org', 'n1'));

    const created = await backfillProvisionedLenses(await adapter.getAllElements(), adapter);

    expect(created).toBe(SUFFIXES.length * 2);
    expect((await db.elements.get(`o1::${SUFFIXES[0]}`))?.parentId).toBe('o1');
  });
});

/**
 * The binding half: a lens that minted while its policy Definition was
 * unresolvable keeps `definitionId: null` and nothing ever looks again, because
 * both provisioning entry points skip a lens that already exists.
 */
describe('restampUnboundLenses', () => {
  // `logbook` is the one lens the pack binds a policy to; `jobs` binds none.
  const bound = getProvisionedLenses().find((l) => l.definitionId)!;
  const policyId = bound.definitionId!;

  /** The policy Definition as it is bootstrapped: a library-tree root row. */
  const policyDefinition = () =>
    row(policyId, bound.kind, null, {
      treeType: 'library' as TreeType,
      updatedBy: AUTHOR_ID_APP_DEVELOPER,
    });

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('stamps a lens that minted unbound, once its policy Definition is there', async () => {
    await db.elements.put(policyDefinition());
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row(`n1::${bound.suffix}`, bound.kind, 'n1'));

    const stamped = await restampUnboundLenses(await db.elements.toArray());

    expect(stamped).toBe(1);
    expect((await db.elements.get(`n1::${bound.suffix}`))?.definitionId).toBe(policyId);
    expect((await db.elements.get(`n1::${bound.suffix}`))?.updatedBy).toBe(AUTHOR_ID_APP_DEVELOPER);
  });

  it('leaves the lens unbound while the Definition is still unresolvable', async () => {
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row(`n1::${bound.suffix}`, bound.kind, 'n1'));

    expect(await restampUnboundLenses(await db.elements.toArray())).toBe(0);
    expect((await db.elements.get(`n1::${bound.suffix}`))?.definitionId).toBeNull();
  });

  it('never stamps the policy Definition itself, which is a row of the same kind', async () => {
    await db.elements.put(policyDefinition());

    expect(await restampUnboundLenses(await db.elements.toArray())).toBe(0);
    expect((await db.elements.get(policyId))?.definitionId).toBeNull();
  });

  it('skips lenses that are already bound or deleted, and is idempotent', async () => {
    await db.elements.put(policyDefinition());
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row(`n1::${bound.suffix}`, bound.kind, 'n1', { definitionId: 'fd_other' }));
    await db.elements.put(row(`n2::${bound.suffix}`, bound.kind, 'n2', { deletedAt: 1 }));

    expect(await restampUnboundLenses(await db.elements.toArray())).toBe(0);
    expect((await db.elements.get(`n1::${bound.suffix}`))?.definitionId).toBe('fd_other');
    expect((await db.elements.get(`n2::${bound.suffix}`))?.definitionId).toBeNull();
  });

  it('enqueues no sync ops — the stamp is deterministic per client', async () => {
    await db.elements.put(policyDefinition());
    await db.elements.put(row('n1', 'node', null));
    await db.elements.put(row(`n1::${bound.suffix}`, bound.kind, 'n1'));

    await restampUnboundLenses(await db.elements.toArray());

    expect(await db.syncQueue.count()).toBe(0);
  });
});
