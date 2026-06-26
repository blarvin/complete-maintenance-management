import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../data/storage/db';

describe('AppDatabase schema (v9 — FieldDefinition componentType index → kind)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('opens at version 9', () => {
    expect(db.verno).toBe(9);
  });

  it('no longer exposes the legacy nodes/fields/history stores', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).not.toContain('nodes');
    expect(tableNames).not.toContain('fields');
    expect(tableNames).not.toContain('history');
    expect(tableNames).toEqual(
      expect.arrayContaining(['elements', 'elementHistory', 'fieldDefinitions', 'syncQueue', 'syncMetadata']),
    );
  });

  it('has elements store with expected indexes', () => {
    const t = db.table('elements');
    const indexNames = t.schema.indexes.map((i) => i.name);
    expect(t.schema.primKey.name).toBe('id');
    expect(indexNames).toEqual(
      expect.arrayContaining(['parentId', 'kind', 'fieldDefinitionId', 'siblingOrder', 'updatedAt', 'deletedAt']),
    );
  });

  it('indexes fieldDefinitions by kind (renamed from componentType in v9)', () => {
    const t = db.table('fieldDefinitions');
    const indexNames = t.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('kind');
    expect(indexNames).not.toContain('componentType');
  });

  it('has elementHistory store with elementId+rev compound index', () => {
    const t = db.table('elementHistory');
    const indexNames = t.schema.indexes.map((i) => i.name);
    expect(t.schema.primKey.name).toBe('id');
    expect(indexNames).toEqual(expect.arrayContaining(['elementId', 'updatedAt', 'rev', '[elementId+rev]']));
  });

  it('round-trips an Element row', async () => {
    await db.elements.put({
      id: 'e1',
      kind: 'node',
      name: 'Truck 1',
      subtitle: null,
      value: null,
      parentId: null,
      siblingOrder: 1,
      fieldDefinitionId: null,
      updatedBy: 'localUser',
      updatedAt: Date.now(),
      deletedAt: null,
    });
    const got = await db.elements.get('e1');
    expect(got?.name).toBe('Truck 1');
    expect(got?.kind).toBe('node');
  });

  it('round-trips an ElementHistory row keyed by elementId:rev', async () => {
    await db.elementHistory.put({
      id: 'e1:0',
      elementId: 'e1',
      rev: 0,
      action: 'create',
      property: 'name',
      prevValue: null,
      newValue: 'Truck 1',
      updatedBy: 'localUser',
      updatedAt: Date.now(),
    });
    const got = await db.elementHistory.get('e1:0');
    expect(got?.property).toBe('name');
  });
});
