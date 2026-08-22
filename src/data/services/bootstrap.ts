/**
 * Bootstrap — the rows the app writes for itself at boot, one named
 * **population** at a time.
 *
 * A population is a batch of app-owned Elements with its own revision number and
 * its own write mode. There are two today: the Library chrome trio (app
 * structure, authored in code) and the active pack's Definitions (pack data,
 * read through `packDefinitions()`). They used to share one `SEED_VERSION` key,
 * which meant re-authoring the pack also re-wrote the chrome, and a third
 * population could not join without dragging the other two along.
 *
 * Writes go straight to `db.elements` — no sync enqueue, no history. Legitimate
 * only because these rows are byte-identical per client and their ids are
 * deterministic: propagating them as sync ops would be N writes per N clients
 * with no gain. A population whose rows are *not* identical per client (a user
 * import) is authoring and must go through the command bus instead.
 *
 * **`mode`** is the half of this that is not yet exercised:
 * - `upsert` — a re-run overwrites the row. Right for rows nobody edits, which
 *   is every population today.
 * - `ensure` — put-if-absent; a re-run only fills gaps. Required the day a
 *   seeded tree is user-editable (the config trees the Users branch will bring),
 *   because overwriting one would contradict forked-never-mutated (SPEC §611).
 *   Built now so that branch does not have to reopen the runner.
 *
 * `retiredIds` is the other half of owning a population: an id the population
 * used to ship is deleted on the pass that retires it. Without it an upsert-only
 * seeder leaves a renamed row behind forever (that is how `library_root`
 * outlived the rename to `lib_root`).
 */

import { db } from '../storage/db';
import type { Element } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { now } from '../../utils/time';
import { serializeConfig } from '../../kinds/configElements';
import { LIBRARY_CHROME_IDS } from '../definitionIds';
import { packDefinitions } from '../packs/activePack';
import { devLog } from '../../utils/devMode';

/** One row a population writes, minus the audit columns the runner stamps. */
export type BootstrapRow = Omit<Element, 'updatedBy' | 'updatedAt' | 'deletedAt'>;

/** How a re-run treats a row that already exists. See the module docblock. */
export type BootstrapMode = 'upsert' | 'ensure';

export type BootstrapPopulation = {
    /** Stable name; half of this population's syncMetadata key. */
    id: string;
    /** Per-population revision, fresh namespace, starts at 1. Bump to re-run. */
    revision: number;
    mode: BootstrapMode;
    /** A function, not an array: pack resolution must stay lazy (no work at import time). */
    rows: () => BootstrapRow[];
    /** Ids this population used to ship. Deleted on the pass, whatever the mode. */
    retiredIds?: readonly string[];
};

/** syncMetadata key holding the last revision written for one population. */
export const bootstrapKey = (populationId: string): string => `seeded:${populationId}`;

/**
 * The single pre-namespace key both populations shared. Deleted on the first
 * `runBootstrap()` that finds it; the new keys are absent on such a profile, so
 * both populations then run their first pass. That double-write is harmless
 * (upsert, byte-identical rows) and is exactly what carries the retired-id prune
 * to profiles that predate it.
 */
export const LEGACY_SEED_KEY = 'definitionsSeededVersion';

/**
 * The three Library chrome Elements (Library-As-Lens-Tree): the pinned `library`
 * root (siblingOrder −1, so it sorts above every business root) and its two
 * index-lens children.
 *
 * Authored here rather than in the pack on purpose: chrome is app structure, not
 * pack content — a pack that could remove the Library root could brick the app.
 */
const CHROME_SEEDS: Array<Pick<Element, 'id' | 'kind' | 'name' | 'parentId' | 'siblingOrder'>> = [
    { id: LIBRARY_CHROME_IDS.root, kind: 'library', name: 'Field Library', parentId: null, siblingOrder: -1 },
    { id: LIBRARY_CHROME_IDS.definitions, kind: 'definitions', name: 'Field Definitions', parentId: LIBRARY_CHROME_IDS.root, siblingOrder: 0 },
    { id: LIBRARY_CHROME_IDS.kinds, kind: 'kinds', name: 'Kinds', parentId: LIBRARY_CHROME_IDS.root, siblingOrder: 1 },
];

const chromeRows = (): BootstrapRow[] =>
    CHROME_SEEDS.map((chrome) => ({
        ...chrome,
        subtitle: null,
        value: null,
        definitionId: null,
        treeType: 'library' as const,
    }));

/**
 * Each pack Definition as a `library`-tree Element plus its config sub-field
 * children (deterministic `::cfg::` ids via `serializeConfig`). Parentage is
 * hardcoded — a Definition is a library root row by definition (`isDefinitionRow`).
 */
const definitionRows = (): BootstrapRow[] => {
    const rows: BootstrapRow[] = [];
    for (const seed of packDefinitions()) {
        rows.push({
            id: seed.id,
            kind: seed.kind,
            name: seed.label,
            subtitle: null,
            value: null,
            parentId: null,
            siblingOrder: 0,
            definitionId: null,
            treeType: 'library',
        });
        rows.push(...serializeConfig(seed.id, seed.kind, seed.config));
    }
    return rows;
};

/** Every population the app bootstraps, in write order. */
export const BOOTSTRAP_POPULATIONS: readonly BootstrapPopulation[] = [
    {
        id: 'library-chrome',
        revision: 1,
        mode: 'upsert',
        rows: chromeRows,
        // The pre-`lib_root` chrome row. It still passes `isDefinitionRow`, so on
        // a profile that predates the rename it lists as a 31st Definition.
        retiredIds: ['library_root'],
    },
    {
        id: 'library-definitions',
        revision: 1,
        mode: 'upsert',
        rows: definitionRows,
    },
];

/**
 * Write one population if its stored revision is behind. Returns how many rows
 * it wrote (0 = already at revision, or `ensure` found everything present).
 *
 * Rows, prune and the revision key land in one `rw` transaction, so a population
 * is never recorded as written without its rows.
 */
export async function runPopulation(population: BootstrapPopulation): Promise<number> {
    const key = bootstrapKey(population.id);
    const meta = await db.syncMetadata.get(key);
    const storedRevision = typeof meta?.value === 'number' ? meta.value : 0;
    if (storedRevision >= population.revision) return 0;

    const timestamp = now();
    const rows = population.rows();
    let written = 0;

    await db.transaction('rw', [db.elements, db.syncMetadata], async () => {
        for (const row of rows) {
            if (population.mode === 'ensure' && (await db.elements.get(row.id))) continue;
            await db.elements.put({
                ...row,
                // The app-developer provenance every bootstrapped row carries.
                updatedBy: AUTHOR_ID_APP_DEVELOPER,
                updatedAt: timestamp,
                deletedAt: null,
            });
            written += 1;
        }
        if (population.retiredIds?.length) {
            await db.elements.bulkDelete([...population.retiredIds]);
        }
        await db.syncMetadata.put({ key, value: population.revision });
    });

    devLog('[bootstrap]', population.id, 'revision', population.revision, '—', written, 'row(s)', population.mode);
    return written;
}

/**
 * Run every population. Idempotent: a steady-state boot reads one syncMetadata
 * key per population and writes nothing.
 */
export async function runBootstrap(): Promise<void> {
    const legacy = await db.syncMetadata.get(LEGACY_SEED_KEY);
    if (legacy) {
        await db.syncMetadata.delete(LEGACY_SEED_KEY);
        devLog('[bootstrap] Dropped legacy key', LEGACY_SEED_KEY, '— populations re-run once');
    }

    for (const population of BOOTSTRAP_POPULATIONS) {
        await runPopulation(population);
    }
}
