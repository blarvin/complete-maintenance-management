/**
 * capabilityEngine — the §6a gather/resolve machinery the node-like kinds read.
 * Tested against an in-memory `IElementQueries` mock (pure, no IDB): exercises
 * the transitive `children` traversal, the SourceSpec direct/transitive switch,
 * the lens's target-kind filter, the Edges resolver, the `ancestors` walk the
 * cascade reads, and the not-yet-built `edges` relation.
 */

import { describe, it, expect } from 'vitest';
import {
  gatherDescendants,
  gatherAncestors,
  gatherBySource,
  gatherByDerivation,
  resolveEdge,
} from '../data/services/capabilityEngine';
import type { Element, Kind } from '../data/models';
import type { IElementQueries } from '../data/queries/types';

const el = (id: string, parentId: string | null, kind: Kind = 'node'): Element => ({
  id,
  kind,
  name: id,
  subtitle: null,
  value: null,
  parentId,
  siblingOrder: 0,
  definitionId: null,
  treeType: 'business',
  updatedBy: 'localUser',
  updatedAt: 0,
  deletedAt: null,
});

function mockQueries(els: Element[]): IElementQueries {
  const byId = new Map(els.map((e) => [e.id, e]));
  return {
    getRootElements: async () => els.filter((e) => e.parentId === null),
    getElementById: async (id) => byId.get(id) ?? null,
    getChildren: async (pid) => els.filter((e) => e.parentId === pid),
    getChildrenByKind: async (pid, kind) => els.filter((e) => e.parentId === pid && e.kind === kind),
    getElementHistory: async () => [],
    nextSiblingOrder: async () => 0,
  };
}

// root → a → relay → job1 ; root → b(org) → job2
const TREE = [
  el('root', null),
  el('a', 'root'),
  el('relay', 'a'),
  el('job1', 'relay', 'job'),
  el('b', 'root', 'org'),
  el('job2', 'b', 'job'),
];

describe('capabilityEngine', () => {
  it('gatherDescendants walks the whole subtree (children/transitive)', async () => {
    const q = mockQueries(TREE);
    const ids = (await gatherDescendants('root', q)).map((e) => e.id).sort();
    expect(ids).toEqual(['a', 'b', 'job1', 'job2', 'relay']);
  });

  it('gatherBySource direct = immediate children, transitive = whole subtree', async () => {
    const q = mockQueries(TREE);
    const direct = await gatherBySource('root', { relation: 'children', reach: 'direct' }, q);
    expect(direct.map((e) => e.id).sort()).toEqual(['a', 'b']);
    const transitive = await gatherBySource('root', { relation: 'children', reach: 'transitive' }, q);
    expect(transitive).toHaveLength(5);
  });

  it('the lens filters the gather to its target kind (→ job)', async () => {
    const q = mockQueries(TREE);
    const jobs = (await gatherDescendants('root', q)).filter((e) => e.kind === 'job');
    expect(jobs.map((e) => e.id).sort()).toEqual(['job1', 'job2']);
  });

  it('resolveEdge fetches the target element live', async () => {
    const q = mockQueries(TREE);
    expect((await resolveEdge('relay', q))?.id).toBe('relay');
    expect(await resolveEdge('missing', q)).toBeNull();
  });

  it('edges traversal is declared but not yet implemented', async () => {
    const q = mockQueries(TREE);
    await expect(gatherBySource('relay', { relation: 'edges', reach: 'direct' }, q)).rejects.toThrow(/not implemented/);
  });
});

describe('capabilityEngine — gatherByDerivation', () => {
  it('applies both halves: the source traversal and the targetKind filter', async () => {
    const q = mockQueries(TREE);
    const jobs = await gatherByDerivation(
      'root',
      { source: { relation: 'children', reach: 'transitive' }, targetKind: 'job' },
      q,
    );
    expect(jobs.map((e) => e.id).sort()).toEqual(['job1', 'job2']);
  });

  it('an untyped derivation (no targetKind) keeps everything gathered', async () => {
    const q = mockQueries(TREE);
    const all = await gatherByDerivation('root', { source: { relation: 'children', reach: 'transitive' } }, q);
    expect(all).toHaveLength(5);
  });

  it('honours the declared source rather than assuming children/transitive', async () => {
    const q = mockQueries(TREE);
    const direct = await gatherByDerivation('root', { source: { relation: 'children', reach: 'direct' } }, q);
    expect(direct.map((e) => e.id).sort()).toEqual(['a', 'b']);
    const up = await gatherByDerivation('job1', { source: { relation: 'ancestors', reach: 'transitive' } }, q);
    expect(up.map((e) => e.id)).toEqual(['relay', 'a', 'root']);
  });
});

describe('capabilityEngine — ancestors', () => {
  it('transitive walks parent → root, nearest first', async () => {
    const q = mockQueries(TREE);
    const chain = await gatherAncestors('job1', 'transitive', q);
    // Order is the contract: inherit-unless-override takes the first with a value.
    expect(chain.map((e) => e.id)).toEqual(['relay', 'a', 'root']);
  });

  it('direct stops at the immediate parent', async () => {
    const q = mockQueries(TREE);
    const chain = await gatherAncestors('job1', 'direct', q);
    expect(chain.map((e) => e.id)).toEqual(['relay']);
  });

  it('a root element has no ancestors, and an unknown id yields none', async () => {
    const q = mockQueries(TREE);
    expect(await gatherAncestors('root', 'transitive', q)).toEqual([]);
    expect(await gatherAncestors('nope', 'transitive', q)).toEqual([]);
  });

  it('skips a soft-deleted ancestor without severing the chain above it', async () => {
    // `getElementById` returns deleted rows (unlike `getChildren`), so the walk has
    // to drop them explicitly — and keep climbing to the live grandparent.
    const deletedMiddle = { ...el('a', 'root'), deletedAt: 1 };
    const q = mockQueries([el('root', null), deletedMiddle, el('relay', 'a')]);
    const chain = await gatherAncestors('relay', 'transitive', q);
    expect(chain.map((e) => e.id)).toEqual(['root']);
  });

  it('a cyclic parentId terminates instead of hanging', async () => {
    const q = mockQueries([el('x', 'y'), el('y', 'x')]);
    const chain = await gatherAncestors('x', 'transitive', q);
    expect(chain.map((e) => e.id)).toEqual(['y']);
  });

  it('gatherBySource routes the ancestors relation', async () => {
    const q = mockQueries(TREE);
    const chain = await gatherBySource('job1', { relation: 'ancestors', reach: 'transitive' }, q);
    expect(chain.map((e) => e.id)).toEqual(['relay', 'a', 'root']);
  });
});
