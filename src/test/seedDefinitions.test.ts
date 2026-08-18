import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import {
  seedDefinitions,
  DEFINITION_IDS,
  LIBRARY_ROOT_ID,
  SEED_VERSION,
  SEED_KEY,
} from '../data/services/seedDefinitions';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';
import { configChildId, DEFINED_KIND_KEY } from '../kinds/configElements';

/** A Definition is the row that points at itself — not the row with no parent,
 *  which is now the Library Node (SPEC → *What identifies a Definition*). */
const libraryDefs = async () =>
  (await db.elements.toArray()).filter((e) => e.treeType === 'library' && e.definitionId === e.id);

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

  it('writes the Library Node, pinned above the assets and parenting every Definition', async () => {
    await seedDefinitions();

    const root = await db.elements.get(LIBRARY_ROOT_ID);
    expect(root?.kind).toBe('node');
    expect(root?.name).toBe('Field Library');
    expect(root?.parentId).toBeNull();
    expect(root?.treeType).toBe('library');
    // The pin is the order, not a view-level special case: root elements sort by
    // `siblingOrder` and business roots start at 0.
    expect(root?.siblingOrder).toBe(-1);
    // The Library Node is not itself a Definition — it defines nothing.
    expect(root?.definitionId).toBeNull();

    for (const def of await libraryDefs()) {
      expect(def.parentId).toBe(LIBRARY_ROOT_ID);
    }
  });

  it('writes every Definition as a `node` whose defined kind is a config Field', async () => {
    await seedDefinitions();

    const weight = await db.elements.get(DEFINITION_IDS.weight);
    // The Element's own kind, so every Definition renders, sorts and navigates
    // alike (SPEC → *A FieldDefinition is a Node*).
    expect(weight?.kind).toBe('node');
    expect(weight?.definitionId).toBe(DEFINITION_IDS.weight);

    const definedKind = await db.elements.get(
      configChildId(DEFINITION_IDS.weight, DEFINED_KIND_KEY),
    );
    expect(definedKind?.value).toBe('number-kv');
    expect(definedKind?.name).toBe('Kind');
    expect(definedKind?.siblingOrder).toBe(0);
  });

  it('materializes unset knobs so the Library has a row to tap', async () => {
    await seedDefinitions();
    // Weight sets no `currencyCode`; the row still exists, carrying null.
    const currency = await db.elements.get(configChildId(DEFINITION_IDS.weight, 'currencyCode'));
    expect(currency).toBeDefined();
    expect(currency?.value).toBeNull();
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

  it('seeds all expected kinds — read off the assembled views, not the kind column', async () => {
    await seedDefinitions();
    const byId = new Map((await new IDBAdapter().listDefinitions()).data.map((d) => [d.id, d]));
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
