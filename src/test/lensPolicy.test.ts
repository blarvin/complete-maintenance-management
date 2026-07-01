/**
 * lensPolicy — pure resolution of a lens's policy Definition config
 * (entry label fallback matrix) and the staleness boundary logic.
 */

import { describe, it, expect } from 'vitest';
import { resolveLensPolicy, isLensStale } from '../kinds/lensPolicy';

describe('resolveLensPolicy', () => {
  it('falls back to the pickerLabel when the lens carries no policy (null config)', () => {
    expect(resolveLensPolicy(null, 'Job')).toEqual({ entryLabel: 'Job', staleness: 0 });
    expect(resolveLensPolicy(undefined, 'Job')).toEqual({ entryLabel: 'Job', staleness: 0 });
  });

  it('falls back when entryLabel is missing or whitespace-only', () => {
    expect(resolveLensPolicy({}, 'Log Entry').entryLabel).toBe('Log Entry');
    expect(resolveLensPolicy({ entryLabel: '   ' }, 'Log Entry').entryLabel).toBe('Log Entry');
  });

  it('uses the bound policy entryLabel (trimmed) when present', () => {
    expect(resolveLensPolicy({ entryLabel: ' Round ' }, 'Log Entry').entryLabel).toBe('Round');
  });

  it('carries staleness only when positive', () => {
    expect(resolveLensPolicy({ staleness: 604800 }, 'x').staleness).toBe(604800);
    expect(resolveLensPolicy({ staleness: 0 }, 'x').staleness).toBe(0);
    expect(resolveLensPolicy({ staleness: -5 }, 'x').staleness).toBe(0);
    expect(resolveLensPolicy({}, 'x').staleness).toBe(0);
  });
});

describe('isLensStale', () => {
  const NOW = 1_000_000_000_000;

  it('never stale when staleness is disabled (0)', () => {
    expect(isLensStale(NOW - 999_999_999, 0, NOW)).toBe(false);
  });

  it('never stale with no entries (null newest)', () => {
    expect(isLensStale(null, 60, NOW)).toBe(false);
  });

  it('not stale exactly at the threshold, stale past it', () => {
    const staleness = 60; // seconds
    expect(isLensStale(NOW - 60_000, staleness, NOW)).toBe(false);
    expect(isLensStale(NOW - 60_001, staleness, NOW)).toBe(true);
  });

  it('fresh entries are not stale', () => {
    expect(isLensStale(NOW - 1_000, 60, NOW)).toBe(false);
  });
});
