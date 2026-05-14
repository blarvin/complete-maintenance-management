/**
 * Dev-seeded FieldDefinition rows.
 *
 * Phase-1 starter set covering each Component (text-kv, enum-kv, number-kv,
 * single-image) plus the three default fields used at new-node construction
 * (Type Of, Description, Tags). Writes directly to db.fieldDefinitions (no
 * sync enqueue) — seeds are identical per-client, propagating them as sync
 * ops would create N writes per N clients with no gain.
 *
 * Idempotent via a syncMetadata version key. Bump SEED_VERSION to force a
 * reseed pass.
 */

import { db } from '../storage/db';
import type { FieldDefinition } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';

const SEED_VERSION = 5;
const SEED_KEY = 'fieldDefinitionsSeededVersion';

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
} as const;

type SeedRow = Omit<FieldDefinition, 'authorId' | 'updatedBy' | 'updatedAt' | 'deletedAt'>;

const SEEDS: SeedRow[] = [
  {
    id: FIELD_DEFINITION_IDS.description,
    componentType: 'text-kv',
    label: 'Description',
    config: { multiline: true },
  },
  {
    id: FIELD_DEFINITION_IDS.typeOf,
    componentType: 'text-kv',
    label: 'Type Of',
    config: { maxWords: 2 },
  },
  {
    id: FIELD_DEFINITION_IDS.tags,
    componentType: 'text-kv',
    label: 'Tags',
    config: {},
  },
  {
    id: FIELD_DEFINITION_IDS.status,
    componentType: 'enum-kv',
    label: 'Status',
    config: { options: ['In Service', 'Maintenance', 'Retired'] },
  },
  {
    id: FIELD_DEFINITION_IDS.weight,
    componentType: 'number-kv',
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
    componentType: 'number-kv',
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
    componentType: 'single-image',
    label: 'Main Image',
    config: { requireCaption: false },
  },
];

export async function seedFieldDefinitions(): Promise<void> {
  const meta = await db.syncMetadata.get(SEED_KEY);
  const storedVersion = typeof meta?.value === 'number' ? meta.value : 0;
  if (storedVersion >= SEED_VERSION) {
    return;
  }

  const timestamp = now();
  const userId = getCurrentUserId();

  // Upsert (not skip-if-exists): a SEED_VERSION bump is the signal that the
  // canonical seed config has changed and existing rows should be overwritten.
  // FieldDefinitions aren't user-edited yet, so this is safe; revisit when they
  // become editable.
  await db.transaction('rw', [db.fieldDefinitions, db.syncMetadata], async () => {
    for (const seed of SEEDS) {
      const row: FieldDefinition = {
        ...seed,
        authorId: AUTHOR_ID_APP_DEVELOPER,
        updatedBy: userId,
        updatedAt: timestamp,
        deletedAt: null,
      };
      await db.fieldDefinitions.put(row);
    }
    await db.syncMetadata.put({ key: SEED_KEY, value: SEED_VERSION });
  });

  console.log('[seedFieldDefinitions] Seeded version', SEED_VERSION);
}
