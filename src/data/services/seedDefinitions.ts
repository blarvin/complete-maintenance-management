/**
 * Dev-seeded Definitions, written as `library`-tree Elements
 * (config-as-Elements): each seed is a Definition Element plus its config
 * sub-field child Elements (deterministic `::cfg::` ids via `serializeConfig`).
 *
 * Phase-1 starter set covering each Component (text-kv, enum-kv, number-kv,
 * single-image) plus the three default fields used at new-node construction
 * (Type Of, Description, Tags). Writes directly to `db.elements` (no sync
 * enqueue, no history) — seeds are identical per-client (deterministic ids), so
 * propagating them as sync ops would create N writes per N clients with no gain.
 *
 * Idempotent via a syncMetadata version key. Bump SEED_VERSION to force a
 * reseed pass.
 */

import { db } from '../storage/db';
import type { Element, DefinitionConfig, Kind } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { now } from '../../utils/time';
import { serializeConfig } from '../../kinds/configElements';
import { DEFINITION_IDS, LIBRARY_CHROME_IDS } from '../definitionIds';
import { devLog } from '../../utils/devMode';

// Stable ids live in ../definitionIds (import-free, so kind policies can read
// them); re-exported here for the existing consumers.
export { DEFINITION_IDS } from '../definitionIds';

// Bumped for the Library chrome rows (Library-As-Lens-Tree).
export const SEED_VERSION = 9;
export const SEED_KEY = 'definitionsSeededVersion';

type SeedRow = { id: string; kind: Kind; label: string; config: DefinitionConfig };

const SEEDS: SeedRow[] = [
  {
    id: DEFINITION_IDS.description,
    kind: 'text-kv',
    label: 'Description',
    config: { multiline: true },
  },
  {
    id: DEFINITION_IDS.typeOf,
    kind: 'text-kv',
    label: 'Type Of',
    config: { maxWords: 2 },
  },
  {
    id: DEFINITION_IDS.tags,
    kind: 'text-kv',
    label: 'Tags',
    config: {},
  },
  {
    id: DEFINITION_IDS.status,
    kind: 'enum-kv',
    label: 'Status',
    config: { options: ['In Service', 'Maintenance', 'Retired'] },
  },
  {
    id: DEFINITION_IDS.weight,
    kind: 'number-kv',
    label: 'Weight',
    config: {
      unitsSymbol: 'kg',
      unitsLongForm: 'kilograms',
      decimals: 2,
      affixPosition: 'suffix',
    },
  },
  {
    id: DEFINITION_IDS.powerRating,
    kind: 'number-kv',
    label: 'Power Rating',
    config: {
      unitsSymbol: 'W',
      unitsLongForm: 'Watts',
      decimals: 1,
      affixPosition: 'suffix',
    },
  },
  {
    id: DEFINITION_IDS.mainImage,
    kind: 'single-image',
    label: 'Main Image',
    config: { requireCaption: false },
  },
  {
    id: DEFINITION_IDS.internalLink,
    kind: 'internal-link',
    // The domain word lives here, on the Definition — not in the kind.
    label: 'Linked Doc',
    config: {},
  },
  {
    // The first re-root policy Definition — bound onto every provisioned
    // `::logbook` lens at mint (stamp-if-resolvable, handlers.ts).
    id: DEFINITION_IDS.logbookPolicy,
    kind: 'logbook',
    label: 'Logbook Policy',
    config: { entryLabel: 'Entry', staleness: 7 * 24 * 60 * 60 },
  },
];

/**
 * The three Library chrome Elements (Library-As-Lens-Tree): the pinned `library`
 * root (siblingOrder −1, so it sorts above every business root) and its two
 * index-lens children. Seeded alongside the Definitions — same transaction, no
 * sync enqueue, no history — but with explicit parentage/order, which the SEEDS
 * loop hardcodes away.
 */
const CHROME_SEEDS: Array<Pick<Element, 'id' | 'kind' | 'name' | 'parentId' | 'siblingOrder'>> = [
  { id: LIBRARY_CHROME_IDS.root, kind: 'library', name: 'Field Library', parentId: null, siblingOrder: -1 },
  { id: LIBRARY_CHROME_IDS.definitions, kind: 'definitions', name: 'Field Definitions', parentId: LIBRARY_CHROME_IDS.root, siblingOrder: 0 },
  { id: LIBRARY_CHROME_IDS.kinds, kind: 'kinds', name: 'Kinds', parentId: LIBRARY_CHROME_IDS.root, siblingOrder: 1 },
];

export async function seedDefinitions(): Promise<void> {
  const meta = await db.syncMetadata.get(SEED_KEY);
  const storedVersion = typeof meta?.value === 'number' ? meta.value : 0;
  if (storedVersion >= SEED_VERSION) {
    return;
  }

  const timestamp = now();

  // Upsert (not skip-if-exists): a SEED_VERSION bump is the signal that the
  // canonical seed config has changed and existing rows should be overwritten.
  // Definitions aren't user-edited yet, so this is safe; revisit when they
  // become editable. `updatedBy` carries the app-developer provenance (the old
  // separate `authorId` column folds into it).
  await db.transaction('rw', [db.elements, db.syncMetadata], async () => {
    for (const chrome of CHROME_SEEDS) {
      await db.elements.put({
        ...chrome,
        subtitle: null,
        value: null,
        definitionId: null,
        treeType: 'library',
        updatedBy: AUTHOR_ID_APP_DEVELOPER,
        updatedAt: timestamp,
        deletedAt: null,
      });
    }
    for (const seed of SEEDS) {
      const defElement: Element = {
        id: seed.id,
        kind: seed.kind,
        name: seed.label,
        subtitle: null,
        value: null,
        parentId: null,
        siblingOrder: 0,
        definitionId: null,
        treeType: 'library',
        updatedBy: AUTHOR_ID_APP_DEVELOPER,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await db.elements.put(defElement);

      for (const child of serializeConfig(seed.id, seed.kind, seed.config)) {
        await db.elements.put({
          ...child,
          updatedBy: AUTHOR_ID_APP_DEVELOPER,
          updatedAt: timestamp,
          deletedAt: null,
        });
      }
    }
    await db.syncMetadata.put({ key: SEED_KEY, value: SEED_VERSION });
  });

  devLog('[seedDefinitions] Seeded version', SEED_VERSION, 'as library Elements');
}
