import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { seedFieldDefinitions, FIELD_DEFINITION_IDS } from '../data/services/seedFieldDefinitions';

describe('seedFieldDefinitions', () => {
  beforeEach(async () => {
    await db.fieldDefinitions.clear();
    await db.syncMetadata.clear();
  });

  it('writes all 6 field definitions + version key on first call', async () => {
    await seedFieldDefinitions();
    const all = await db.fieldDefinitions.toArray();
    expect(all).toHaveLength(6);
    const labels = all.map(d => d.label).sort();
    expect(labels).toEqual([
      'Description',
      'Main Image',
      'Status',
      'Tags',
      'Type Of',
      'Weight',
    ]);
    const meta = await db.syncMetadata.get('fieldDefinitionsSeededVersion');
    expect(meta?.value).toBe(3);
  });

  it('is idempotent on second call', async () => {
    await seedFieldDefinitions();
    const firstAll = await db.fieldDefinitions.toArray();
    const firstTimestamp = firstAll[0].updatedAt;

    // Second call should not rewrite rows.
    await seedFieldDefinitions();
    const secondAll = await db.fieldDefinitions.toArray();
    expect(secondAll).toHaveLength(6);
    expect(secondAll[0].updatedAt).toBe(firstTimestamp);
  });

  it('seeds all expected componentTypes', async () => {
    await seedFieldDefinitions();
    const byId = new Map((await db.fieldDefinitions.toArray()).map(d => [d.id, d]));
    expect(byId.get(FIELD_DEFINITION_IDS.description)?.componentType).toBe('text-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.status)?.componentType).toBe('enum-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.weight)?.componentType).toBe('measurement-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.mainImage)?.componentType).toBe('single-image');
  });
});
