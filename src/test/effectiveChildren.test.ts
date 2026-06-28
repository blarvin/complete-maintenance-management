/**
 * Tests for the effectiveChildren read chokepoint (src/data/effectiveChildren.ts).
 * Phase 1 is a pass-through (no per-viewer overlays exist yet), so this pins the
 * identity contract: same contents, same order, same references — the overlay
 * merge will replace the body later.
 */

import { describe, it, expect } from 'vitest';
import type { Element } from '../data/models';
import { effectiveChildren } from '../data/effectiveChildren';

function makeElement(id: string, siblingOrder: number): Element {
  return {
    id,
    kind: 'node',
    name: `node-${id}`,
    subtitle: null,
    value: null,
    parentId: 'parent',
    siblingOrder,
    fieldDefinitionId: null,
    treeType: 'business',
    updatedBy: 'localUser',
    updatedAt: 0,
    deletedAt: null,
  };
}

describe('effectiveChildren', () => {
  it('returns the canonical children unchanged (same order and contents)', () => {
    const canonical = [makeElement('a', 0), makeElement('b', 1), makeElement('c', 2)];
    const result = effectiveChildren(canonical, 'localUser');
    expect(result).toEqual(canonical);
    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not reorder by viewer (no personal siblingOrder overlay in Phase 1)', () => {
    const canonical = [makeElement('x', 5), makeElement('y', 1)];
    const result = effectiveChildren(canonical, 'someOtherViewer');
    // Pass-through preserves input order — it does not sort.
    expect(result.map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('handles an empty child list', () => {
    expect(effectiveChildren([], 'localUser')).toEqual([]);
  });
});
