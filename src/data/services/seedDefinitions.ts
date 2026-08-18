/**
 * Dev-seeded Definitions, written as `library`-tree Elements
 * (config-as-Elements): the `Field Library` Node, then each seed as a Definition
 * Element parented to it plus its config sub-field child Elements (deterministic
 * `::cfg::` ids via `serializeConfig`).
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
import { DEFINITION_IDS, LIBRARY_ROOT_ID, LIBRARY_ROOT_NAME } from '../definitionIds';
import { devLog } from '../../utils/devMode';

// Stable ids live in ../definitionIds (import-free, so kind policies can read
// them); re-exported here for the existing consumers.
export { DEFINITION_IDS, LIBRARY_ROOT_ID } from '../definitionIds';

// Bumped for the Library-as-a-place shape: the Library Node, Definitions as its
// `kind: node` children, and the defined kind as a config Field.
export const SEED_VERSION = 9;
export const SEED_KEY = 'definitionsSeededVersion';

/**
 * `kind` here means the kind the seed **defines**, not the Element's own kind —
 * every Definition Element is a `node`. It flows into `serializeConfig`, which
 * writes it as the leading `::cfg::kind` child.
 */
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
    // The Library Node first — every Definition parents to it, so it has to exist
    // before them. `siblingOrder: -1` **is** the "pinned at the top of ROOT" rule:
    // the adapter already sorts roots by `siblingOrder` and business roots start
    // at 0, so no view sorts anything specially (SPEC → *The Library*).
    const libraryRoot: Element = {
      id: LIBRARY_ROOT_ID,
      kind: 'node',
      name: LIBRARY_ROOT_NAME,
      subtitle: null,
      value: null,
      parentId: null,
      siblingOrder: -1,
      definitionId: null,
      treeType: 'library',
      updatedBy: AUTHOR_ID_APP_DEVELOPER,
      updatedAt: timestamp,
      deletedAt: null,
    };
    await db.elements.put(libraryRoot);

    for (const seed of SEEDS) {
      const defElement: Element = {
        id: seed.id,
        // A Definition is a Node so that every Definition is alike; `seed.kind` is
        // the kind it *defines* and rides in the config subtree below.
        kind: 'node',
        name: seed.label,
        subtitle: null,
        value: null,
        parentId: LIBRARY_ROOT_ID,
        siblingOrder: 0,
        definitionId: seed.id,
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
