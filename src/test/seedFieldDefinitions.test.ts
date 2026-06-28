import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import {
  seedFieldDefinitions,
  FIELD_DEFINITION_IDS,
  SEED_VERSION,
  SEED_KEY,
} from '../data/services/seedFieldDefinitions';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';
import { configChildId } from '../kinds/configElements';

const libraryDefs = async () =>
  (await db.elements.toArray()).filter((e) => e.treeType === 'library' && e.parentId === null);

describe('seedFieldDefinitions (config-as-Elements)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('writes 8 Definitions as library-tree Elements + version key on first call', async () => {
    await seedFieldDefinitions();
    const defs = await libraryDefs();
    expect(defs).toHaveLength(8);
    expect(defs.map((d) => d.name).sort()).toEqual([
      'Description',
      'Linked Doc',
      'Main Image',
      'Power Rating',
      'Status',
      'Tags',
      'Type Of',
      'Weight',
    ]);
    const meta = await db.syncMetadata.get(SEED_KEY);
    expect(meta?.value).toBe(SEED_VERSION);
  });

  it('writes config as child sub-field Elements with deterministic ids', async () => {
    await seedFieldDefinitions();
    const units = await db.elements.get(configChildId(FIELD_DEFINITION_IDS.weight, 'unitsSymbol'));
    expect(units?.value).toBe('kg');
    expect(units?.treeType).toBe('library');
    expect(units?.parentId).toBe(FIELD_DEFINITION_IDS.weight);

    const decimals = await db.elements.get(configChildId(FIELD_DEFINITION_IDS.weight, 'decimals'));
    expect(decimals?.value).toBe(2);
  });

  it('listFieldDefinitions assembles config back from the subtree', async () => {
    await seedFieldDefinitions();
    const defs = (await new IDBAdapter().listFieldDefinitions()).data;

    const weight = defs.find((d) => d.id === FIELD_DEFINITION_IDS.weight);
    expect(weight?.kind).toBe('number-kv');
    expect(weight?.config).toMatchObject({ unitsSymbol: 'kg', decimals: 2 });

    const status = defs.find((d) => d.id === FIELD_DEFINITION_IDS.status);
    expect(status?.config).toMatchObject({ options: ['In Service', 'Maintenance', 'Retired'] });
  });

  it('stamps appDeveloper authorship and active state on the assembled views', async () => {
    await seedFieldDefinitions();
    const defs = (await new IDBAdapter().listFieldDefinitions()).data;
    for (const d of defs) {
      expect(d.authorId).toBe(AUTHOR_ID_APP_DEVELOPER);
      expect(d.deletedAt).toBeNull();
    }
  });

  it('does not enqueue sync ops on the seed path', async () => {
    await seedFieldDefinitions();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('is idempotent on second call', async () => {
    await seedFieldDefinitions();
    const first = await libraryDefs();
    const firstTs = first[0].updatedAt;

    await seedFieldDefinitions();
    const second = await libraryDefs();
    expect(second).toHaveLength(8);
    expect(second.find((d) => d.id === first[0].id)?.updatedAt).toBe(firstTs);
  });

  it('seeds all expected kinds', async () => {
    await seedFieldDefinitions();
    const byId = new Map((await db.elements.toArray()).map((e) => [e.id, e]));
    expect(byId.get(FIELD_DEFINITION_IDS.description)?.kind).toBe('text-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.status)?.kind).toBe('enum-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.weight)?.kind).toBe('number-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.powerRating)?.kind).toBe('number-kv');
    expect(byId.get(FIELD_DEFINITION_IDS.mainImage)?.kind).toBe('single-image');
  });
});
