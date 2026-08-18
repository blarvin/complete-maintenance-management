/**
 * Definitions are `library`-tree Elements (config-as-Elements): there is no
 * separate table and no `create/update-fieldDefinition` sync lane. This suite
 * covers the write + read shape:
 *  - createDefinition writes a Definition Element + config sub-field children
 *  - it rides the ELEMENT sync lane (no fieldDefinition ops)
 *  - listDefinitions assembles views, sorts by label, library-only, active-only
 *  - identity is `definitionId === id`, at any depth under the Library Node
 *
 * Remote pull of Definitions flows through the element pull (covered by the
 * element sync tests), so the old resolver/pull-strategy cases are retired.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { configChildId, DEFINED_KIND_KEY } from '../kinds/configElements';
import { LIBRARY_ROOT_ID } from '../data/definitionIds';

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
    // A Node under the Library Node, pointing at itself — not a tree root.
    expect(def?.kind).toBe('node');
    expect(def?.parentId).toBe(LIBRARY_ROOT_ID);
    expect(def?.definitionId).toBe('fd_x');
    expect(def?.name).toBe('X');

    // The kind it defines is a config Field, and the view surfaces it as `kind`.
    expect((await db.elements.get(configChildId('fd_x', DEFINED_KIND_KEY)))?.value)
      .toBe('number-kv');
    expect(res.data.kind).toBe('number-kv');

    const units = await db.elements.get(configChildId('fd_x', 'unitsSymbol'));
    expect(units?.value).toBe('kg');
    expect(units?.parentId).toBe('fd_x');
    expect(units?.treeType).toBe('library');
  });

  it('enqueues create-element / create-element-history ops (rides the element lane)', async () => {
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_x', kind: 'text-kv', label: 'X', config: { multiline: true } });

    // 1 Definition + 1 defined-kind child + one child per text-kv schema knob
    // (materialized, valued or not).
    const expected = 1 + 1 + 4;
    const queue = await db.syncQueue.toArray();
    const ops = queue.map((q) => q.operation);
    expect(ops.filter((o) => o === 'create-element')).toHaveLength(expected);
    expect(ops.filter((o) => o === 'create-element-history')).toHaveLength(expected);
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

  it('getDefinition returns null for a config sub-field id (bound to nothing)', async () => {
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_x', kind: 'number-kv', label: 'X', config: { decimals: 1 } });

    const got = await adapter.getDefinition(configChildId('fd_x', 'decimals'));
    expect(got.data).toBeNull();
  });

  it('identity survives depth — a Definition under a folder is still a Definition', async () => {
    // `definitionId === id` is position-independent, which is what unblocked
    // arbitrary grouping inside the Library (SPEC → *What identifies a Definition*).
    // `parentId === null` could not have said this.
    const adapter = new IDBAdapter();
    await adapter.createDefinition({ id: 'fd_x', kind: 'text-kv', label: 'X', config: {} });
    await db.elements.update('fd_x', { parentId: 'some_folder_inside_the_library' });

    expect((await adapter.getDefinition('fd_x')).data?.id).toBe('fd_x');
    expect((await adapter.listDefinitions()).data.map((d) => d.id)).toContain('fd_x');
  });

  it('the Library Node is a root element, pinned above the business roots', async () => {
    const adapter = new IDBAdapter();
    await db.elements.put({
      id: LIBRARY_ROOT_ID,
      kind: 'node',
      name: 'Field Library',
      subtitle: null,
      value: null,
      parentId: null,
      siblingOrder: -1,
      definitionId: null,
      treeType: 'library',
      updatedBy: 'appDeveloper',
      updatedAt: 1,
      deletedAt: null,
    });
    await adapter.createElement({ id: 'n', kind: 'node', parentId: null, name: 'Truck' });

    const roots = (await adapter.listRootElements()).data;
    expect(roots.map((r) => r.id)).toEqual([LIBRARY_ROOT_ID, 'n']);
  });
});
