import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { seedFieldDefinitions, FIELD_DEFINITION_IDS } from '../data/services/seedFieldDefinitions';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';

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
    expect(meta?.value).toBe(4);
  });

  it('stamps appDeveloper authorship and active soft-delete state on seeds', async () => {
    await seedFieldDefinitions();
    const all = await db.fieldDefinitions.toArray();
    for (const row of all) {
      expect(row.authorId).toBe(AUTHOR_ID_APP_DEVELOPER);
      expect(row.deletedAt).toBeNull();
    }
  });

  it('does not enqueue sync ops on the seed path', async () => {
    await db.syncQueue.clear();
    await seedFieldDefinitions();
    const queueLen = await db.syncQueue.count();
    expect(queueLen).toBe(0);
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
