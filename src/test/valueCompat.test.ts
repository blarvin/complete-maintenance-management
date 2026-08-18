/**
 * `acceptsValue` / `valueForKind` — the guard on carrying a drafted value across
 * a kind change in the Add Surface.
 *
 * The point of the module is that this is answered from `ValueSpec.runtime`
 * rather than a switch, so the last suite here is the one that matters: every
 * kind the Add Surface can draft has to be classified, or the guard is guessing.
 *
 * Imports only component-free modules, per testing conventions.
 */

import { describe, it, expect } from 'vitest';
import { acceptsValue, valueForKind } from '../kinds/valueCompat';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { kindsMintedVia } from '../kinds/mintVia';
import type { Kind } from '../data/models';
import type { CapabilitySet } from '../kinds/types';

describe('acceptsValue', () => {
  it('accepts null for every kind — an empty field is always renderable', () => {
    for (const kind of Object.keys(KIND_CAPABILITIES) as Kind[]) {
      expect(acceptsValue(kind, null), kind).toBe(true);
    }
  });

  it('matches a scalar value against the declared runtime, not the shape', () => {
    // text-kv, enum-kv and number-kv are all `shape: 'scalar'` — the whole
    // reason `runtime` exists is that shape cannot separate them.
    expect(acceptsValue('text-kv', 'psi')).toBe(true);
    expect(acceptsValue('enum-kv', 'psi')).toBe(true);
    expect(acceptsValue('number-kv', 'psi')).toBe(false);

    expect(acceptsValue('number-kv', 42)).toBe(true);
    expect(acceptsValue('text-kv', 42)).toBe(false);
  });

  it('accepts the stored object for an Edge-valued kind, which has no ownValue', () => {
    expect(acceptsValue('external-link', { url: 'https://example.com' })).toBe(true);
    expect(acceptsValue('internal-link', { targetId: 'el_1' })).toBe(true);
    expect(acceptsValue('external-link', 'https://example.com')).toBe(false);
  });

  it('accepts nothing for a kind that bears no value at all', () => {
    expect(acceptsValue('node', 'anything')).toBe(false);
    expect(acceptsValue('node', 42)).toBe(false);
  });
});

describe('valueForKind', () => {
  it('carries a compatible value through a kind change', () => {
    // The move the SPEC calls out: the entered value survives text → enum.
    expect(valueForKind('In Service', 'enum-kv')).toBe('In Service');
  });

  it('drops an incompatible one rather than handing it to the renderer', () => {
    // This is the crash it exists to prevent: NumberKvField calling toFixed
    // on a string carried over from a text draft.
    expect(valueForKind('In Service', 'number-kv')).toBeNull();
    expect(valueForKind(42, 'text-kv')).toBeNull();
  });
});

describe('every draftable kind is classified', () => {
  it('declares a runtime or an edges descriptor for each add-surface kind', () => {
    // A kind reachable from the Add Surface's Kind band can receive a carried
    // value, so it must be able to answer. `ValueSpec.runtime` being required
    // enforces the ownValue half at compile time; this covers the rest.
    for (const kind of kindsMintedVia('add-surface')) {
      const caps = KIND_CAPABILITIES[kind] as CapabilitySet;
      expect(!!caps.ownValue || !!caps.edges, `${kind} bears no value descriptor`).toBe(true);
    }
  });
});
