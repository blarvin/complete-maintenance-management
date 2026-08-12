/**
 * childrenPolicy — the component-free read of each kind's `children` capability
 * (`childrenSpec.allowedKinds`), the first consumer of that allowlist (chrome
 * entailment #5). Drives which re-root kinds the create surface offers and whether
 * a kind bears a DataCard. Asserts the runtime classification; the registry-side
 * filter (`reRootCreateKindsFor`) is the trivial intersection of this with the
 * node-create re-root kinds, validated by typecheck + the manual flow.
 */

import { describe, it, expect } from 'vitest';
import { allowedChildKinds, canHaveChildren, isLensSurfaced } from '../kinds/childrenPolicy';

describe('allowedChildKinds', () => {
  it('admits node/org/job under the open containers (node, org)', () => {
    for (const parent of ['node', 'org'] as const) {
      const allowed = allowedChildKinds(parent);
      expect(allowed).toContain('node');
      expect(allowed).toContain('org');
      expect(allowed).toContain('job');
    }
  });

  it('admits node but NOT org, and NOT a sub-job, under a job', () => {
    // Sub-jobs decided against 2026-08-12 (ELEMENT-MODEL §job): nothing ever minted
    // one — LensCreate parents every job to the lens's owning node — and a nested job
    // would have double-counted in every ancestor's Jobs rollup.
    const allowed = allowedChildKinds('job');
    expect(allowed).toContain('node');
    expect(allowed).not.toContain('org');
    expect(allowed).not.toContain('job');
  });

  it('admits field kinds but no re-root kinds under the hybrid Jobs container (jobs)', () => {
    // The Jobs container owns its own DataFields (field kinds); sub-assets don't
    // belong directly in it and jobs arrive via Derivation, not as direct children.
    const allowed = allowedChildKinds('jobs');
    expect(allowed).toContain('text-kv');
    expect(allowed).not.toContain('node');
    expect(allowed).not.toContain('job');
  });
});

describe('canHaveChildren', () => {
  it('is true for the open containers, incl. the hybrid Jobs container (jobs)', () => {
    for (const k of ['node', 'org', 'job', 'jobs'] as const) {
      expect(canHaveChildren(k)).toBe(true);
    }
  });

  it('is false for field-like kinds (no children capability)', () => {
    for (const k of ['text-kv', 'asset-doc'] as const) {
      expect(canHaveChildren(k)).toBe(false);
    }
  });
});

describe('isLensSurfaced', () => {
  it('is true for a kind targeted by a lens (job → jobs, log-entry → logbook)', () => {
    expect(isLensSurfaced('job')).toBe(true);
    expect(isLensSurfaced('log-entry')).toBe(true);
  });

  it('is false for the lens containers, the untyped rollup, and ordinary kinds', () => {
    // `jobs`/`logbook` are the lens containers (they declare a targetKind, they are
    // not one); `org`'s derivation is untyped (no targetKind); `node`/field kinds are
    // not surfaced in any lens.
    for (const k of ['jobs', 'logbook', 'org', 'node', 'text-kv'] as const) {
      expect(isLensSurfaced(k)).toBe(false);
    }
  });
});
