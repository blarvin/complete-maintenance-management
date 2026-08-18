/**
 * How a config sub-field value reads as text — the shared formatters behind both
 * each config-only kind's `displayPreview` and its Renderer.
 *
 * Worth pinning despite their size: these are the only verification available
 * for the config-only renderers until a surface mounts them (nothing draws
 * config as rows until the Add Surface lands), and two of the cases below are
 * deliberate decisions rather than obvious ones — empty-list and key order.
 *
 * Imports the formatter module directly, never a manifest: per testing
 * conventions nothing test-reachable may pull in a `.tsx`.
 */

import { describe, it, expect } from 'vitest';
import {
  formatFlag,
  formatStringList,
  formatCompound,
} from '../kinds/configValueFormat';

describe('formatFlag', () => {
  it('reads booleans as words', () => {
    expect(formatFlag(true)).toBe('Yes');
    expect(formatFlag(false)).toBe('No');
  });
});

describe('formatStringList', () => {
  it('joins options for display', () => {
    expect(formatStringList(['In Service', 'Maintenance', 'Retired']))
      .toBe('In Service, Maintenance, Retired');
  });

  it('distinguishes an empty list from an unset one', () => {
    // An enum-kv with no options cannot be filled in, so the empty list is a
    // real state the row has to show. Joining would render it as blank, which
    // is indistinguishable from the renderer's "Unset" placeholder.
    expect(formatStringList([])).toBe('None');
  });
});

describe('formatCompound', () => {
  it('renders key=value pairs in insertion order', () => {
    // packThresholds inserts lowLow → low → high → highHigh, which is the
    // ascending chain the ordering invariant is stated over — so the formatted
    // string reads left-to-right as that chain without the formatter knowing
    // anything about thresholds.
    expect(formatCompound({ lowLow: 0, low: 2, high: 8, highHigh: 10 }))
      .toBe('lowLow=0, low=2, high=8, highHigh=10');
  });

  it('omits absent keys rather than printing blanks', () => {
    expect(formatCompound({ low: 2, high: 8 })).toBe('low=2, high=8');
  });

  it('handles a compound with no keys set', () => {
    expect(formatCompound({})).toBe('');
  });
});
