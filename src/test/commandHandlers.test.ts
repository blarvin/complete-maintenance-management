/**
 * Coverage for CREATE_ELEMENT_FROM_DEFINITION across all 4 Phase-1 kinds.
 * Asserts the snapshot of Definition.label → element.name and that
 * initial-value creates write a single history row carrying the value.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { initializeCommandBus, getCommandBus, resetCommandBus } from '../data/commands';
import { initializeQueries, resetQueries } from '../data/queries';
import type { Kind, DefinitionConfig } from '../data/models';
import { seedLibraryDefinition } from './libraryFixtures';

async function seedDefinition(
  id: string,
  kind: Kind,
  label: string,
  config: DefinitionConfig,
): Promise<void> {
  await seedLibraryDefinition(id, kind, label, config);
}

async function createParentNode(id: string): Promise<void> {
  await getCommandBus().execute({
    type: 'CREATE_ELEMENT',
    payload: { id, kind: 'node', parentId: null, name: 'Test' },
  });
}

describe('CREATE_ELEMENT_FROM_DEFINITION across kinds', () => {
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

  it('creates a text-kv element from a text-kv Definition', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_desc', 'text-kv', 'Description', { multiline: true });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_desc' },
    });

    expect(result.name).toBe('Description');
    expect(result.kind).toBe('text-kv');
    expect(result.definitionId).toBe('fd_desc');
    expect(result.value).toBeNull();
  });

  it('creates an enum-kv element', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_status', 'enum-kv', 'Status', {
      options: ['In Service', 'Maintenance', 'Retired'],
    });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_status' },
    });

    expect(result.kind).toBe('enum-kv');
    expect(result.name).toBe('Status');
    expect(result.value).toBeNull();
  });

  it("mints with the Definition's default when the create surface supplied no value", async () => {
    await createParentNode('n1');
    await seedDefinition('fd_status', 'enum-kv', 'Status', {
      options: ['In Service', 'Maintenance', 'Retired'],
      default: 'In Service',
    });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_status' },
    });

    // Not unfilled: the Definition already said what a new one starts as.
    expect(result.value).toBe('In Service');
  });

  it('lets an explicit initialValue beat the Definition default', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_status', 'enum-kv', 'Status', {
      options: ['In Service', 'Maintenance', 'Retired'],
      default: 'In Service',
    });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_status', initialValue: 'Retired' },
    });

    // The value slot speaks about this instance; the default about every one.
    expect(result.value).toBe('Retired');
  });

  it('creates a number-kv element', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', {
      unitsSymbol: 'kg',
      decimals: 2,
    });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_weight' },
    });

    expect(result.kind).toBe('number-kv');
    expect(result.name).toBe('Weight');
    expect(result.value).toBeNull();
  });

  it('creates a single-image element', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_image', 'single-image', 'Main Image', {
      requireCaption: false,
    });

    const result = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_image' },
    });

    expect(result.kind).toBe('single-image');
    expect(result.name).toBe('Main Image');
    expect(result.value).toBeNull();
  });

  it('writes one create-history entry with property=value', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', { unitsSymbol: 'kg' });

    const element = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_weight' },
    });

    const history = await db.elementHistory.where('elementId').equals(element.id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('create');
    expect(history[0].property).toBe('value');
    expect(history[0].newValue).toBeNull();
  });

  it('honors initialValue: element starts populated; history entry carries that value', async () => {
    await createParentNode('n1');
    await seedDefinition('fd_weight', 'number-kv', 'Weight', { unitsSymbol: 'kg' });

    const element = await getCommandBus().execute({
      type: 'CREATE_ELEMENT_FROM_DEFINITION',
      payload: { parentId: 'n1', definitionId: 'fd_weight', initialValue: 42 },
    });

    expect(element.value).toBe(42);

    const history = await db.elementHistory.where('elementId').equals(element.id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('create');
    expect(history[0].newValue).toBe(42);
  });
});
