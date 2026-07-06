/**
 * Definitions are `library`-tree Elements (config-as-Elements): there is no
 * separate table, no `create/update-fieldDefinition` sync lane, and no edit path
 * (fork-not-mutate). This suite covers the surviving behaviour:
 *  - createDefinition writes a Definition Element + config sub-field children
 *  - it rides the ELEMENT sync lane (no fieldDefinition ops)
 *  - listDefinitions assembles views, sorts by label, library-only, active-only
 *
 * Remote pull of Definitions now flows through the element pull (covered by the
 * element sync tests), so the old resolver/pull-strategy cases are retired.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { configChildId } from '../kinds/configElements';

describe('IDBAdapter — Definitions as library Elements', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('createDefinition writes a library Definition Element + config children', async () => {
    const adapter = new IDBAdapter();
    const res = await adapter.createDefinition({
      id: 'fd_x',
      kind: 'number-kv',
      label: 'X',
      config: { unitsSymbol: 'kg', decimals: 2 },
    });
    expect(res.data.id).toBe('fd_x');
    expect(res.data.config).toMatchObject({ unitsSymbol: 'kg', decimals: 2 });

    const def = await db.elements.get('fd_x');
    expect(def?.treeType).toBe('library');
    expect(def?.parentId).toBeNull();
    expect(def?.name).toBe('X');

    const units = await db.elements.get(configChildId('fd_x', 'unitsSymbol'));
    expect(units?.value).toBe('kg');
    expect(units?.parentId).toBe('fd_x');
    expect(units?.treeType).toBe('library');
  });

  it('enqueues create-element / create-element-history ops (rides the element lane)', async () => {
    const adapter = new IDBAdapter();
    // text-kv + { multiline } → 1 Definition + 1 config child.
    await adapter.createDefinition({ id: 'fd_x', kind: 'text-kv', label: 'X', config: { multiline: true } });

    const queue = await db.syncQueue.toArray();
    const ops = queue.map((q) => q.operation);
    expect(ops.filter((o) => o === 'create-element')).toHaveLength(2);
    expect(ops.filter((o) => o === 'create-element-history')).toHaveLength(2);
    expect(ops).not.toContain('create-fieldDefinition');
    for (const item of queue) expect(item.entityType).not.toBe('fieldDefinition');
  });

  it('listDefinitions returns assembled views sorted by label, library-only', async () => {
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_b', kind: 'text-kv', label: 'Beta', config: {} });
    await adapter.createDefinition({ id: 'fd_a', kind: 'text-kv', label: 'Alpha', config: {} });
    // A business element must never surface as a Definition.
    await adapter.createElement({ id: 'n', kind: 'node', parentId: null, name: 'Node' });

    const defs = (await adapter.listDefinitions()).data;
    expect(defs.map((d) => d.label)).toEqual(['Alpha', 'Beta']);
  });

  it('listDefinitions excludes soft-deleted Definitions (admin tombstone)', async () => {
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_live', kind: 'text-kv', label: 'Live', config: {} });
    await adapter.createDefinition({ id: 'fd_dead', kind: 'text-kv', label: 'Dead', config: {} });
    await db.elements.update('fd_dead', { deletedAt: Date.now() });

    const defs = (await adapter.listDefinitions()).data;
    expect(defs.map((d) => d.id)).toEqual(['fd_live']);
  });

  it('getDefinition returns null for a config sub-field id (not a top-level Definition)', async () => {
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_x', kind: 'number-kv', label: 'X', config: { decimals: 1 } });

    const got = await adapter.getDefinition(configChildId('fd_x', 'decimals'));
    expect(got.data).toBeNull();
  });
});
