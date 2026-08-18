/**
 * Config-as-Elements (de)serialize: serializeConfig ⇄ assembleConfig round-trips,
 * deterministic child ids, materialization-in / sparseness-out, the leading
 * defined-kind child, and the threshold ordering guard.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeConfig,
  assembleConfig,
  configChildId,
  readDefinedKind,
  DEFINED_KIND_KEY,
} from '../kinds/configElements';
import { CONFIG_SCHEMAS } from '../kinds/configSchema';
import { validateThresholds } from '../components/DataField/numberKvState';
import type { DefinitionConfig, Kind } from '../data/models';

// NB: this suite deliberately avoids importing the registry / manifests — they
// pull in `.tsx` renderers, and `vitest.config.ts` has no Solid JSX transform
// (project convention: don't import components in unit tests). The config-only
// kind registration is enforced by `satisfies` at compile time and exercised by
// the app at runtime.

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

  it('logbook (the first re-root policy schema)', () => {
    const config = { entryLabel: 'Entry', staleness: 604800 };
    expect(roundTrip('logbook', config)).toEqual(config);

    const children = serializeConfig('fd', 'logbook', config);
    expect(children.map((c) => c.id).sort()).toEqual([
      configChildId('fd', DEFINED_KIND_KEY),
      configChildId('fd', 'entryLabel'),
      configChildId('fd', 'staleness'),
    ].sort());
  });

  it('number-kv with the four flat thresholds', () => {
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

  it('assembles back sparse even though every knob got a row', () => {
    // Materialization is the storage shape; sparseness is the read shape. This is
    // what keeps the change invisible to every consumer of the `Definition` view.
    expect(roundTrip('number-kv', { unitsSymbol: 'kg' })).toEqual({ unitsSymbol: 'kg' });
    expect(roundTrip('text-kv', { multiline: true })).toEqual({ multiline: true });
  });
});

describe('configElements — materialization', () => {
  it('emits a child for every schema knob, valued or not', () => {
    // Without this the Library could only show config somebody had already set: an
    // unset knob would have no Element, so no row, so nothing to tap in order to
    // set it (SPEC → *Config Fields are provisioned*).
    const children = serializeConfig('fd', 'text-kv', { multiline: true });
    const schema = CONFIG_SCHEMAS['text-kv']!;
    // +1 for the leading defined-kind child, which belongs to no schema.
    expect(children).toHaveLength(schema.length + 1);
    for (const sub of schema) {
      expect(children.map((c) => c.id)).toContain(configChildId('fd', sub.key));
    }
  });

  it('marks an unset knob with a null value, not an omitted row', () => {
    const children = serializeConfig('fd', 'text-kv', { multiline: true });
    const byId = new Map(children.map((c) => [c.id, c]));
    expect(byId.get(configChildId('fd', 'multiline'))?.value).toBe(true);
    expect(byId.get(configChildId('fd', 'placeholder'))?.value).toBeNull();
  });
});

describe('configElements — the defined kind is a config Field', () => {
  it('leads the subtree and carries the kind being defined', () => {
    // A Definition's Element is `kind: node`, so the kind it defines cannot live
    // in the `kind` column. It is read first because it selects the schema the
    // rest are provisioned from (SPEC → *The defined kind is a config Field*).
    const [first] = serializeConfig('fd', 'number-kv', {});
    expect(first.id).toBe(configChildId('fd', DEFINED_KIND_KEY));
    expect(first.name).toBe('Kind');
    expect(first.kind).toBe('enum-kv');
    expect(first.value).toBe('number-kv');
    expect(first.siblingOrder).toBe(0);
  });

  it('reads back through readDefinedKind', () => {
    const children = serializeConfig('fd', 'enum-kv', { options: ['a', 'b'] });
    const byId = new Map(children.map((c) => [c.id, { value: c.value }]));
    expect(readDefinedKind('fd', (id) => byId.get(id))).toBe('enum-kv');
    expect(readDefinedKind('fd', () => undefined)).toBeNull();
  });

  it('stays out of the assembled config — it is not a knob', () => {
    // It belongs to every kind rather than to one, which is exactly why it is not
    // a `CONFIG_SCHEMAS` entry: a `kind` key leaking into the config object would
    // reach every downstream reader of a Definition.
    expect(roundTrip('text-kv', { multiline: true })).not.toHaveProperty('kind');
  });
});

describe('configElements — child shape', () => {
  it('uses deterministic ::cfg:: ids and library treeType', () => {
    expect(configChildId('fd_weight', 'decimals')).toBe('fd_weight::cfg::decimals');
    const children = serializeConfig('fd_weight', 'number-kv', { decimals: 2 });
    const child = children.find((c) => c.id === 'fd_weight::cfg::decimals')!;
    expect(child.kind).toBe('number-kv');
    expect(child.parentId).toBe('fd_weight');
    expect(child.treeType).toBe('library');
    expect(child.value).toBe(2);
    // `definitionId: null` is the third case of the identity column: a config
    // Field is bound to nothing. That is an interim — the end state mints them
    // from seeded meta-Definitions (LATER → *Config Fields as instances*) — but
    // the identity test does not change when it lands.
    expect(child.definitionId).toBeNull();
  });
});

describe('validateThresholds — the ordering chain, now a cross-field rule', () => {
  it('accepts an empty config and a well-ordered subset', () => {
    expect(validateThresholds({})).toBeNull();
    expect(validateThresholds({ lowLow: 0, low: 1, high: 9, highHigh: 10 })).toBeNull();
  });
  it('rejects out-of-order thresholds', () => {
    expect(validateThresholds({ lowLow: 5, low: 1 })).toMatch(/lowLow/);
    expect(validateThresholds({ low: 9, high: 1 })).toMatch(/low/);
    expect(validateThresholds({ high: 10, highHigh: 2 })).toMatch(/high/);
  });
});
