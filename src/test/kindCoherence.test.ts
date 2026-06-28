/**
 * Capability coherence — every kind's composed capability subset must be coherent
 * (SPEC §589). This is the teeth on the capability seam: a future kind that
 * composes an incoherent subset fails here, in CI, before any consumer reads the
 * capability.
 *
 * Reads `KIND_CAPABILITIES` (pure data) rather than the registry, which would pull
 * in the Qwik renderer `component$`s the optimizer doesn't transform under Vitest
 * (project convention: no Qwik components in unit tests). The `satisfies
 * Record<Kind, CapabilitySet>` on that map guarantees an entry for every kind, so
 * iterating it covers the whole registry.
 */

import { describe, it, expect } from 'vitest';
import { KIND_CAPABILITIES } from '../kinds/capabilities';
import { checkCoherence } from '../kinds/coherence';

const ENTRIES = Object.entries(KIND_CAPABILITIES);

describe('KIND_CAPABILITIES coherence', () => {
  it('declares a capability subset for at least the eight seam kinds', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(ENTRIES)('kind "%s" composes a coherent capability subset', (_kind, caps) => {
    expect(checkCoherence(caps).errors).toEqual([]);
  });
});
