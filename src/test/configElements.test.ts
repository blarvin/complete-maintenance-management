/**
 * Config-as-Elements (de)serialize: serializeConfig ⇄ assembleConfig round-trips,
 * deterministic child ids, the number-kv thresholds compound pack/unpack, the
 * threshold ordering guard, and config-only kind registration.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeConfig,
  assembleConfig,
  configChildId,
} from '../kinds/configElements';
import { validateThresholds } from '../components/DataField/numberKvState';
import type { DefinitionConfig, Kind } from '../data/models';

// NB: this suite deliberately avoids importing the registry / manifests — they
// pull in `component$` renderers that the optimizer doesn't transform under
// Vitest (project convention: don't import Qwik components in unit tests). The
// config-only kind registration is enforced by `satisfies` at compile time and
// exercised by the app at runtime.

function roundTrip(kind: Kind, config: DefinitionConfig): DefinitionConfig {
  const children = serializeConfig('fd', kind, config);
  const byId = new Map(children.map((c) => [c.id, { value: c.value }]));
  return assembleConfig('fd', kind, (id) => byId.get(id));
}

describe('configElements — serialize ⇄ assemble round-trips', () => {
  it('text-kv (flags + numbers + text)', () => {
    const config = { maxLength: 100, multiline: true, placeholder: 'x', maxWords: 5 };
    expect(roundTrip('text-kv', config)).toEqual(config);
  });

  it('enum-kv (string-list + flag)', () => {
    const config = { options: ['a', 'b', 'c'], allowOther: true, default: 'a' };
    expect(roundTrip('enum-kv', config)).toEqual(config);
  });

  it('single-image', () => {
    const config = { maxSizeMB: 5, requireCaption: true, aspectHint: '16:9' };
    expect(roundTrip('single-image', config)).toEqual(config);
  });

  it('number-kv with thresholds (compound pack/unpack)', () => {
    const config = {
      unitsSymbol: 'kg',
      decimals: 2,
      nominalMode: 'range' as const,
      nominalMin: 2,
      nominalMax: 8,
      lowLow: 0,
      low: 1,
      high: 9,
      highHigh: 10,
    };
    expect(roundTrip('number-kv', config)).toEqual(config);
  });

  it('number-kv without thresholds omits the compound child', () => {
    const children = serializeConfig('fd', 'number-kv', { unitsSymbol: 'kg' });
    expect(children.find((c) => c.id === configChildId('fd', 'thresholds'))).toBeUndefined();
    expect(roundTrip('number-kv', { unitsSymbol: 'kg' })).toEqual({ unitsSymbol: 'kg' });
  });

  it('drops absent (undefined) keys — sparse config stays sparse', () => {
    const children = serializeConfig('fd', 'text-kv', { multiline: true });
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe(configChildId('fd', 'multiline'));
  });
});

describe('configElements — child shape', () => {
  it('uses deterministic ::cfg:: ids and library treeType', () => {
    expect(configChildId('fd_weight', 'decimals')).toBe('fd_weight::cfg::decimals');
    const [child] = serializeConfig('fd_weight', 'number-kv', { decimals: 2 });
    expect(child.id).toBe('fd_weight::cfg::decimals');
    expect(child.kind).toBe('number-kv');
    expect(child.parentId).toBe('fd_weight');
    expect(child.treeType).toBe('library');
    expect(child.value).toBe(2);
  });
});

describe('validateThresholds — compound ordering guard', () => {
  it('accepts null and a well-ordered subset', () => {
    expect(validateThresholds(null)).toBeNull();
    expect(validateThresholds({ lowLow: 0, low: 1, high: 9, highHigh: 10 })).toBeNull();
  });
  it('rejects out-of-order thresholds', () => {
    expect(validateThresholds({ lowLow: 5, low: 1 })).toMatch(/lowLow/);
    expect(validateThresholds({ low: 9, high: 1 })).toMatch(/low/);
    expect(validateThresholds({ high: 10, highHigh: 2 })).toMatch(/high/);
  });
});
