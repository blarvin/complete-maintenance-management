import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { seedTemplates, TEMPLATE_IDS } from '../data/services/seedTemplates';

describe('seedTemplates', () => {
  beforeEach(async () => {
    await db.templates.clear();
    await db.syncMetadata.clear();
  });

  it('writes all 6 templates + version key on first call', async () => {
    await seedTemplates();
    const all = await db.templates.toArray();
    expect(all).toHaveLength(6);
    const labels = all.map(t => t.label).sort();
    expect(labels).toEqual([
      'Description',
      'Main Image',
      'Status',
      'Tags',
      'Type Of',
      'Weight',
    ]);
    const meta = await db.syncMetadata.get('templatesSeededVersion');
    expect(meta?.value).toBe(1);
  });

  it('is idempotent on second call', async () => {
    await seedTemplates();
    const firstAll = await db.templates.toArray();
    const firstTimestamp = firstAll[0].updatedAt;

    // Second call should not rewrite rows.
    await seedTemplates();
    const secondAll = await db.templates.toArray();
    expect(secondAll).toHaveLength(6);
    expect(secondAll[0].updatedAt).toBe(firstTimestamp);
  });

  it('seeds all expected componentTypes', async () => {
    await seedTemplates();
    const byId = new Map((await db.templates.toArray()).map(t => [t.id, t]));
    expect(byId.get(TEMPLATE_IDS.description)?.componentType).toBe('text-kv');
    expect(byId.get(TEMPLATE_IDS.status)?.componentType).toBe('enum-kv');
    expect(byId.get(TEMPLATE_IDS.weight)?.componentType).toBe('measurement-kv');
    expect(byId.get(TEMPLATE_IDS.mainImage)?.componentType).toBe('single-image');
  });
});
