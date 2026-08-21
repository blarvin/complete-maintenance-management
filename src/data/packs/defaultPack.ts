/**
 * DEFAULT_PACK — the pack bundled into the app build.
 *
 * Authored as a TS module rather than JSON on purpose: `satisfies
 * FieldDefinitionPack` type-checks every `kind`/`config` pair against the real
 * unions at compile time, and the rows can reference `DEFINITION_IDS`. A JSON
 * import would widen everything to `string` and need a runtime validator —
 * that's the deferred pack-import work's job, not this alpha's.
 *
 * Ids are authored, never generated. Well-known ones (referenced from another
 * layer) live in `DEFINITION_IDS`; a pack-only row carries a plain literal.
 */

import { DEFINITION_IDS } from '../definitionIds';
import type { FieldDefinitionPack } from './types';

export const DEFAULT_PACK = {
    definitions: [
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
            // `::logbook` lens at mint (stamp-if-resolvable, provisionLenses.ts).
            id: DEFINITION_IDS.logbookPolicy,
            kind: 'logbook',
            label: 'Logbook Policy',
            config: { entryLabel: 'Entry', staleness: 7 * 24 * 60 * 60 },
        },
    ],

    /** The Definitions every new node is born with (SPEC → *Default DataFields at Node Creation*). */
    constructionDefaults: [DEFINITION_IDS.typeOf, DEFINITION_IDS.description, DEFINITION_IDS.tags],

    /** `jobs` binds none yet: re-root binding is optional, and jobs-without-a-policy proves it. */
    lensPolicies: { logbook: DEFINITION_IDS.logbookPolicy },

    /** Mirror of each lens manifest's `pickerLabel`; pinned by `defaultPack.test.ts`. */
    lensNames: { jobs: 'Jobs', logbook: 'Logbook' },
} satisfies FieldDefinitionPack;
