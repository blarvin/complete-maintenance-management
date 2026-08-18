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
import { serializeConfig, assembleConfig, configChildId } from '../kinds/configElements';
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

describe('dynamic option vocabularies', () => {
  const enumSub = (key: string) => {
    const found = CONFIG_SCHEMAS['enum-kv']!.find((s) => s.key === key);
    if (!found) throw new Error(`no enum-kv sub-field '${key}'`);
    return found;
  };

  it('offers `default` exactly the options entered above it', () => {
    // The cross-field rule is `default ∈ options`, so the picker must not be
    // able to produce a value the validator would then reject.
    const opts = enumSub('default').dynamicOptions!;
    expect(opts({ options: ['In Service', 'Down'] })).toEqual(['In Service', 'Down']);
    expect(opts({})).toEqual([]);
  });

  it('hides the blank and whitespace-only rows from the `default` picker', () => {
    const opts = enumSub('default').dynamicOptions!;
    expect(opts({ options: ['In Service', '', '  ', 'Down'] })).toEqual(['In Service', 'Down']);
  });

  it('makes `default` an enum sub-field, not free text', () => {
    expect(enumSub('default').kind).toBe('enum-kv');
  });
});

describe('the alarm thresholds, now four ordinary sub-fields', () => {
  const THRESHOLDS = ['lowLow', 'low', 'high', 'highHigh'] as const;

  it('are four scalar number-kv entries, not one compound', () => {
    // `compound` is retired (2026-08-17): the authoring band already drew these as
    // four flat rows, and the Library gives each its own editable, individually
    // history-tracked Field. This is the guard against the packed shape returning
    // as a quiet convenience.
    for (const key of THRESHOLDS) {
      expect(sub(key).kind, `${key} is not a scalar`).toBe('number-kv');
      expect(Object.keys(sub(key)), `${key} carries pack/unpack`)
        .not.toContain('pack');
    }
    expect(NUMBER_KV_CONFIG_SCHEMA.find((s) => s.key === 'thresholds')).toBeUndefined();
  });

  it('carry stand-alone labels — there is no parent row above them to lean on', () => {
    // `Low low` beside `Nominal min` would have been ambiguous, so the category
    // moved into each label when the `Thresholds` parent row went away.
    for (const key of THRESHOLDS) {
      expect(sub(key).label, `${key} leans on a label that no longer renders`)
        .toMatch(/^Threshold /);
    }
  });

  it('each get their own config Element, so each gets its own history', () => {
    // The point of the retirement: a torn `L > H` merge is now possible and caught
    // by validation, in exchange for four separately-auditable knobs.
    const children = serializeConfig('fd', 'number-kv', { low: 2, high: 8 } as DefinitionConfig);
    for (const key of THRESHOLDS) {
      expect(children.map((c) => c.id)).toContain(configChildId('fd', key));
    }
  });
});

describe('cross-field validators', () => {
  it('enum-kv requires two non-blank options, not one', () => {
    // One option is a constant, not a choice; two is also the floor because a
    // two-option enum is how this app makes a yes/no field (`flag` is
    // config-only and never authorable). The draft seeds two blanks to match.
    const validate = CONFIG_VALIDATORS['enum-kv']!;
    expect(validate({ options: [] } as DefinitionConfig)).toMatch(/at least two options/i);
    expect(validate({ options: ['', ''] } as DefinitionConfig)).toMatch(/at least two options/i);
    expect(validate({ options: ['In Service'] } as DefinitionConfig)).toMatch(/at least two options/i);
    expect(validate({ options: ['In Service', '  '] } as DefinitionConfig)).toMatch(/at least two options/i);
    expect(validate({ options: ['In Service', 'Down'] } as DefinitionConfig)).toBeNull();
  });

  it('enum-kv constrains default to the options entered', () => {
    const validate = CONFIG_VALIDATORS['enum-kv']!;
    expect(
      validate({ options: ['A', 'B'], default: 'C' } as DefinitionConfig),
    ).toMatch(/must be one of the options/i);
    expect(validate({ options: ['A', 'B'], default: 'B' } as DefinitionConfig)).toBeNull();
    // Absent default is fine — it is optional, not required.
    expect(validate({ options: ['A', 'B'] } as DefinitionConfig)).toBeNull();
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

  it('strips the blank options the draft seeds rather than storing them', () => {
    // enum-kv opens with two empty rows, and a user adding a third may leave it
    // empty; none of those should reach storage as an empty choice.
    const children = serializeConfig('fd', 'enum-kv', {
      options: ['In Service', '  ', 'Down', ''],
    } as DefinitionConfig);
    const options = children.find((c) => c.id === 'fd::cfg::options');
    expect(options?.value).toEqual(['In Service', 'Down']);
  });

  it('materializes an all-blank options row as unset, not as an empty list', () => {
    // The child exists (every knob gets a row — SPEC → *Materialization*) but
    // carries no value, which is a different statement from `[]`: an `enum-kv`
    // with an empty option list cannot be filled in, whereas an unset one has
    // simply not been authored yet.
    const children = serializeConfig('fd', 'enum-kv', { options: ['', ''] } as DefinitionConfig);
    const options = children.find((c) => c.id === 'fd::cfg::options');
    expect(options?.value).toBeNull();
  });

  it('materializes a hidden sub-field that was never filled', () => {
    // `currencyCode` is revealed only under a currency format. `visibleWhen` is an
    // authoring fact and storage stays indifferent to it: the row exists so that
    // switching the format later has something to write into.
    const children = serializeConfig('fd', 'number-kv', {
      unitsSymbol: 'psi',
    } as DefinitionConfig);
    const currency = children.find((c) => c.id === 'fd::cfg::currencyCode');
    expect(currency?.value).toBeNull();
  });

  it('assembles back to a sparse config, so no downstream consumer sees the nulls', () => {
    // Materialization is invisible above the adapter: every reader of a
    // `Definition` view (the mint path, the kv renderers, the lens policy) still
    // gets exactly the keys that were set.
    expect(roundTrip('number-kv', { unitsSymbol: 'psi' } as DefinitionConfig))
      .toEqual({ unitsSymbol: 'psi' });
  });
});
