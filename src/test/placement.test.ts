/**
 * placement — the component-free node-vs-field split (`isReRoot`/`isInline`)
 * that retired the hardcoded `kind === 'node'` checks. Completeness (an entry per
 * kind) is enforced at compile time by `as const satisfies Record<Kind,
 * Placement>`; this asserts the runtime classification.
 */

import { describe, it, expect } from 'vitest';
import { KIND_PLACEMENT, isReRoot, isInline } from '../kinds/placement';

describe('placement', () => {
  it('classifies the node-like kinds as re-root', () => {
    for (const k of ['node', 'org', 'job', 'jobs', 'log-entry', 'logbook', 'library', 'definitions', 'kinds'] as const) {
      expect(isReRoot(k)).toBe(true);
      expect(isInline(k)).toBe(false);
    }
  });

  it('classifies the field-like kinds as inline', () => {
    for (const k of ['text-kv', 'enum-kv', 'number-kv', 'single-image', 'internal-link', 'external-link', 'flag', 'compound', 'string-list'] as const) {
      expect(isInline(k)).toBe(true);
      expect(isReRoot(k)).toBe(false);
    }
  });

  it('only ever holds the two placement values', () => {
    for (const v of Object.values(KIND_PLACEMENT)) {
      expect(['inline', 're-root']).toContain(v);
    }
  });
});
