import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import {
  seedDefinitions,
  DEFINITION_IDS,
  SEED_VERSION,
  SEED_KEY,
} from '../data/services/seedDefinitions';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';
import { configChildId } from '../kinds/configElements';

const libraryDefs = async () =>
  (await db.elements.toArray()).filter((e) => e.treeType === 'library' && e.parentId === null);

describe('seedDefinitions (config-as-Elements)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('writes 9 Definitions as library-tree Elements + version key on first call', async () => {
    await seedDefinitions();
    const defs = await libraryDefs();
    expect(defs).toHaveLength(9);
    expect(defs.map((d) => d.name).sort()).toEqual([
      'Description',
      'Linked Doc',
      'Logbook Policy',
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
    await seedDefinitions();
    const units = await db.elements.get(configChildId(DEFINITION_IDS.weight, 'unitsSymbol'));
    expect(units?.value).toBe('kg');
    expect(units?.treeType).toBe('library');
    expect(units?.parentId).toBe(DEFINITION_IDS.weight);

    const decimals = await db.elements.get(configChildId(DEFINITION_IDS.weight, 'decimals'));
    expect(decimals?.value).toBe(2);
  });

  it('listDefinitions assembles config back from the subtree', async () => {
    await seedDefinitions();
    const defs = (await new IDBAdapter().listDefinitions()).data;

    const weight = defs.find((d) => d.id === DEFINITION_IDS.weight);
    expect(weight?.kind).toBe('number-kv');
    expect(weight?.config).toMatchObject({ unitsSymbol: 'kg', decimals: 2 });

    const status = defs.find((d) => d.id === DEFINITION_IDS.status);
    expect(status?.config).toMatchObject({ options: ['In Service', 'Maintenance', 'Retired'] });
  });

  it('stamps appDeveloper authorship and active state on the assembled views', async () => {
    await seedDefinitions();
    const defs = (await new IDBAdapter().listDefinitions()).data;
    for (const d of defs) {
      expect(d.authorId).toBe(AUTHOR_ID_APP_DEVELOPER);
      expect(d.deletedAt).toBeNull();
    }
  });

  it('does not enqueue sync ops on the seed path', async () => {
    await seedDefinitions();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('is idempotent on second call', async () => {
    await seedDefinitions();
    const first = await libraryDefs();
    const firstTs = first[0].updatedAt;

    await seedDefinitions();
    const second = await libraryDefs();
    expect(second).toHaveLength(9);
    expect(second.find((d) => d.id === first[0].id)?.updatedAt).toBe(firstTs);
  });

  it('seeds all expected kinds', async () => {
    await seedDefinitions();
    const byId = new Map((await db.elements.toArray()).map((e) => [e.id, e]));
    expect(byId.get(DEFINITION_IDS.description)?.kind).toBe('text-kv');
    expect(byId.get(DEFINITION_IDS.status)?.kind).toBe('enum-kv');
    expect(byId.get(DEFINITION_IDS.weight)?.kind).toBe('number-kv');
    expect(byId.get(DEFINITION_IDS.powerRating)?.kind).toBe('number-kv');
    expect(byId.get(DEFINITION_IDS.mainImage)?.kind).toBe('single-image');
    expect(byId.get(DEFINITION_IDS.logbookPolicy)?.kind).toBe('logbook');
  });

  it('seeds the logbook policy Definition (the first re-root Definition) with its config subtree', async () => {
    await seedDefinitions();

    const entryLabel = await db.elements.get(configChildId(DEFINITION_IDS.logbookPolicy, 'entryLabel'));
    expect(entryLabel?.value).toBe('Entry');
    expect(entryLabel?.parentId).toBe(DEFINITION_IDS.logbookPolicy);
    expect(entryLabel?.treeType).toBe('library');

    const staleness = await db.elements.get(configChildId(DEFINITION_IDS.logbookPolicy, 'staleness'));
    expect(staleness?.value).toBe(7 * 24 * 60 * 60);

    const view = (await new IDBAdapter().getDefinition(DEFINITION_IDS.logbookPolicy)).data;
    expect(view?.kind).toBe('logbook');
    expect(view?.config).toMatchObject({ entryLabel: 'Entry', staleness: 604800 });
  });
});
