/**
 * Narrow command-handler coverage for ADD_FIELD_FROM_DEFINITION across all 4
 * Phase-1 componentTypes. Exercises the full happy path: seed a FieldDefinition,
 * dispatch the command, assert the created DataField snapshots label and
 * componentType correctly and initializes value to null.
 *
 * Broader adapter/sync test reconstruction remains tracked in ISSUES.md.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { initializeCommandBus, getCommandBus, resetCommandBus } from '../data/commands';
import { initializeQueries, resetQueries } from '../data/queries';
import type { ComponentType, FieldDefinitionConfig } from '../data/models';

async function seedDefinition(
  id: string,
  componentType: ComponentType,
  label: string,
  config: FieldDefinitionConfig,
): Promise<void> {
  await db.fieldDefinitions.put({
    id,
    componentType,
    label,
    config,
    authorId: 'test',
    updatedBy: 'test',
    updatedAt: Date.now(),
    deletedAt: null,
  });
}

async function createNode(id: string): Promise<void> {
  await db.nodes.put({
    id,
    nodeName: 'Test',
    parentId: null,
    updatedBy: 'test',
    updatedAt: Date.now(),
    deletedAt: null,
  });
}

describe('ADD_FIELD_FROM_DEFINITION across Components', () => {
  beforeEach(async () => {
    await Promise.all([
      db.nodes.clear(),
      db.fields.clear(),
      db.fieldDefinitions.clear(),
      db.history.clear(),
      db.syncQueue.clear(),
      db.syncMetadata.clear(),
    ]);
    resetCommandBus();
    resetQueries();
    const adapter = new IDBAdapter();
    initializeCommandBus(adapter);
    initializeQueries(adapter);
  });

  it('creates a text-kv DataField from a text-kv FieldDefinition', async () => {
    await createNode('n1');
    await seedDefinition('fd_desc', 'text-kv', 'Description', { multiline: true });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_desc' },
    });

    expect(result.fieldName).toBe('Description');
    expect(result.componentType).toBe('text-kv');
    expect(result.fieldDefinitionId).toBe('fd_desc');
    expect(result.value).toBeNull();
  });

  it('creates an enum-kv DataField from an enum-kv FieldDefinition', async () => {
    await createNode('n1');
    await seedDefinition('fd_status', 'enum-kv', 'Status', {
      options: ['In Service', 'Maintenance', 'Retired'],
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_status' },
    });

    expect(result.componentType).toBe('enum-kv');
    expect(result.fieldName).toBe('Status');
    expect(result.value).toBeNull();
  });

  it('creates a number-kv DataField from a number-kv FieldDefinition', async () => {
    await createNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', {
      unitsSymbol: 'kg',
      decimals: 2,
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_weight' },
    });

    expect(result.componentType).toBe('number-kv');
    expect(result.fieldName).toBe('Weight');
    expect(result.value).toBeNull();
  });

  it('creates a single-image DataField from a single-image FieldDefinition', async () => {
    await createNode('n1');
    await seedDefinition('fd_image', 'single-image', 'Main Image', {
      requireCaption: false,
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_image' },
    });

    expect(result.componentType).toBe('single-image');
    expect(result.fieldName).toBe('Main Image');
    expect(result.value).toBeNull();
  });

  it('writes a create-history entry with componentType', async () => {
    await createNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', { unitsSymbol: 'kg' });

    const field = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_weight' },
    });

    const history = await db.history.where('dataFieldId').equals(field.id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].componentType).toBe('number-kv');
    expect(history[0].action).toBe('create');
    expect(history[0].property).toBe('value');
    expect(history[0].newValue).toBeNull();
  });

  it('honors initialValue: field starts populated and writes one history entry carrying that value', async () => {
    // Composer flow used to call create (with null) then update (with value),
    // producing a leading "Empty" history row. Now creates a single entry.
    await createNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', { unitsSymbol: 'kg' });

    const field = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_DEFINITION',
      payload: { nodeId: 'n1', fieldDefinitionId: 'fd_weight', initialValue: 42 },
    });

    expect(field.value).toBe(42);

    const history = await db.history.where('dataFieldId').equals(field.id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('create');
    expect(history[0].newValue).toBe(42);
  });
});
