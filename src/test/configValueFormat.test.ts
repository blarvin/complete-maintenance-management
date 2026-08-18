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
import { formatFlag, formatStringList } from '../kinds/configValueFormat';

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

/* `formatCompound` was tested here until 2026-08-17. `compound` is retired —
   number-kv's thresholds are four ordinary `number-kv` sub-fields now, each
   formatted by that kind's own display path. */
