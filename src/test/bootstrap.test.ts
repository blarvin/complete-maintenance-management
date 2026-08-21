import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import {
  runBootstrap,
  runPopulation,
  bootstrapKey,
  BOOTSTRAP_POPULATIONS,
  LEGACY_SEED_KEY,
} from '../data/services/bootstrap';
import type { BootstrapPopulation, BootstrapRow } from '../data/services/bootstrap';
import type { UserId } from '../data/models';
import { AUTHOR_ID_APP_DEVELOPER } from '../constants';
import { configChildId } from '../kinds/configElements';
import { DEFINITION_IDS, LIBRARY_CHROME_IDS } from '../data/definitionIds';
import { isDefinitionRow } from '../data/libraryChrome';
import { packDefinitions } from '../data/packs/activePack';

const libraryDefs = async () => (await db.elements.toArray()).filter(isDefinitionRow);

/** A minimal business-tree row for the synthetic populations below. */
const testRow = (id: string, name: string): BootstrapRow => ({
  id,
  kind: 'node',
  name,
  subtitle: null,
  value: null,
  parentId: null,
  siblingOrder: 0,
  definitionId: null,
  treeType: 'business',
});

/** Put a stored row directly, bypassing the runner (the "already there" fixture). */
const storeRow = (row: BootstrapRow, updatedBy: UserId = AUTHOR_ID_APP_DEVELOPER) =>
  db.elements.put({ ...row, updatedBy, updatedAt: 1, deletedAt: null });

describe('bootstrap — populations', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('writes one revision key per population, under its own namespaced key', async () => {
    await runBootstrap();
    for (const population of BOOTSTRAP_POPULATIONS) {
      const meta = await db.syncMetadata.get(bootstrapKey(population.id));
      expect(meta?.value).toBe(population.revision);
    }
    expect(await db.syncMetadata.get(LEGACY_SEED_KEY)).toBeUndefined();
  });

  it('skips a population already at its stored revision', async () => {
    const population: BootstrapPopulation = {
      id: 'gate-pop',
      revision: 1,
      mode: 'upsert',
      rows: () => [testRow('g1', 'Only once')],
    };
    expect(await runPopulation(population)).toBe(1);
    expect(await runPopulation(population)).toBe(0);
  });

  it('upsert overwrites a row whose content changed between revisions', async () => {
    const at = (revision: number, name: string): BootstrapPopulation => ({
      id: 'upsert-pop',
      revision,
      mode: 'upsert',
      rows: () => [testRow('u1', name)],
    });

    await runPopulation(at(1, 'First'));
    expect((await db.elements.get('u1'))?.name).toBe('First');

    await runPopulation(at(2, 'Second'));
    expect((await db.elements.get('u1'))?.name).toBe('Second');
  });

  it('ensure fills the gaps and leaves an existing row untouched', async () => {
    await storeRow(testRow('e1', 'User edited'), 'localUser');

    const written = await runPopulation({
      id: 'ensure-pop',
      revision: 1,
      mode: 'ensure',
      rows: () => [testRow('e1', 'Pack name'), testRow('e2', 'Fresh')],
    });

    expect(written).toBe(1);
    expect((await db.elements.get('e1'))?.name).toBe('User edited');
    expect((await db.elements.get('e1'))?.updatedBy).toBe('localUser');
    expect((await db.elements.get('e2'))?.name).toBe('Fresh');
  });

  it('deletes retired ids on the pass, whatever the mode', async () => {
    await storeRow(testRow('r_old', 'Retired'));

    await runPopulation({
      id: 'prune-pop',
      revision: 1,
      mode: 'upsert',
      rows: () => [testRow('r1', 'Kept')],
      retiredIds: ['r_old'],
    });

    expect(await db.elements.get('r_old')).toBeUndefined();
    expect(await db.elements.get('r1')).toBeDefined();
  });

  it('prunes library_root, the retired chrome id, off a profile that still carries it', async () => {
    await storeRow({ ...testRow('library_root', 'Field Library'), treeType: 'library' });
    expect((await libraryDefs()).map((d) => d.id)).toContain('library_root');

    await runBootstrap();

    expect(await db.elements.get('library_root')).toBeUndefined();
    expect(await libraryDefs()).toHaveLength(packDefinitions().length);
  });

  it('drops the legacy shared key and runs both populations behind it', async () => {
    await db.syncMetadata.put({ key: LEGACY_SEED_KEY, value: 10 });

    await runBootstrap();

    expect(await db.syncMetadata.get(LEGACY_SEED_KEY)).toBeUndefined();
    expect((await db.syncMetadata.get(bootstrapKey('library-chrome')))?.value).toBe(1);
    expect(await libraryDefs()).toHaveLength(packDefinitions().length);
  });
});

describe('bootstrap — the Library populations (config-as-Elements)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  // Against the pack, not a copied list: which rows ship is the pack's business
  // (`defaultPack.test.ts` has the teeth for that), while the runner's job is
  // writing every one of them and nothing else.
  it('writes every pack Definition as a library-tree Element on first call', async () => {
    await runBootstrap();
    const defs = await libraryDefs();
    expect(defs).toHaveLength(packDefinitions().length);
    expect(defs.map((d) => d.name).sort()).toEqual(packDefinitions().map((r) => r.label).sort());
  });

  it('writes config as child sub-field Elements with deterministic ids', async () => {
    await runBootstrap();
    const units = await db.elements.get(configChildId(DEFINITION_IDS.weight, 'unitsSymbol'));
    expect(units?.value).toBe('kg');
    expect(units?.treeType).toBe('library');
    expect(units?.parentId).toBe(DEFINITION_IDS.weight);

    const decimals = await db.elements.get(configChildId(DEFINITION_IDS.weight, 'decimals'));
    expect(decimals?.value).toBe(2);
  });

  it('listDefinitions assembles config back from the subtree', async () => {
    await runBootstrap();
    const defs = (await new IDBAdapter().listDefinitions()).data;

    const weight = defs.find((d) => d.id === DEFINITION_IDS.weight);
    expect(weight?.kind).toBe('number-kv');
    expect(weight?.config).toMatchObject({ unitsSymbol: 'kg', decimals: 2 });

    const status = defs.find((d) => d.id === DEFINITION_IDS.status);
    expect(status?.config).toMatchObject({ options: ['In Service', 'Maintenance', 'Retired'] });
  });

  it('stamps appDeveloper authorship and active state on the assembled views', async () => {
    await runBootstrap();
    const defs = (await new IDBAdapter().listDefinitions()).data;
    for (const d of defs) {
      expect(d.authorId).toBe(AUTHOR_ID_APP_DEVELOPER);
      expect(d.deletedAt).toBeNull();
    }
  });

  it('does not enqueue sync ops on the bootstrap path', async () => {
    await runBootstrap();
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('is idempotent on second call', async () => {
    await runBootstrap();
    const first = await libraryDefs();
    const firstTs = first[0].updatedAt;

    await runBootstrap();
    const second = await libraryDefs();
    expect(second).toHaveLength(packDefinitions().length);
    expect(second.find((d) => d.id === first[0].id)?.updatedAt).toBe(firstTs);
  });

  it('seeds all expected kinds', async () => {
    await runBootstrap();
    const byId = new Map((await db.elements.toArray()).map((e) => [e.id, e]));
    expect(byId.get(DEFINITION_IDS.description)?.kind).toBe('text-kv');
    expect(byId.get(DEFINITION_IDS.status)?.kind).toBe('enum-kv');
    expect(byId.get(DEFINITION_IDS.weight)?.kind).toBe('number-kv');
    expect(byId.get(DEFINITION_IDS.powerRating)?.kind).toBe('number-kv');
    expect(byId.get(DEFINITION_IDS.mainImage)?.kind).toBe('single-image');
    expect(byId.get(DEFINITION_IDS.logbookPolicy)?.kind).toBe('logbook');
  });

  it('seeds the three Library chrome rows with pinned order and zero sync ops', async () => {
    await runBootstrap();
    const byId = new Map((await db.elements.toArray()).map((e) => [e.id, e]));

    const root = byId.get(LIBRARY_CHROME_IDS.root);
    expect(root?.kind).toBe('library');
    expect(root?.parentId).toBeNull();
    expect(root?.siblingOrder).toBe(-1);
    expect(root?.treeType).toBe('library');

    const defsLens = byId.get(LIBRARY_CHROME_IDS.definitions);
    expect(defsLens?.kind).toBe('definitions');
    expect(defsLens?.parentId).toBe(LIBRARY_CHROME_IDS.root);
    expect(defsLens?.siblingOrder).toBe(0);

    const kindsLens = byId.get(LIBRARY_CHROME_IDS.kinds);
    expect(kindsLens?.kind).toBe('kinds');
    expect(kindsLens?.parentId).toBe(LIBRARY_CHROME_IDS.root);
    expect(kindsLens?.siblingOrder).toBe(1);

    expect(await db.syncQueue.count()).toBe(0);
  });

  it('listRootElements pins the Library root first; lenses and Definitions stay out', async () => {
    await runBootstrap();
    const adapter = new IDBAdapter();
    await adapter.createElement({ id: 'n1', kind: 'node', parentId: null, name: 'Asset' });

    const roots = (await adapter.listRootElements()).data;
    expect(roots[0].id).toBe(LIBRARY_CHROME_IDS.root);
    expect(roots.map((r) => r.id)).toContain('n1');
    expect(roots.map((r) => r.id)).not.toContain(LIBRARY_CHROME_IDS.definitions);
    expect(roots.map((r) => r.id)).not.toContain(DEFINITION_IDS.description);
  });

  it('seeds the logbook policy Definition (the first re-root Definition) with its config subtree', async () => {
    await runBootstrap();

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
