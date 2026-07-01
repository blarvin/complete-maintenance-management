/**
 * #6b/#6c node-like kinds: minting the new re-root kinds (org/job) through the
 * command bus, and the spec-driven per-node lens provisioning — every declared
 * lens (`jobs` + `logbook`) materialized per container node (deterministic id,
 * idempotent, recursion-guarded, container re-root kinds only — lens-surfaced
 * kinds like `job`/`log-entry` are excluded). Real IDBAdapter + fake-indexeddb.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { initializeCommandBus, getCommandBus, resetCommandBus } from '../data/commands';
import { initializeQueries, getElementQueries, resetQueries } from '../data/queries';
import { gatherDescendants } from '../data/services/capabilityEngine';
import type { Kind } from '../data/models';
import { seedLibraryDefinition } from './libraryFixtures';

const createElement = (payload: {
  id?: string;
  kind: Kind;
  parentId: string | null;
  name: string;
}) => getCommandBus().execute({ type: 'CREATE_ELEMENT', payload });

describe('#6b node-like kinds', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    resetCommandBus();
    resetQueries();
    const adapter = new IDBAdapter();
    initializeCommandBus(adapter);
    initializeQueries(adapter);
  });

  afterEach(async () => {
    await db.delete();
    resetCommandBus();
    resetQueries();
  });

  it('mints re-root kinds (org/job) without a definitionId', async () => {
    const org = await createElement({ id: 'o1', kind: 'org', parentId: null, name: 'Maintenance Dept' });
    expect(org.kind).toBe('org');
    expect(org.definitionId).toBeNull();

    const job = await createElement({ id: 'j1', kind: 'job', parentId: 'o1', name: 'Replace relay' });
    expect(job.kind).toBe('job');
  });

  it('still rejects an inline kind created without a definitionId', async () => {
    await expect(createElement({ id: 't1', kind: 'text-kv', parentId: null, name: 'x' })).rejects.toThrow();
  });

  it('provisions both lens children (jobs + logbook) on every container re-root node (node/org)', async () => {
    await createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Pump' });
    expect((await db.elements.get('n1::jobs'))?.kind).toBe('jobs');
    expect((await db.elements.get('n1::jobs'))?.parentId).toBe('n1');
    expect((await db.elements.get('n1::logbook'))?.kind).toBe('logbook');
    expect((await db.elements.get('n1::logbook'))?.parentId).toBe('n1');

    await createElement({ id: 'o1', kind: 'org', parentId: null, name: 'Dept' });
    expect((await db.elements.get('o1::jobs'))?.kind).toBe('jobs');
    expect((await db.elements.get('o1::logbook'))?.kind).toBe('logbook');
  });

  it('does not give a lens container its own lenses (recursion guard)', async () => {
    await createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Pump' });
    await createElement({ id: 'L1', kind: 'jobs', parentId: 'n1', name: 'Jobs' });
    expect(await db.elements.get('L1::jobs')).toBeUndefined();
    expect(await db.elements.get('L1::logbook')).toBeUndefined();

    await createElement({ id: 'L2', kind: 'logbook', parentId: 'n1', name: 'Logbook' });
    expect(await db.elements.get('L2::jobs')).toBeUndefined();
    expect(await db.elements.get('L2::logbook')).toBeUndefined();
  });

  it('does not provision lenses on lens-surfaced kinds (job / log-entry)', async () => {
    await createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Pump' });
    await createElement({ id: 'j1', kind: 'job', parentId: 'n1', name: 'Replace relay' });
    expect(await db.elements.get('j1::jobs')).toBeUndefined();
    expect(await db.elements.get('j1::logbook')).toBeUndefined();

    await createElement({ id: 'e1', kind: 'log-entry', parentId: 'n1', name: 'Oil check' });
    expect(await db.elements.get('e1::jobs')).toBeUndefined();
    expect(await db.elements.get('e1::logbook')).toBeUndefined();
  });

  it('provisioning is idempotent (deterministic id) for every lens', async () => {
    await createElement({ id: 'n2', kind: 'node', parentId: null, name: 'A' });
    await createElement({ id: 'n2', kind: 'node', parentId: null, name: 'A again' });
    const children = await db.elements.where('parentId').equals('n2').toArray();
    expect(children.filter((e) => e.kind === 'jobs')).toHaveLength(1);
    expect(children.filter((e) => e.kind === 'logbook')).toHaveLength(1);
  });

  it('does not provision a lens for inline (field) creates', async () => {
    await createElement({ id: 'host', kind: 'node', parentId: null, name: 'Host' });
    await seedLibraryDefinition('fd_desc', 'text-kv', 'Description', {});
    const field = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { id: 'f1', parentId: 'host', definitionId: 'fd_desc' },
    });
    expect(field.kind).toBe('text-kv');
    expect(await db.elements.get('f1::jobs')).toBeUndefined();
    expect(await db.elements.get('f1::logbook')).toBeUndefined();
  });

  it('the jobs lens rolls up its parent’s descendant jobs', async () => {
    await createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Asset' });
    await createElement({ id: 'relay', kind: 'node', parentId: 'n1', name: 'Relay' });
    await createElement({ id: 'job1', kind: 'job', parentId: 'relay', name: 'Fix relay' });
    await createElement({ id: 'job2', kind: 'job', parentId: 'n1', name: 'Inspect' });

    // The lens under n1 gathers n1's subtree filtered to `job`.
    const jobs = (await gatherDescendants('n1', getElementQueries())).filter((e) => e.kind === 'job');
    expect(jobs.map((j) => j.id).sort()).toEqual(['job1', 'job2']);
  });

  it('the logbook lens rolls up its parent’s descendant log-entries', async () => {
    await createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Asset' });
    await createElement({ id: 'relay', kind: 'node', parentId: 'n1', name: 'Relay' });
    await createElement({ id: 'e1', kind: 'log-entry', parentId: 'relay', name: 'Oil check' });
    await createElement({ id: 'e2', kind: 'log-entry', parentId: 'n1', name: 'Inspection' });

    // The same gather, filtered to `log-entry` — proves the lens generalizes by kind.
    const entries = (await gatherDescendants('n1', getElementQueries())).filter((e) => e.kind === 'log-entry');
    expect(entries.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });
});
