/**
 * capabilityEngine — the rudimentary §6a machinery the node-like kinds read.
 * The capability *descriptors* (SourceSpec / TargetSpec / ProvisionSpec) landed
 * as a declared-only seam (cluster #2); this is their first executor.
 *
 * Query-backed and component-free: every function takes an `IElementQueries` so
 * it's callable from a renderer (via `getElementQueries()`) and unit-testable
 * with a mock. No new adapter method — built on `getChildren` / `getElementById`.
 *
 * **v1 scope:** the `children` relation only (`org`'s rollup, the `jobs` lens).
 * `ancestors` (inheritance) and `edges` (curated membership) traversal are
 * declared on the descriptors but not implemented yet — they land with the
 * cascade arbiter (#7) and the fuller Edges family (#6c).
 */

import type { Element } from '../models';
import type { IElementQueries } from '../queries/types';
import type { SourceSpec } from '../../kinds/types';

/**
 * Transitive children walk (`children/transitive`) — the single gather every
 * Derivation kind reads. BFS over `getChildren` (which already excludes deleted
 * rows). The `seen` set guards against the (shouldn't-happen) cyclic parentId.
 */
export async function gatherDescendants(rootId: string, q: IElementQueries): Promise<Element[]> {
    const out: Element[] = [];
    const seen = new Set<string>([rootId]);
    const queue: string[] = [rootId];
    while (queue.length > 0) {
        const id = queue.shift() as string;
        const children = await q.getChildren(id);
        for (const child of children) {
            if (seen.has(child.id)) continue;
            seen.add(child.id);
            out.push(child);
            queue.push(child.id);
        }
    }
    return out;
}

/**
 * Resolve a `SourceSpec` gather against `rootId`. `children/direct` = immediate
 * children; `children/transitive` = the whole subtree. `ancestors`/`edges` throw
 * — declared, not yet built (see scope note above).
 */
export async function gatherBySource(
    rootId: string,
    source: SourceSpec,
    q: IElementQueries,
): Promise<Element[]> {
    if (source.relation !== 'children') {
        throw new Error(
            `capabilityEngine: '${source.relation}' traversal not implemented (v1: children only)`,
        );
    }
    return source.reach === 'direct' ? q.getChildren(rootId) : gatherDescendants(rootId, q);
}

/**
 * The `Edges(internal, live)` resolver — fetch the target Element by id, live.
 * `revision` pinning and `external` (url) edges are later (#6c).
 */
export async function resolveEdge(targetId: string, q: IElementQueries): Promise<Element | null> {
    return q.getElementById(targetId);
}
