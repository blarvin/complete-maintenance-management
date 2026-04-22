/**
 * Narrow command-handler coverage for ADD_FIELD_FROM_TEMPLATE across all 4
 * Phase-1 componentTypes. Exercises the full happy path: seed a Template,
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
import type { ComponentType, DataFieldTemplateConfig } from '../data/models';

async function seedTemplate(
  id: string,
  componentType: ComponentType,
  label: string,
  config: DataFieldTemplateConfig,
): Promise<void> {
  await db.templates.put({
    id,
    componentType,
    label,
    config,
    updatedBy: 'test',
    updatedAt: Date.now(),
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

describe('ADD_FIELD_FROM_TEMPLATE across Components', () => {
  beforeEach(async () => {
    await Promise.all([
      db.nodes.clear(),
      db.fields.clear(),
      db.templates.clear(),
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

  it('creates a text-kv DataField from a text-kv Template', async () => {
    await createNode('n1');
    await seedTemplate('tpl_desc', 'text-kv', 'Description', { multiline: true });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_TEMPLATE',
      payload: { nodeId: 'n1', templateId: 'tpl_desc' },
    });

    expect(result.fieldName).toBe('Description');
    expect(result.componentType).toBe('text-kv');
    expect(result.templateId).toBe('tpl_desc');
    expect(result.value).toBeNull();
  });

  it('creates an enum-kv DataField from an enum-kv Template', async () => {
    await createNode('n1');
    await seedTemplate('tpl_status', 'enum-kv', 'Status', {
      options: ['In Service', 'Maintenance', 'Retired'],
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_TEMPLATE',
      payload: { nodeId: 'n1', templateId: 'tpl_status' },
    });

    expect(result.componentType).toBe('enum-kv');
    expect(result.fieldName).toBe('Status');
    expect(result.value).toBeNull();
  });

  it('creates a measurement-kv DataField from a measurement-kv Template', async () => {
    await createNode('n1');
    await seedTemplate('tpl_weight', 'measurement-kv', 'Weight', {
      units: 'kg',
      decimals: 2,
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_TEMPLATE',
      payload: { nodeId: 'n1', templateId: 'tpl_weight' },
    });

    expect(result.componentType).toBe('measurement-kv');
    expect(result.fieldName).toBe('Weight');
    expect(result.value).toBeNull();
  });

  it('creates a single-image DataField from a single-image Template', async () => {
    await createNode('n1');
    await seedTemplate('tpl_image', 'single-image', 'Main Image', {
      requireCaption: false,
    });

    const result = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_TEMPLATE',
      payload: { nodeId: 'n1', templateId: 'tpl_image' },
    });

    expect(result.componentType).toBe('single-image');
    expect(result.fieldName).toBe('Main Image');
    expect(result.value).toBeNull();
  });

  it('writes a create-history entry with componentType', async () => {
    await createNode('n1');
    await seedTemplate('tpl_weight', 'measurement-kv', 'Weight', { units: 'kg' });

    const field = await getCommandBus().execute({
      type: 'ADD_FIELD_FROM_TEMPLATE',
      payload: { nodeId: 'n1', templateId: 'tpl_weight' },
    });

    const history = await db.history.where('dataFieldId').equals(field.id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].componentType).toBe('measurement-kv');
    expect(history[0].action).toBe('create');
    expect(history[0].property).toBe('value');
    expect(history[0].newValue).toBeNull();
  });
});
