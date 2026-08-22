import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { seedLibraryDefinition } from './libraryFixtures';

describe('IDBAdapter — element operations', () => {
  let adapter: IDBAdapter;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    adapter = new IDBAdapter();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates a root node element with auto-minted siblingOrder=0', async () => {
    const res = await adapter.createElement({
      id: 'e-root',
      kind: 'node',
      parentId: null,
      name: 'Truck 1',
    });
    expect(res.data.siblingOrder).toBe(0);
    expect(res.data.kind).toBe('node');
    expect(res.data.deletedAt).toBeNull();

    const roots = await adapter.listRootElements();
    expect(roots.data).toHaveLength(1);
    expect(roots.data[0].id).toBe('e-root');
  });

  it('mints incremental siblingOrder for siblings under a parent', async () => {
    await adapter.createElement({ id: 'p', kind: 'node', parentId: null, name: 'P' });
    const c1 = await adapter.createElement({ id: 'c1', kind: 'node', parentId: 'p', name: 'C1' });
    const c2 = await adapter.createElement({ id: 'c2', kind: 'node', parentId: 'p', name: 'C2' });
    const c3 = await adapter.createElement({ id: 'c3', kind: 'node', parentId: 'p', name: 'C3' });
    expect(c1.data.siblingOrder).toBe(0);
    expect(c2.data.siblingOrder).toBe(1);
    expect(c3.data.siblingOrder).toBe(2);

    const kids = await adapter.listChildElements('p');
    expect(kids.data.map(e => e.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('mints siblingOrder per placement section: fields do not inflate a child node order', async () => {
    await adapter.createElement({ id: 'p', kind: 'node', parentId: null, name: 'P' });
    await seedLibraryDefinition('fd-1', 'text-kv');
    await adapter.createElement({ id: 'f1', kind: 'text-kv', parentId: 'p', name: 'F1', definitionId: 'fd-1' });
    await adapter.createElement({ id: 'f2', kind: 'text-kv', parentId: 'p', name: 'F2', definitionId: 'fd-1' });
    await adapter.createElement({ id: 'f3', kind: 'text-kv', parentId: 'p', name: 'F3', definitionId: 'fd-1' });

    // The parent's sole child NODE starts its own section at 0, regardless of fields.
    const c1 = await adapter.createElement({ id: 'c1', kind: 'node', parentId: 'p', name: 'C1' });
    expect(c1.data.siblingOrder).toBe(0);

    // And the inverse: a new field counts only fields (f1..f3 → next is 3).
    const f4 = await adapter.createElement({ id: 'f4', kind: 'text-kv', parentId: 'p', name: 'F4', definitionId: 'fd-1' });
    expect(f4.data.siblingOrder).toBe(3);
  });

  it('soft-deleted siblings release their siblingOrder slot', async () => {
    await adapter.createElement({ id: 'p', kind: 'node', parentId: null, name: 'P' });
    await adapter.createElement({ id: 'c1', kind: 'node', parentId: 'p', name: 'C1' });
    await adapter.softDeleteElement('c1');
    const c2 = await adapter.createElement({ id: 'c2', kind: 'node', parentId: 'p', name: 'C2' });
    expect(c2.data.siblingOrder).toBe(0);
  });

  it('soft-deleted roots do not inflate root siblingOrder', async () => {
    await adapter.createElement({ id: 'r1', kind: 'node', parentId: null, name: 'R1' });
    await adapter.softDeleteElement('r1');
    const r2 = await adapter.createElement({ id: 'r2', kind: 'node', parentId: null, name: 'R2' });
    expect(r2.data.siblingOrder).toBe(0);
  });

  it('rejects creating a value-bearing element without definitionId', async () => {
    await expect(
      adapter.createElement({ id: 'bad', kind: 'text-kv', parentId: null, name: 'X' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('creates a text-kv element when its Definition exists', async () => {
    await seedLibraryDefinition('fd-1', 'text-kv', 'VIN');
    const res = await adapter.createElement({
      id: 'e-vin',
      kind: 'text-kv',
      parentId: 'p',
      name: 'VIN',
      definitionId: 'fd-1',
      value: 'ABC123',
    });
    expect(res.data.value).toBe('ABC123');
    expect(res.data.definitionId).toBe('fd-1');

    const hist = await adapter.getElementHistory('e-vin');
    expect(hist.data).toHaveLength(1);
    expect(hist.data[0]).toMatchObject({ action: 'create', property: 'value', rev: 0, newValue: 'ABC123' });
  });

  it('logs a name history row when renaming', async () => {
    await adapter.createElement({ id: 'e1', kind: 'node', parentId: null, name: 'old' });
    await adapter.updateElement('e1', { name: 'new' });
    const hist = await adapter.getElementHistory('e1');
    const nameRow = hist.data.find(h => h.property === 'name');
    expect(nameRow).toBeDefined();
    expect(nameRow!.prevValue).toBe('old');
    expect(nameRow!.newValue).toBe('new');
  });

  it('logs subtitle, parentId, siblingOrder, and value changes independently', async () => {
    await adapter.createElement({ id: 'a', kind: 'node', parentId: null, name: 'A' });
    await adapter.createElement({ id: 'b', kind: 'node', parentId: null, name: 'B' });
    await seedLibraryDefinition('fd-1', 'text-kv');
    await adapter.createElement({
      id: 'e2',
      kind: 'text-kv',
      parentId: 'a',
      name: 'Note',
      definitionId: 'fd-1',
      value: 'hi',
    });

    await adapter.updateElement('e2', { subtitle: 'sub', parentId: 'b', siblingOrder: 9, value: 'bye' });

    const hist = await adapter.getElementHistory('e2');
    const props = hist.data.map(h => h.property).sort();
    expect(props).toEqual(expect.arrayContaining(['parentId', 'siblingOrder', 'subtitle', 'value']));
  });

  it('soft-deletes and restores an element, writing no delete history row', async () => {
    await adapter.createElement({ id: 'x', kind: 'node', parentId: null, name: 'X' });
    await adapter.softDeleteElement('x');
    const after = await adapter.getElement('x');
    expect(after.data?.deletedAt).not.toBeNull();

    const roots = await adapter.listRootElements();
    expect(roots.data).toHaveLength(0);

    // The tombstone alone leaves no audit trace: that is what makes an undo
    // inside the window a non-event (SPEC → Undo semantics).
    const hist = await adapter.getElementHistory('x');
    expect(hist.data.some(h => h.action === 'delete')).toBe(false);

    await adapter.restoreElement('x');
    const restored = await adapter.getElement('x');
    expect(restored.data?.deletedAt).toBeNull();
  });

  it('logElementDeleteHistory writes the deferred delete row, with the pre-delete value', async () => {
    await seedLibraryDefinition('fd-del', 'text-kv');
    await adapter.createElement({
      id: 'y', kind: 'text-kv', parentId: null, name: 'Y', definitionId: 'fd-del', value: 'last known',
    });
    await adapter.softDeleteElement('y');
    await adapter.logElementDeleteHistory('y');

    const hist = await adapter.getElementHistory('y');
    const row = hist.data.find(h => h.action === 'delete');
    expect(row).toBeDefined();
    expect(row!.property).toBe('value');
    // A soft delete leaves `value` intact, so the deferred read still has it.
    expect(row!.prevValue).toBe('last known');
    expect(row!.newValue).toBeNull();
  });

  it('logElementDeleteHistory writes nothing for an element that was restored', async () => {
    await adapter.createElement({ id: 'z', kind: 'node', parentId: null, name: 'Z' });
    await adapter.softDeleteElement('z');
    await adapter.restoreElement('z');
    await adapter.logElementDeleteHistory('z');

    const hist = await adapter.getElementHistory('z');
    expect(hist.data.some(h => h.action === 'delete')).toBe(false);
  });

  it('listChildElementsByKind filters by kind', async () => {
    await seedLibraryDefinition('fd-1', 'text-kv');
    await adapter.createElement({ id: 'p', kind: 'node', parentId: null, name: 'P' });
    await adapter.createElement({ id: 'n1', kind: 'node', parentId: 'p', name: 'N1' });
    await adapter.createElement({
      id: 'f1',
      kind: 'text-kv',
      parentId: 'p',
      name: 'F1',
      definitionId: 'fd-1',
      value: '',
    });
    const nodes = await adapter.listChildElementsByKind('p', 'node');
    const fields = await adapter.listChildElementsByKind('p', 'text-kv');
    expect(nodes.data.map(e => e.id)).toEqual(['n1']);
    expect(fields.data.map(e => e.id)).toEqual(['f1']);
  });

  /**
   * `rev` is still a clean sequence within one client — that is what this
   * asserts. It is no longer unique *across* clients, so the id carries a
   * random tail and is only prefixed by `${elementId}:${rev}`
   * (IMPLEMENTATION.md → *History ID Scheme*);
   * uniqueness and convergence are pinned in historyConvergence.test.ts.
   */
  it('history rev increments monotonically per element', async () => {
    await adapter.createElement({ id: 'r', kind: 'node', parentId: null, name: 'r0' });
    await adapter.updateElement('r', { name: 'r1' });
    await adapter.updateElement('r', { name: 'r2' });
    const hist = await adapter.getElementHistory('r');
    const revs = hist.data.map(h => h.rev);
    expect(revs).toEqual([0, 1, 2]);
    expect(hist.data.every(h => h.id.startsWith(`r:${h.rev}:`))).toBe(true);
    expect(new Set(hist.data.map(h => h.id)).size).toBe(3);
  });
});
