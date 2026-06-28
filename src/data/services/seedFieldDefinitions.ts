/**
 * Dev-seeded FieldDefinitions, written as `library`-tree Elements
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
import type { Element, FieldDefinitionConfig, Kind } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { now } from '../../utils/time';
import { serializeConfig } from '../../kinds/configElements';

// Bumped for the asset-doc seed (#6b minimal kind set).
export const SEED_VERSION = 7;
export const SEED_KEY = 'fieldDefinitionsSeededVersion';

/**
 * Stable FieldDefinition IDs. Use these constants wherever UI code references a
 * specific default FieldDefinition (e.g. the three fields auto-added on node creation).
 */
export const FIELD_DEFINITION_IDS = {
  description: 'fd_description',
  typeOf: 'fd_type_of',
  tags: 'fd_tags',
  status: 'fd_status',
  weight: 'fd_weight',
  powerRating: 'fd_power_rating',
  mainImage: 'fd_main_image',
  assetDoc: 'fd_asset_doc',
} as const;

type SeedRow = { id: string; kind: Kind; label: string; config: FieldDefinitionConfig };

const SEEDS: SeedRow[] = [
  {
    id: FIELD_DEFINITION_IDS.description,
    kind: 'text-kv',
    label: 'Description',
    config: { multiline: true },
  },
  {
    id: FIELD_DEFINITION_IDS.typeOf,
    kind: 'text-kv',
    label: 'Type Of',
    config: { maxWords: 2 },
  },
  {
    id: FIELD_DEFINITION_IDS.tags,
    kind: 'text-kv',
    label: 'Tags',
    config: {},
  },
  {
    id: FIELD_DEFINITION_IDS.status,
    kind: 'enum-kv',
    label: 'Status',
    config: { options: ['In Service', 'Maintenance', 'Retired'] },
  },
  {
    id: FIELD_DEFINITION_IDS.weight,
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
    id: FIELD_DEFINITION_IDS.powerRating,
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
    id: FIELD_DEFINITION_IDS.mainImage,
    kind: 'single-image',
    label: 'Main Image',
    config: { requireCaption: false },
  },
  {
    id: FIELD_DEFINITION_IDS.assetDoc,
    kind: 'asset-doc',
    label: 'Linked Doc',
    config: {},
  },
];

export async function seedFieldDefinitions(): Promise<void> {
  const meta = await db.syncMetadata.get(SEED_KEY);
  const storedVersion = typeof meta?.value === 'number' ? meta.value : 0;
  if (storedVersion >= SEED_VERSION) {
    return;
  }

  const timestamp = now();

  // Upsert (not skip-if-exists): a SEED_VERSION bump is the signal that the
  // canonical seed config has changed and existing rows should be overwritten.
  // FieldDefinitions aren't user-edited yet, so this is safe; revisit when they
  // become editable. `updatedBy` carries the app-developer provenance (the old
  // separate `authorId` column folds into it).
  await db.transaction('rw', [db.elements, db.syncMetadata], async () => {
    for (const seed of SEEDS) {
      const defElement: Element = {
        id: seed.id,
        kind: seed.kind,
        name: seed.label,
        subtitle: null,
        value: null,
        parentId: null,
        siblingOrder: 0,
        fieldDefinitionId: null,
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

  console.log('[seedFieldDefinitions] Seeded version', SEED_VERSION, 'as library Elements');
}
