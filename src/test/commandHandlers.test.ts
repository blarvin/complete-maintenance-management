import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { IDBSyncQueueManager } from '../data/sync/SyncQueueManager';
import { CommandBus } from '../data/commands/commandBus';
import { registerAllHandlers } from '../data/commands/handlers';
import { storageEventBus } from '../data/storageEventBus';

describe('Command Handlers (integration)', () => {
  let bus: CommandBus;
  let adapter: IDBAdapter;

  beforeEach(async () => {
    await db.open();
    await db.nodes.clear();
    await db.fields.clear();
    await db.history.clear();

    const syncQueue = new IDBSyncQueueManager();
    adapter = new IDBAdapter(syncQueue);
    bus = new CommandBus();
    registerAllHandlers(bus, adapter);
  });

  afterEach(async () => {
    await db.nodes.clear();
    await db.fields.clear();
    await db.history.clear();
  });

  it('CREATE_NODE_WITH_FIELDS creates node and all default fields', async () => {
    await bus.execute({
      type: 'CREATE_NODE_WITH_FIELDS',
      payload: {
        id: 'n1',
        parentId: null,
        nodeName: 'Test Node',
        nodeSubtitle: 'Sub',
        defaults: [
          { fieldName: 'Color', fieldValue: 'Red' },
          { fieldName: 'Size', fieldValue: null },
        ],
      },
    });

    const node = await db.nodes.get('n1');
    expect(node).toBeDefined();
    expect(node!.nodeName).toBe('Test Node');

    const fields = await db.fields.where('parentNodeId').equals('n1').toArray();
    expect(fields).toHaveLength(2);
    expect(fields.map(f => f.fieldName).sort()).toEqual(['Color', 'Size']);
  });

  it('CREATE_EMPTY_NODE returns the created TreeNode', async () => {
    const result = await bus.execute({
      type: 'CREATE_EMPTY_NODE',
      payload: { id: 'n2', parentId: null },
    });

    expect(result.id).toBe('n2');
    expect(result.nodeName).toBe('');
  });

  it('ADD_FIELD returns the created DataField', async () => {
    // Create a node first
    await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });

    const field = await bus.execute({
      type: 'ADD_FIELD',
      payload: { nodeId: 'n1', fieldName: 'Weight', fieldValue: '10kg', cardOrder: 0 },
    });

    expect(field.fieldName).toBe('Weight');
    expect(field.fieldValue).toBe('10kg');
    expect(field.parentNodeId).toBe('n1');
  });

  it('UPDATE_FIELD_VALUE updates the value', async () => {
    await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });
    const field = await bus.execute({
      type: 'ADD_FIELD',
      payload: { nodeId: 'n1', fieldName: 'Color', fieldValue: 'Red' },
    });

    await bus.execute({
      type: 'UPDATE_FIELD_VALUE',
      payload: { fieldId: field.id, newValue: 'Blue' },
    });

    const updated = await db.fields.get(field.id);
    expect(updated!.fieldValue).toBe('Blue');
  });

  it('DELETE_NODE soft-deletes the node', async () => {
    await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });
    await bus.execute({ type: 'DELETE_NODE', payload: { id: 'n1' } });

    const node = await db.nodes.get('n1');
    expect(node!.deletedAt).not.toBeNull();
  });

  it('DELETE_FIELD soft-deletes the field', async () => {
    await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });
    const field = await bus.execute({
      type: 'ADD_FIELD',
      payload: { nodeId: 'n1', fieldName: 'Color', fieldValue: 'Red' },
    });

    await bus.execute({ type: 'DELETE_FIELD', payload: { fieldId: field.id } });

    const deleted = await db.fields.get(field.id);
    expect(deleted!.deletedAt).not.toBeNull();
  });

  it('emits storage events on write operations', async () => {
    const listener = vi.fn();
    const unsub = storageEventBus.subscribe(listener);

    await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NODE_WRITTEN' })
    );

    unsub();
  });
});
