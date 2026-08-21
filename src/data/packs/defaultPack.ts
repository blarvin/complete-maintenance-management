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
 *
 * **The starter Library**: general industrial maintenance, simple manufacturing
 * and agricultural machinery — human maintenance, manual entry, no telemetry.
 * Only the kinds the app has today; dates are `text-kv` holding an ISO string
 * (SPEC defers `date-kv` to Phase 2+). Every row is an *offer*, not an
 * obligation: a node is born with three of them and picks up the rest by hand.
 */

import { DEFINITION_IDS } from '../definitionIds';
import type { FieldDefinitionPack } from './types';

export const DEFAULT_PACK = {
    definitions: [
        // ── Identity and description ──
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
            id: 'fd_location',
            kind: 'text-kv',
            label: 'Location',
            config: {},
        },
        {
            id: 'fd_serial_number',
            kind: 'text-kv',
            label: 'Serial Number',
            config: {},
        },
        {
            id: 'fd_part_number',
            kind: 'text-kv',
            label: 'Part Number',
            config: {},
        },
        {
            id: 'fd_manufacturer',
            kind: 'text-kv',
            label: 'Manufacturer',
            config: {},
        },
        {
            id: 'fd_model',
            kind: 'text-kv',
            label: 'Model',
            config: {},
        },
        {
            id: DEFINITION_IDS.status,
            kind: 'enum-kv',
            label: 'Status',
            config: { options: ['In Service', 'Maintenance', 'Retired'] },
        },
        {
            // ISO date in a text field — `date-kv` is Phase 2+ (SPEC).
            id: 'fd_installed_date',
            kind: 'text-kv',
            label: 'Installed Date',
            config: {},
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
            id: 'fd_note',
            kind: 'text-kv',
            label: 'Note',
            config: { multiline: true },
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

        // ── Maintenance and service ──
        {
            id: 'fd_hours_reading',
            kind: 'number-kv',
            label: 'Hours Reading',
            config: {
                unitsSymbol: 'h',
                unitsLongForm: 'hours',
                decimals: 1,
                affixPosition: 'suffix',
            },
        },
        {
            id: 'fd_last_service_date',
            kind: 'text-kv',
            label: 'Last Service Date',
            config: {},
        },
        {
            id: 'fd_service_interval',
            kind: 'number-kv',
            label: 'Service Interval',
            config: {
                unitsSymbol: 'h',
                unitsLongForm: 'hours',
                decimals: 0,
                affixPosition: 'suffix',
            },
        },
        {
            id: 'fd_criticality',
            kind: 'enum-kv',
            label: 'Criticality',
            config: { options: ['Critical', 'High', 'Medium', 'Low'] },
        },
        {
            id: 'fd_condition',
            kind: 'enum-kv',
            label: 'Condition',
            config: { options: ['Good', 'Fair', 'Poor', 'Out of Service'] },
        },
        {
            // Lockout points, PPE, whatever the person opening it needs first.
            id: 'fd_safety_notes',
            kind: 'text-kv',
            label: 'Safety Notes',
            config: { multiline: true },
        },
        {
            // Who to call for parts or service.
            id: 'fd_supplier',
            kind: 'text-kv',
            label: 'Supplier',
            config: {},
        },

        // ── Fluids, consumables and spares ──
        {
            id: 'fd_fuel_type',
            kind: 'enum-kv',
            label: 'Fuel Type',
            config: { options: ['Diesel', 'Gasoline', 'Electric', 'LPG'] },
        },
        {
            // e.g. "SAE 15W-40" — free text, because the grades are endless.
            id: 'fd_lubricant_type',
            kind: 'text-kv',
            label: 'Lubricant Type',
            config: {},
        },
        {
            id: 'fd_oil_capacity',
            kind: 'number-kv',
            label: 'Oil Capacity',
            config: {
                unitsSymbol: 'L',
                unitsLongForm: 'litres',
                decimals: 1,
                affixPosition: 'suffix',
            },
        },
        {
            id: 'fd_filter_part_number',
            kind: 'text-kv',
            label: 'Filter Part Number',
            config: {},
        },
        {
            // Where and how often — a list a person works down, not a reading.
            id: 'fd_grease_points',
            kind: 'text-kv',
            label: 'Grease Points',
            config: { multiline: true },
        },

        // ── Nameplate and operating values (manual gauge/nameplate reads) ──
        {
            id: 'fd_operating_pressure',
            kind: 'number-kv',
            label: 'Operating Pressure',
            config: {
                unitsSymbol: 'bar',
                unitsLongForm: 'bar',
                decimals: 1,
                affixPosition: 'suffix',
            },
        },
        {
            id: 'fd_tire_pressure',
            kind: 'number-kv',
            label: 'Tire Pressure',
            config: {
                unitsSymbol: 'psi',
                unitsLongForm: 'pounds per square inch',
                decimals: 0,
                affixPosition: 'suffix',
            },
        },
    ],

    /** The Definitions every new node is born with (SPEC → *Default DataFields at Node Creation*). */
    constructionDefaults: [DEFINITION_IDS.typeOf, DEFINITION_IDS.description, DEFINITION_IDS.tags],

    /** `jobs` binds none yet: re-root binding is optional, and jobs-without-a-policy proves it. */
    lensPolicies: { logbook: DEFINITION_IDS.logbookPolicy },

    /** Mirror of each lens manifest's `pickerLabel`; pinned by `defaultPack.test.ts`. */
    lensNames: { jobs: 'Jobs', logbook: 'Logbook' },
} satisfies FieldDefinitionPack;
