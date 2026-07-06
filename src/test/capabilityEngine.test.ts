/**
 * capabilityEngine — the §6a gather/resolve machinery the node-like kinds read.
 * Tested against an in-memory `IElementQueries` mock (pure, no IDB): exercises
 * the transitive `children` traversal, the SourceSpec direct/transitive switch,
 * the lens's target-kind filter, the Edges resolver, and the not-yet-built
 * `ancestors`/`edges` relations.
 */

import { describe, it, expect } from 'vitest';
import { gatherDescendants, gatherBySource, resolveEdge } from '../data/services/capabilityEngine';
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

  it('ancestors / edges traversal is declared but not yet implemented', async () => {
    const q = mockQueries(TREE);
    await expect(gatherBySource('relay', { relation: 'ancestors', reach: 'transitive' }, q)).rejects.toThrow(/not implemented/);
    await expect(gatherBySource('relay', { relation: 'edges', reach: 'direct' }, q)).rejects.toThrow(/not implemented/);
  });
});
