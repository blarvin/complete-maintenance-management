/**
 * childrenPolicy — the component-free read of each kind's `children` capability
 * (`childrenSpec.allowedKinds`), the first consumer of that allowlist (chrome
 * entailment #5). Drives which re-root kinds the create surface offers and whether
 * a kind bears a DataCard. Asserts the runtime classification; the registry-side
 * filter (`reRootCreateKindsFor`) is the trivial intersection of this with the
 * node-create re-root kinds, validated by typecheck + the manual flow.
 */

import { describe, it, expect } from 'vitest';
import { allowedChildKinds, canHaveChildren } from '../kinds/childrenPolicy';

describe('allowedChildKinds', () => {
  it('admits node/org/job under the open containers (node, org)', () => {
    for (const parent of ['node', 'org'] as const) {
      const allowed = allowedChildKinds(parent);
      expect(allowed).toContain('node');
      expect(allowed).toContain('org');
      expect(allowed).toContain('job');
    }
  });

  it('admits node/job but NOT org under a job', () => {
    const allowed = allowedChildKinds('job');
    expect(allowed).toContain('node');
    expect(allowed).toContain('job');
    expect(allowed).not.toContain('org');
  });

  it('admits nothing under a content-free lens (jobs)', () => {
    expect(allowedChildKinds('jobs')).toEqual([]);
  });
});

describe('canHaveChildren', () => {
  it('is true for the open containers', () => {
    for (const k of ['node', 'org', 'job'] as const) {
      expect(canHaveChildren(k)).toBe(true);
    }
  });

  it('is false for the lens and for field-like kinds (no children capability)', () => {
    for (const k of ['jobs', 'text-kv', 'asset-doc'] as const) {
      expect(canHaveChildren(k)).toBe(false);
    }
  });
});
