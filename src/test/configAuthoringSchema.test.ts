/**
 * The authoring shape of the config schemas — flatness, compound members,
 * conditional reveal, and the cross-field validators that replaced the per-kind
 * ConfigForms.
 *
 * These drive the Add Surface's config rows, but none of them touch storage, so
 * the last suite here is the canary: `serializeConfig`/`assembleConfig` must be
 * indifferent to every field added for authoring.
 *
 * Imports only component-free modules, per testing conventions.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIG_SCHEMAS,
  CONFIG_VALIDATORS,
  NUMBER_KV_CONFIG_SCHEMA,
} from '../kinds/configSchema';
import { serializeConfig, assembleConfig } from '../kinds/configElements';
import { packThresholds } from '../components/DataField/numberKvState';
import type { DefinitionConfig, Kind } from '../data/models';

const sub = (key: string) => {
  const found = NUMBER_KV_CONFIG_SCHEMA.find((s) => s.key === key);
  if (!found) throw new Error(`no number-kv sub-field '${key}'`);
  return found;
};

describe('config authors flat', () => {
  it('no schema carries a grouping field — the type has none, and none is faked', () => {
    // Collapsible category groups were removed 2026-08-16 (SUPERSEDED →
    // number-kv progressive disclosure). This is the guard against one being
    // reintroduced as an ad-hoc key rather than as a considered spec change.
    for (const [kind, schema] of Object.entries(CONFIG_SCHEMAS)) {
      for (const s of schema ?? []) {
        expect(
          Object.keys(s),
          `${kind}.${s.key} carries a grouping key`,
        ).not.toContain('group');
      }
    }
  });

  it('leads number-kv with its one required knob', () => {
    expect(NUMBER_KV_CONFIG_SCHEMA[0].key).toBe('unitsSymbol');
  });
});

describe('conditional reveal', () => {
  it('reveals currencyCode only for a currency format', () => {
    const visible = sub('currencyCode').visibleWhen!;
    expect(visible({ displayFormat: 'currency' })).toBe(true);
    expect(visible({ displayFormat: 'decimal' })).toBe(false);
    expect(visible({})).toBe(false);
  });

  it('swaps the nominal pair on nominalMode, defaulting to range', () => {
    const min = sub('nominalMin').visibleWhen!;
    const value = sub('nominalValue').visibleWhen!;

    // Unset means range (ELEMENT-MODEL → number-kv), so the range pair shows.
    expect(min({})).toBe(true);
    expect(value({})).toBe(false);

    expect(min({ nominalMode: 'discrete' })).toBe(false);
    expect(value({ nominalMode: 'discrete' })).toBe(true);
  });

  it('never shows both nominal pairs at once, in any mode', () => {
    for (const config of [{}, { nominalMode: 'range' }, { nominalMode: 'discrete' }]) {
      const range = sub('nominalMin').visibleWhen!(config);
      const discrete = sub('nominalValue').visibleWhen!(config);
      expect(range && discrete).toBe(false);
    }
  });
});

describe('compound members', () => {
  it('thresholds members are exactly the flat keys pack reads', () => {
    // If these drift, authoring edits keys that never reach storage — silently.
    const members = sub('thresholds').members!.map((m) => m.key);
    const packed = Object.keys(
      packThresholds({ lowLow: 1, low: 2, high: 3, highHigh: 4 }),
    );
    expect(members).toEqual(packed);
  });

  it('member labels stand alone — the compound label no longer renders above them', () => {
    // Flattening dropped the `Thresholds` parent row, so `Low low` beside
    // `Nominal min` would have been ambiguous. The category moved into the label.
    for (const m of sub('thresholds').members!) {
      expect(m.label, `${m.key} leans on the compound label`).toMatch(/^Threshold /);
    }
  });
});

describe('cross-field validators', () => {
  it('enum-kv requires at least one non-blank option', () => {
    const validate = CONFIG_VALIDATORS['enum-kv']!;
    expect(validate({ options: [] } as DefinitionConfig)).toMatch(/at least one option/i);
    expect(validate({ options: ['  '] } as DefinitionConfig)).toMatch(/at least one option/i);
    expect(validate({ options: ['In Service'] } as DefinitionConfig)).toBeNull();
  });

  it('enum-kv constrains default to the options entered', () => {
    const validate = CONFIG_VALIDATORS['enum-kv']!;
    expect(
      validate({ options: ['A', 'B'], default: 'C' } as DefinitionConfig),
    ).toMatch(/must be one of the options/i);
    expect(validate({ options: ['A', 'B'], default: 'B' } as DefinitionConfig)).toBeNull();
    // Absent default is fine — it is optional, not required.
    expect(validate({ options: ['A'] } as DefinitionConfig)).toBeNull();
  });

  it('number-kv rejects a broken threshold chain and a currency with no code', () => {
    const validate = CONFIG_VALIDATORS['number-kv']!;
    expect(validate({ low: 9, high: 2 } as DefinitionConfig)).toMatch(/low/i);
    expect(validate({ displayFormat: 'currency' } as DefinitionConfig)).toMatch(/currencyCode/i);
    expect(validate({ unitsSymbol: 'psi', low: 2, high: 9 } as DefinitionConfig)).toBeNull();
  });
});

describe('storage is indifferent to the authoring fields', () => {
  // The canary: `members` and `visibleWhen` are rendering facts. If either
  // leaked into serialize/assemble, this breaks.
  const roundTrip = (kind: Kind, config: DefinitionConfig): DefinitionConfig => {
    const children = serializeConfig('fd', kind, config);
    const byId = new Map(children.map((c) => [c.id, { value: c.value }]));
    return assembleConfig('fd', kind, (id) => byId.get(id));
  };

  it('number-kv still round-trips, thresholds included', () => {
    const config = {
      unitsSymbol: 'psi',
      decimals: 2,
      nominalMode: 'range',
      nominalMin: 3,
      nominalMax: 7,
      lowLow: 0,
      low: 2,
      high: 8,
      highHigh: 10,
    } as DefinitionConfig;
    expect(roundTrip('number-kv', config)).toEqual(config);
  });

  it('emits no child for a hidden sub-field that was never filled', () => {
    // `currencyCode` is revealed only under a currency format; leaving it unset
    // must stay sparse rather than writing an empty child.
    const children = serializeConfig('fd', 'number-kv', {
      unitsSymbol: 'psi',
    } as DefinitionConfig);
    expect(children.map((c) => c.id)).not.toContain('fd::cfg::currencyCode');
  });
});
