import { describe, it, expect } from 'vitest';
import { computeMeasurementState } from '../components/DataField/measurementState';
import type { MeasurementKvConfig } from '../data/models';

const config: MeasurementKvConfig = {
  units: 'PSI',
  nominalMin: 30,
  nominalMax: 50,
  warnLow: 20,
  warnHigh: 60,
  absoluteMin: 10,
  absoluteMax: 80,
};

describe('computeMeasurementState', () => {
  it('returns none for null', () => {
    expect(computeMeasurementState(null, config)).toBe('none');
  });

  it('returns none when no ranges configured', () => {
    expect(computeMeasurementState(42, { units: 'kg' })).toBe('none');
  });

  it('returns ok within nominal band', () => {
    expect(computeMeasurementState(30, config)).toBe('ok');
    expect(computeMeasurementState(40, config)).toBe('ok');
    expect(computeMeasurementState(50, config)).toBe('ok');
  });

  it('returns warn inside warn band but outside nominal', () => {
    expect(computeMeasurementState(25, config)).toBe('warn');
    expect(computeMeasurementState(55, config)).toBe('warn');
  });

  it('returns alarm outside warn band', () => {
    expect(computeMeasurementState(15, config)).toBe('alarm');
    expect(computeMeasurementState(70, config)).toBe('alarm');
  });

  it('returns alarm outside absolute range', () => {
    expect(computeMeasurementState(5, config)).toBe('alarm');
    expect(computeMeasurementState(100, config)).toBe('alarm');
  });

  it('handles partial range config', () => {
    const partial: MeasurementKvConfig = { units: 'kg', nominalMax: 100 };
    expect(computeMeasurementState(50, partial)).toBe('ok');
    expect(computeMeasurementState(150, partial)).toBe('warn');
  });

  it('rejects NaN / Infinity as none', () => {
    expect(computeMeasurementState(NaN, config)).toBe('none');
    expect(computeMeasurementState(Infinity, config)).toBe('none');
  });
});
