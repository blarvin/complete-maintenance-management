/**
 * Dev-seeded DataFieldTemplate rows.
 *
 * Six samples: one per Phase-1 Component plus the three default fields used at
 * new-node construction (Type Of, Description, Tags). Writes directly to
 * db.templates (no sync enqueue) because seeds are identical per-client —
 * propagating them as sync ops would create N writes per N clients with no gain.
 *
 * Idempotent via a syncMetadata version key. Bump SEED_VERSION to force a reseed
 * pass (existing rows won't be re-created; only missing ones will be added).
 */

import { db } from '../storage/db';
import type { DataFieldTemplate } from '../models';
import { getCurrentUserId } from '../../context/userContext';
import { now } from '../../utils/time';

const SEED_VERSION = 1;
const SEED_KEY = 'templatesSeededVersion';

/**
 * Stable Template IDs. Use these constants wherever UI code references a
 * specific default Template (e.g. the three fields auto-added on node creation).
 */
export const TEMPLATE_IDS = {
  description: 'tpl_description',
  typeOf: 'tpl_type_of',
  tags: 'tpl_tags',
  status: 'tpl_status',
  weight: 'tpl_weight',
  mainImage: 'tpl_main_image',
} as const;

type SeedRow = Omit<DataFieldTemplate, 'updatedBy' | 'updatedAt'>;

const SEEDS: SeedRow[] = [
  {
    id: TEMPLATE_IDS.description,
    componentType: 'text-kv',
    label: 'Description',
    config: { multiline: true },
  },
  {
    id: TEMPLATE_IDS.typeOf,
    componentType: 'text-kv',
    label: 'Type Of',
    config: {},
  },
  {
    id: TEMPLATE_IDS.tags,
    componentType: 'text-kv',
    label: 'Tags',
    config: {},
  },
  {
    id: TEMPLATE_IDS.status,
    componentType: 'enum-kv',
    label: 'Status',
    config: { options: ['In Service', 'Maintenance', 'Retired'] },
  },
  {
    id: TEMPLATE_IDS.weight,
    componentType: 'measurement-kv',
    label: 'Weight',
    config: { units: 'kg', decimals: 2 },
  },
  {
    id: TEMPLATE_IDS.mainImage,
    componentType: 'single-image',
    label: 'Main Image',
    config: { requireCaption: false },
  },
];

export async function seedTemplates(): Promise<void> {
  const meta = await db.syncMetadata.get(SEED_KEY);
  const storedVersion = typeof meta?.value === 'number' ? meta.value : 0;
  if (storedVersion >= SEED_VERSION) {
    return;
  }

  const timestamp = now();
  const userId = getCurrentUserId();

  await db.transaction('rw', [db.templates, db.syncMetadata], async () => {
    for (const seed of SEEDS) {
      const existing = await db.templates.get(seed.id);
      if (existing) continue;
      const row: DataFieldTemplate = {
        ...seed,
        updatedBy: userId,
        updatedAt: timestamp,
      };
      await db.templates.put(row);
    }
    await db.syncMetadata.put({ key: SEED_KEY, value: SEED_VERSION });
  });

  console.log('[seedTemplates] Seeded version', SEED_VERSION);
}
