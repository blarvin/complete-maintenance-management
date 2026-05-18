/**
 * Unit tests for the `number-kv` pure functions:
 *  - `computeNumberKvState`: state precedence, stale-vs-value, range vs discrete.
 *  - `validateNumberKvConfig`: invariant chain in both modes; currency/format
 *    rules; decimals / refresh-seconds bounds.
 */

import { describe, it, expect } from 'vitest';
import {
    computeNumberKvState,
    validateNumberKvConfig,
} from '../components/DataField/numberKvState';
import type { NumberKvConfig } from '../data/models';

const baseRange: NumberKvConfig = {
    unitsSymbol: '°C',
    nominalMin: 20,
    nominalMax: 25,
    low: 15,
    lowLow: 5,
    high: 30,
    highHigh: 40,
};

describe('computeNumberKvState - precedence', () => {
    it('returns none for null value with no thresholds configured', () => {
        expect(computeNumberKvState(null, { unitsSymbol: 'kg' })).toBe('none');
    });

    it('returns none for non-null value when no thresholds and no nominal configured', () => {
        expect(computeNumberKvState(42, { unitsSymbol: 'kg' })).toBe('none');
    });

    it('returns none for NaN / Infinity (when no stale rule fires)', () => {
        expect(computeNumberKvState(NaN, baseRange)).toBe('none');
        expect(computeNumberKvState(Infinity, baseRange)).toBe('none');
    });

    it('stale takes precedence over alarm', () => {
        const config: NumberKvConfig = { ...baseRange, expectedRefreshSeconds: 60 };
        const now = 1_000_000_000;
        const old = now - 120_000; // 2 minutes ago — past the 60s freshness window
        // 100 is way past HH (40) so otherwise this would be 'alarm'.
        expect(computeNumberKvState(100, config, old, now)).toBe('stale');
    });

    it('stale even with no value if updatedAt is past expectedRefresh', () => {
        const config: NumberKvConfig = { ...baseRange, expectedRefreshSeconds: 60 };
        const now = 1_000_000_000;
        const old = now - 120_000;
        // Per spec, stale precedence applies regardless of value — even null.
        expect(computeNumberKvState(null, config, old, now)).toBe('stale');
    });

    it('does not go stale when expectedRefreshSeconds is unset', () => {
        const now = 1_000_000_000;
        const old = now - 86_400_000; // a day ago
        expect(computeNumberKvState(22, baseRange, old, now)).toBe('ok');
    });

    it('does not go stale when updatedAt is 0 (signal: not applicable)', () => {
        const config: NumberKvConfig = { ...baseRange, expectedRefreshSeconds: 60 };
        // Composer pendingMode passes 0 — value hasn't been written yet, so
        // freshness is not meaningful.
        expect(computeNumberKvState(22, config, 0, 1_000_000_000)).toBe('ok');
    });
});

describe('computeNumberKvState - range mode', () => {
    it('alarm: below LL', () => {
        expect(computeNumberKvState(0, baseRange)).toBe('alarm');
    });

    it('alarm: above HH', () => {
        expect(computeNumberKvState(50, baseRange)).toBe('alarm');
    });

    it('warn: in [LL, L) below nominal', () => {
        expect(computeNumberKvState(10, baseRange)).toBe('warn');
    });

    it('warn: in (H, HH] above nominal', () => {
        expect(computeNumberKvState(35, baseRange)).toBe('warn');
    });

    it('warn: between L and nominalMin (informational L threshold)', () => {
        // L=15, nominalMin=20 — value 17 is above L (so not alarm/warn-from-L)
        // but below nominalMin — should be 'warn' to mark "not yet in nominal".
        expect(computeNumberKvState(17, baseRange)).toBe('warn');
    });

    it('ok: inside [nominalMin, nominalMax]', () => {
        expect(computeNumberKvState(22, baseRange)).toBe('ok');
        expect(computeNumberKvState(20, baseRange)).toBe('ok');
        expect(computeNumberKvState(25, baseRange)).toBe('ok');
    });

    it('boundary: exactly at LL is alarm? Spec: <LL is alarm, so ==LL is warn', () => {
        // `< lowLow` returns alarm; equal is not strictly less.
        expect(computeNumberKvState(5, baseRange)).toBe('warn');
        expect(computeNumberKvState(4.999, baseRange)).toBe('alarm');
    });
});

describe('computeNumberKvState - discrete mode', () => {
    const discrete: NumberKvConfig = {
        unitsSymbol: 'V',
        nominalMode: 'discrete',
        nominalValue: 24,
        tolerance: 0.5,
        low: 23,
        lowLow: 22,
        high: 25,
        highHigh: 26,
    };

    it('ok: within (nominalValue ± tolerance)', () => {
        expect(computeNumberKvState(24, discrete)).toBe('ok');
        expect(computeNumberKvState(23.5, discrete)).toBe('ok');
        expect(computeNumberKvState(24.5, discrete)).toBe('ok');
    });

    it('warn: just outside tolerance but inside L/H', () => {
        // 23.4 < (24 - 0.5)=23.5 but >= L=23 → warn from "below nominal"
        expect(computeNumberKvState(23.4, discrete)).toBe('warn');
        // 24.6 > (24 + 0.5)=24.5 but <= H=25 → warn
        expect(computeNumberKvState(24.6, discrete)).toBe('warn');
    });

    it('alarm: outside [LL, HH]', () => {
        expect(computeNumberKvState(21.9, discrete)).toBe('alarm');
        expect(computeNumberKvState(26.1, discrete)).toBe('alarm');
    });

    it('handles missing tolerance as 0 (pure equality nominal)', () => {
        const exact: NumberKvConfig = {
            unitsSymbol: 'V',
            nominalMode: 'discrete',
            nominalValue: 24,
            // no tolerance, no L/LL/H/HH
        };
        expect(computeNumberKvState(24, exact)).toBe('ok');
        expect(computeNumberKvState(24.0000001, exact)).toBe('warn');
    });
});

describe('validateNumberKvConfig - required + bounds', () => {
    it('accepts config with no unitsSymbol (units are optional)', () => {
        expect(validateNumberKvConfig({})).toBeNull();
        expect(validateNumberKvConfig({ unitsSymbol: '' })).toBeNull();
    });

    it('accepts minimal valid config (just unitsSymbol)', () => {
        expect(validateNumberKvConfig({ unitsSymbol: 'kg' })).toBeNull();
    });

    it('rejects negative decimals', () => {
        expect(validateNumberKvConfig({ unitsSymbol: 'V', decimals: -1 })).toMatch(/decimals/);
    });

    it('rejects non-positive expectedRefreshSeconds', () => {
        expect(validateNumberKvConfig({ unitsSymbol: 'V', expectedRefreshSeconds: 0 })).toMatch(/expectedRefreshSeconds/);
        expect(validateNumberKvConfig({ unitsSymbol: 'V', expectedRefreshSeconds: -10 })).toMatch(/expectedRefreshSeconds/);
    });

    it('rejects currency without currencyCode', () => {
        expect(validateNumberKvConfig({ unitsSymbol: '$', displayFormat: 'currency' })).toMatch(/currencyCode/);
        expect(validateNumberKvConfig({ unitsSymbol: '$', displayFormat: 'currency', currencyCode: '' })).toMatch(/currencyCode/);
    });

    it('accepts currency with currencyCode', () => {
        expect(validateNumberKvConfig({
            unitsSymbol: '$',
            displayFormat: 'currency',
            currencyCode: 'USD',
        })).toBeNull();
    });
});

describe('validateNumberKvConfig - range-mode invariant chain', () => {
    it('accepts a fully-specified valid chain LL ≤ L ≤ nominalMin ≤ nominalMax ≤ H ≤ HH', () => {
        expect(validateNumberKvConfig(baseRange)).toBeNull();
    });

    it('rejects LL > L', () => {
        expect(validateNumberKvConfig({ ...baseRange, lowLow: 20, low: 15 })).toMatch(/lowLow/);
    });

    it('rejects L > nominalMin', () => {
        expect(validateNumberKvConfig({ ...baseRange, low: 25, nominalMin: 20 })).toMatch(/low.*nominalMin/);
    });

    it('rejects nominalMin > nominalMax', () => {
        expect(validateNumberKvConfig({ ...baseRange, nominalMin: 30, nominalMax: 25 })).toMatch(/nominalMin/);
    });

    it('rejects nominalMax > H', () => {
        expect(validateNumberKvConfig({ ...baseRange, nominalMax: 35, high: 30 })).toMatch(/nominalMax.*high/);
    });

    it('rejects H > HH', () => {
        expect(validateNumberKvConfig({ ...baseRange, high: 50, highHigh: 40 })).toMatch(/high/);
    });

    it('accepts partial chain when subsets are omitted', () => {
        expect(validateNumberKvConfig({
            unitsSymbol: 'kg',
            nominalMax: 100,
        })).toBeNull();
        expect(validateNumberKvConfig({
            unitsSymbol: 'kg',
            low: 10,
            high: 20,
        })).toBeNull();
    });
});

describe('validateNumberKvConfig - discrete-mode invariants', () => {
    const valid = {
        unitsSymbol: 'V',
        nominalMode: 'discrete' as const,
        nominalValue: 24,
        tolerance: 0.5,
        low: 23,
        lowLow: 22,
        high: 25,
        highHigh: 26,
    };

    it('accepts a valid discrete-mode chain', () => {
        expect(validateNumberKvConfig(valid)).toBeNull();
    });

    it('rejects negative tolerance', () => {
        expect(validateNumberKvConfig({ ...valid, tolerance: -0.1 })).toMatch(/tolerance/);
    });

    it('rejects L > nominalValue − tolerance', () => {
        // nominalValue 24, tolerance 0.5 → nomLow = 23.5. low=23.7 violates.
        expect(validateNumberKvConfig({ ...valid, low: 23.7 })).toMatch(/low.*nominalValue/);
    });

    it('rejects nominalValue + tolerance > H', () => {
        expect(validateNumberKvConfig({ ...valid, high: 24.3 })).toMatch(/nominalValue.*high/);
    });
});

// Inline helpers that mirror NumberKvField.tsx NumberKvBody logic for percent round-trip.
function makePercentHelpers(decimals: number) {
    const format = (v: number | null) =>
        v === null || v === undefined ? '' : (v * 100).toFixed(decimals);
    const parse = (raw: string): number | null => {
        const trimmed = raw.trim();
        if (trimmed === '') return null;
        const n = parseFloat(trimmed);
        if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a valid number`);
        return n / 100;
    };
    return { format, parse };
}

describe('NumberKvField percent round-trip', () => {
    const { format, parse } = makePercentHelpers(2);

    it('format: stored 0.85 → edit buffer "85.00"', () => {
        expect(format(0.85)).toBe('85.00');
    });

    it('parse: edit buffer "85" → stored 0.85', () => {
        expect(parse('85')).toBeCloseTo(0.85);
    });

    it('round-trip: format → parse identity', () => {
        expect(parse(format(0.42)!)).toBeCloseTo(0.42);
    });

    it('format null → empty string', () => {
        expect(format(null)).toBe('');
    });

    it('parse empty string → null', () => {
        expect(parse('')).toBeNull();
    });
});
