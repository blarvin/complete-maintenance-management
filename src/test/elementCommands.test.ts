import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { initializeCommandBus, getCommandBus, resetCommandBus } from '../data/commands';
import { initializeQueries, getElementQueries, resetQueries } from '../data/queries';
import { seedLibraryDefinition } from './libraryFixtures';

describe('Element commands + queries', () => {
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

  it('CREATE_ELEMENT creates a node and getElementQueries finds it as root', async () => {
    const bus = getCommandBus();
    const el = await bus.execute({
      type: 'CREATE_ELEMENT',
      payload: { id: 'r', kind: 'node', parentId: null, name: 'Truck' },
    });
    expect(el.id).toBe('r');

    const roots = await getElementQueries().getRootElements();
    expect(roots.map(e => e.id)).toEqual(['r']);
  });

  it('CREATE_ELEMENT_FROM_DEFINITION snapshots label as name and uses kind from definition', async () => {
    await seedLibraryDefinition('fd-vin', 'text-kv', 'VIN');
    const bus = getCommandBus();
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'p', kind: 'node', parentId: null, name: 'P' } });
    const created = await bus.execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { id: 'f1', parentId: 'p', definitionId: 'fd-vin', initialValue: 'AAA' },
    });
    expect(created.kind).toBe('text-kv');
    expect(created.name).toBe('VIN');
    expect(created.value).toBe('AAA');
  });

  it('UPDATE_ELEMENT_NAME / _SUBTITLE / _VALUE each produce a history row', async () => {
    const bus = getCommandBus();
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'e1', kind: 'node', parentId: null, name: 'a' } });
    await bus.execute({ type: 'UPDATE_ELEMENT_NAME', payload: { id: 'e1', name: 'b' } });
    await bus.execute({ type: 'UPDATE_ELEMENT_SUBTITLE', payload: { id: 'e1', subtitle: 'sub' } });

    const hist = await getElementQueries().getElementHistory('e1');
    const props = hist.map(h => h.property);
    expect(props).toContain('name');
    expect(props).toContain('subtitle');
  });

  it('MOVE_ELEMENT updates parentId and siblingOrder, logging both', async () => {
    const bus = getCommandBus();
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'a', kind: 'node', parentId: null, name: 'A' } });
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'b', kind: 'node', parentId: null, name: 'B' } });
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'child', kind: 'node', parentId: 'a', name: 'Child' } });

    await bus.execute({ type: 'MOVE_ELEMENT', payload: { id: 'child', parentId: 'b', siblingOrder: 5 } });

    const child = await getElementQueries().getElementById('child');
    expect(child?.parentId).toBe('b');
    expect(child?.siblingOrder).toBe(5);

    const hist = await getElementQueries().getElementHistory('child');
    const props = hist.map(h => h.property);
    expect(props).toEqual(expect.arrayContaining(['parentId', 'siblingOrder']));
  });

  it('DELETE_ELEMENT soft-deletes and RESTORE_ELEMENT brings it back', async () => {
    const bus = getCommandBus();
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'x', kind: 'node', parentId: null, name: 'X' } });
    await bus.execute({ type: 'DELETE_ELEMENT', payload: { id: 'x' } });
    expect(await getElementQueries().getRootElements()).toHaveLength(0);

    await bus.execute({ type: 'RESTORE_ELEMENT', payload: { id: 'x' } });
    const el = await getElementQueries().getElementById('x');
    expect(el?.deletedAt).toBeNull();
  });

  it('getChildrenByKind separates node children from field children', async () => {
    await seedLibraryDefinition('fd-1', 'text-kv', 'L');
    const bus = getCommandBus();
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'p', kind: 'node', parentId: null, name: 'P' } });
    await bus.execute({ type: 'CREATE_ELEMENT', payload: { id: 'n', kind: 'node', parentId: 'p', name: 'N' } });
    await bus.execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { id: 'f', parentId: 'p', definitionId: 'fd-1' },
    });

    const q = getElementQueries();
    expect((await q.getChildrenByKind('p', 'node')).map(e => e.id)).toEqual(['n']);
    expect((await q.getChildrenByKind('p', 'text-kv')).map(e => e.id)).toEqual(['f']);
  });
});
