/**
 * Capability coherence — every kind's composed capability subset must be coherent
 * (SPEC §589). This is the teeth on the capability seam: a future kind that
 * composes an incoherent subset fails here, in CI, before any consumer reads the
 * capability.
 *
 * Reads `KIND_CAPABILITIES` (pure data) rather than the registry, which would pull
 * in the `.tsx` renderers — `vitest.config.ts` has no Solid JSX transform
 * (project convention: no components in unit tests). The `satisfies
 * Record<Kind, CapabilitySet>` on that map guarantees an entry for every kind, so
 * iterating it covers the whole registry.
 */

import { describe, it, expect } from 'vitest';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { checkCoherence, KIND_COHERENCE } from '../kinds/coherence';
import type { CapabilitySet } from '../kinds/types';
import type { Kind } from '../data/models';

const ENTRIES = Object.entries(KIND_CAPABILITIES) as [Kind, CapabilitySet][];

describe('KIND_CAPABILITIES coherence', () => {
  it('declares a capability subset for at least the eight seam kinds', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(ENTRIES)('kind "%s" composes a coherent capability subset', (kind, caps) => {
    // Passing `kind` is what makes a per-kind KIND_COHERENCE rule run at all.
    expect(checkCoherence(caps, kind).errors).toEqual([]);
  });
});

describe('per-kind coherence overrides', () => {
  it('a per-kind rule actually fires and adds to the global errors', () => {
    // The wire itself, proven without committing a real rule: register one against a
    // kind, check it reaches the report, and take it back out.
    const rule = (caps: CapabilitySet) => (caps.container === 'physical' ? ['nope'] : []);
    KIND_COHERENCE.node = rule;
    try {
      expect(checkCoherence(KIND_CAPABILITIES.node, 'node').errors).toContain('nope');
      // …and is skipped when the caller checks a bare subset with no kind.
      expect(checkCoherence(KIND_CAPABILITIES.node).errors).toEqual([]);
    } finally {
      delete KIND_COHERENCE.node;
    }
  });
});
