/**
 * Pure functions for `number-kv`: state classification + config invariant
 * validation. Exported separately so unit tests can hit them without
 * mounting the renderer.
 *
 * State precedence (per SPEC §FieldComponent: number-kv):
 *   stale > alarm > warn > ok > none
 *
 * `stale` is a separate signal axis — set when `expectedRefreshSeconds` is
 * configured and the value's `updatedAt` is older than that, regardless of
 * whether the value is in nominal range.
 */

import type { NumberKvConfig } from '../../data/models';

export type NumberKvState = 'none' | 'ok' | 'warn' | 'alarm' | 'stale';

/**
 * Compute the display state for a value against its config.
 *
 * @param value - current value (or null)
 * @param config - NumberKvConfig
 * @param updatedAt - epoch ms when the value was last written; only consulted
 *   for the `stale` axis. Pass 0 to disable stale entirely.
 * @param now - epoch ms "current time"; injectable for tests.
 */
export function computeNumberKvState(
    value: number | null,
    config: NumberKvConfig,
    updatedAt: number = 0,
    now: number = Date.now(),
): NumberKvState {
    // Stale takes precedence over every value-based state. Stale is a
    // freshness axis: a perfectly-in-range value with a stale timestamp is
    // still stale.
    const refreshMs = config.expectedRefreshSeconds !== undefined
        ? config.expectedRefreshSeconds * 1000
        : undefined;
    if (refreshMs !== undefined && updatedAt > 0 && now - updatedAt > refreshMs) {
        return 'stale';
    }

    if (value === null || value === undefined || !Number.isFinite(value)) return 'none';

    const { lowLow, low, high, highHigh } = config;
    const mode = config.nominalMode ?? 'range';

    // Alarm — value beyond the hard absolute thresholds.
    if (lowLow !== undefined && value < lowLow) return 'alarm';
    if (highHigh !== undefined && value > highHigh) return 'alarm';

    // Warn — value in the [LL, L) or (H, HH] bands.
    if (low !== undefined && value < low) return 'warn';
    if (high !== undefined && value > high) return 'warn';

    if (mode === 'range') {
        const { nominalMin, nominalMax } = config;
        const hasNominal = nominalMin !== undefined || nominalMax !== undefined;
        const hasThresholds = lowLow !== undefined || low !== undefined || high !== undefined || highHigh !== undefined;
        if (!hasNominal && !hasThresholds) return 'none';
        if (nominalMin !== undefined && value < nominalMin) return 'warn';
        if (nominalMax !== undefined && value > nominalMax) return 'warn';
        return 'ok';
    }

    // Discrete mode: nominal is [nominalValue − tolerance, nominalValue + tolerance].
    const { nominalValue, tolerance } = config;
    const hasNominal = nominalValue !== undefined;
    const hasThresholds = lowLow !== undefined || low !== undefined || high !== undefined || highHigh !== undefined;
    if (!hasNominal && !hasThresholds) return 'none';
    if (nominalValue !== undefined) {
        const tol = tolerance ?? 0;
        if (value < nominalValue - tol) return 'warn';
        if (value > nominalValue + tol) return 'warn';
    }
    return 'ok';
}

/**
 * Validate a NumberKvConfig. Returns null on valid; otherwise an error
 * message naming the first violated invariant.
 *
 * Used by the FieldDefinition authoring form (PR 6) to gate Save, and by
 * unit tests against seed data. The runtime renderer doesn't call this —
 * config is assumed valid by the time it reaches the field.
 */
export function validateNumberKvConfig(config: NumberKvConfig): string | null {
    if (!config.unitsSymbol || config.unitsSymbol.trim() === '') {
        return 'unitsSymbol is required';
    }
    if (config.decimals !== undefined && config.decimals < 0) {
        return 'decimals must be ≥ 0';
    }
    if (config.expectedRefreshSeconds !== undefined && !(config.expectedRefreshSeconds > 0)) {
        return 'expectedRefreshSeconds must be > 0';
    }
    if (config.displayFormat === 'currency') {
        if (!config.currencyCode || config.currencyCode.trim() === '') {
            return 'currencyCode is required when displayFormat is "currency"';
        }
    }

    const { lowLow, low, high, highHigh } = config;
    // L ≤ H pair (when both set, regardless of nominal mode).
    if (low !== undefined && high !== undefined && !(low <= high)) {
        return `low (${low}) must be ≤ high (${high})`;
    }
    // LL ≤ L
    if (lowLow !== undefined && low !== undefined && !(lowLow <= low)) {
        return `lowLow (${lowLow}) must be ≤ low (${low})`;
    }
    // H ≤ HH
    if (high !== undefined && highHigh !== undefined && !(high <= highHigh)) {
        return `high (${high}) must be ≤ highHigh (${highHigh})`;
    }
    // LL ≤ HH (and LL ≤ H, L ≤ HH) follow transitively when the pairs above hold.
    if (lowLow !== undefined && highHigh !== undefined && !(lowLow <= highHigh)) {
        return `lowLow (${lowLow}) must be ≤ highHigh (${highHigh})`;
    }

    const mode = config.nominalMode ?? 'range';
    if (mode === 'range') {
        const { nominalMin, nominalMax } = config;
        if (nominalMin !== undefined && nominalMax !== undefined && !(nominalMin <= nominalMax)) {
            return `nominalMin (${nominalMin}) must be ≤ nominalMax (${nominalMax})`;
        }
        if (low !== undefined && nominalMin !== undefined && !(low <= nominalMin)) {
            return `low (${low}) must be ≤ nominalMin (${nominalMin})`;
        }
        if (nominalMax !== undefined && high !== undefined && !(nominalMax <= high)) {
            return `nominalMax (${nominalMax}) must be ≤ high (${high})`;
        }
        if (lowLow !== undefined && nominalMin !== undefined && !(lowLow <= nominalMin)) {
            return `lowLow (${lowLow}) must be ≤ nominalMin (${nominalMin})`;
        }
        if (nominalMax !== undefined && highHigh !== undefined && !(nominalMax <= highHigh)) {
            return `nominalMax (${nominalMax}) must be ≤ highHigh (${highHigh})`;
        }
    } else {
        // Discrete.
        const { nominalValue, tolerance } = config;
        if (tolerance !== undefined && tolerance < 0) {
            return 'tolerance must be ≥ 0';
        }
        if (nominalValue !== undefined) {
            const tol = tolerance ?? 0;
            const nomLow = nominalValue - tol;
            const nomHigh = nominalValue + tol;
            if (low !== undefined && !(low <= nomLow)) {
                return `low (${low}) must be ≤ nominalValue − tolerance (${nomLow})`;
            }
            if (high !== undefined && !(nomHigh <= high)) {
                return `nominalValue + tolerance (${nomHigh}) must be ≤ high (${high})`;
            }
            if (lowLow !== undefined && !(lowLow <= nomLow)) {
                return `lowLow (${lowLow}) must be ≤ nominalValue − tolerance (${nomLow})`;
            }
            if (highHigh !== undefined && !(nomHigh <= highHigh)) {
                return `nominalValue + tolerance (${nomHigh}) must be ≤ highHigh (${highHigh})`;
            }
        }
    }

    return null;
}
