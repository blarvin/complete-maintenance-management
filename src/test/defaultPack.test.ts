/**
 * defaultPack — semantic teeth for the bundled pack, the half `satisfies
 * FieldDefinitionPack` cannot check. The type system pins each row's `kind`/
 * `config` pair; these assert what the shipped *data* has to be true about
 * itself: ids and labels distinct, per-kind config actually usable, and every
 * binding pointing at a row that exists.
 *
 * The `lensNames` case also replaces the registry's old import-time pickerLabel
 * check (deleted with this seam — its premise died when the names became pack
 * data). A test may not import `registry.ts`/`*.manifest.ts` (no Solid JSX
 * transform in Vitest, `.claude/rules/testing-conventions.md`), so the mirror is
 * pinned here as literals against the manifest values instead.
 */

import { describe, it, expect } from 'vitest';
import type { EnumKvConfig, Kind, NumberKvConfig } from '../data/models';
import type { CapabilitySet } from '../kinds/types';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { DEFAULT_PACK } from '../data/packs/defaultPack';
import { constructionDefaults, lensNameFor, lensPolicyFor, packDefinitions } from '../data/packs/activePack';
import { DEFINITION_IDS } from '../data/definitionIds';

const rows = packDefinitions();
const ids = new Set(rows.map((r) => r.id));
const capsOf = (k: Kind): CapabilitySet => KIND_CAPABILITIES[k];

describe('the bundled Definition pack', () => {
    it('ships rows with unique, non-empty ids and labels', () => {
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(row.id.trim().length).toBeGreaterThan(0);
            expect(row.label.trim().length).toBeGreaterThan(0);
        }
        expect(ids.size).toBe(rows.length);
        expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
    });

    it('gives every enum-kv row a non-empty option list', () => {
        for (const row of rows.filter((r) => r.kind === 'enum-kv')) {
            const options = (row.config as EnumKvConfig).options;
            expect(Array.isArray(options), `${row.id} options`).toBe(true);
            expect(options.length, `${row.id} options`).toBeGreaterThan(0);
        }
    });

    it('gives every number-kv row a units symbol', () => {
        // A number with no unit is a number nobody can read off a nameplate.
        for (const row of rows.filter((r) => r.kind === 'number-kv')) {
            const units = (row.config as NumberKvConfig).unitsSymbol;
            expect(units?.trim(), `${row.id} unitsSymbol`).toBeTruthy();
        }
    });

    it('binds construction defaults to the three spec birth fields, all present', () => {
        expect([...constructionDefaults()]).toEqual([
            DEFINITION_IDS.typeOf,
            DEFINITION_IDS.description,
            DEFINITION_IDS.tags,
        ]);
        for (const id of constructionDefaults()) {
            expect(ids.has(id), `constructionDefaults → ${id}`).toBe(true);
        }
    });

    it('binds each lens policy to a pack row of that lens kind', () => {
        for (const key of Object.keys(DEFAULT_PACK.lensPolicies)) {
            const kind = key as Kind;
            // Only a kind that actually provisions a lens can carry a policy binding.
            expect(capsOf(kind).provision, `${key} provision capability`).toBeDefined();
            const policyId = lensPolicyFor(kind);
            const row = rows.find((r) => r.id === policyId);
            expect(row, `${key} policy ${policyId}`).toBeDefined();
            expect(row?.kind).toBe(kind);
        }
        expect(lensPolicyFor('logbook')).toBe(DEFINITION_IDS.logbookPolicy);
        // jobs binds none — re-root binding is optional, and this is the proof.
        expect(lensPolicyFor('jobs')).toBeNull();
    });

    it('names each lens exactly as its manifest pickerLabel does', () => {
        // Pinned literals, not a manifest read: tests may not import registry.ts.
        // Mirror of jobs.manifest.ts / logbook.manifest.ts `pickerLabel`.
        expect(lensNameFor('jobs')).toBe('Jobs');
        expect(lensNameFor('logbook')).toBe('Logbook');
        // Every named kind is a provisioning one, and every provisioning kind is named.
        const named = Object.keys(DEFAULT_PACK.lensNames) as Kind[];
        const provisioning = (Object.keys(KIND_CAPABILITIES) as Kind[]).filter((k) => capsOf(k).provision);
        expect([...named].sort()).toEqual([...provisioning].sort());
    });
});
