/**
 * Definition seeding — the active pack's Definitions written as `library`-tree
 * Elements (config-as-Elements): each row becomes a Definition Element plus its
 * config sub-field child Elements (deterministic `::cfg::` ids via
 * `serializeConfig`).
 *
 * The rows themselves are **not** authored here any more — they are pack data
 * (`src/data/packs/`), read through `packDefinitions()`. This module owns the
 * writing: idempotence, the transaction, the audit stamping. Writes directly to
 * `db.elements` (no sync enqueue, no history) — the pack is identical per-client
 * and its ids are deterministic, so propagating seeds as sync ops would create N
 * writes per N clients with no gain.
 *
 * The Library chrome rows below stay in code: chrome is app structure, not pack
 * content — a pack that could remove the Library root could brick the app.
 *
 * Idempotent via a syncMetadata version key. Bump SEED_VERSION to force a
 * reseed pass.
 */

import { db } from '../storage/db';
import type { Element } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { now } from '../../utils/time';
import { serializeConfig } from '../../kinds/configElements';
import { LIBRARY_CHROME_IDS } from '../definitionIds';
import { packDefinitions } from '../packs/activePack';
import { devLog } from '../../utils/devMode';

// Stable ids live in ../definitionIds (import-free, so kind policies can read
// them); re-exported here for the existing consumers.
export { DEFINITION_IDS } from '../definitionIds';

// Bumped for the re-authored starter set (the bundled Definition pack, 30 rows).
export const SEED_VERSION = 10;
export const SEED_KEY = 'definitionsSeededVersion';

/**
 * The three Library chrome Elements (Library-As-Lens-Tree): the pinned `library`
 * root (siblingOrder −1, so it sorts above every business root) and its two
 * index-lens children. Seeded alongside the Definitions — same transaction, no
 * sync enqueue, no history — but with explicit parentage/order, which the pack
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
    for (const seed of packDefinitions()) {
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
