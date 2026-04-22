/**
 * Pure function: compute ok / warn / alarm state for a measurement value
 * against its Template config. Exported separately for unit tests.
 */

import type { MeasurementKvConfig } from '../../data/models';

export type MeasurementState = 'none' | 'ok' | 'warn' | 'alarm';

/**
 * ok: value is within [nominalMin, nominalMax] when both are set.
 * warn: value is within [warnLow, warnHigh] but outside the nominal band.
 * alarm: value is outside the warn band (if set) or outside [absoluteMin, absoluteMax].
 * none: null value or no ranges configured.
 */
export function computeMeasurementState(
    value: number | null,
    config: MeasurementKvConfig,
): MeasurementState {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'none';

    const hasNominal = config.nominalMin !== undefined || config.nominalMax !== undefined;
    const hasWarn = config.warnLow !== undefined || config.warnHigh !== undefined;
    const hasAbsolute = config.absoluteMin !== undefined || config.absoluteMax !== undefined;

    if (!hasNominal && !hasWarn && !hasAbsolute) return 'none';

    // Alarm takes precedence: outside absolute or outside warn range.
    if (config.absoluteMin !== undefined && value < config.absoluteMin) return 'alarm';
    if (config.absoluteMax !== undefined && value > config.absoluteMax) return 'alarm';
    if (config.warnLow !== undefined && value < config.warnLow) return 'alarm';
    if (config.warnHigh !== undefined && value > config.warnHigh) return 'alarm';

    // Warn: inside warn range but outside nominal band.
    if (config.nominalMin !== undefined && value < config.nominalMin) return 'warn';
    if (config.nominalMax !== undefined && value > config.nominalMax) return 'warn';

    // Otherwise ok.
    return 'ok';
}
