/**
 * capabilityEngine — the rudimentary §6a machinery the node-like kinds read.
 * The capability *descriptors* (SourceSpec / TargetSpec / ProvisionSpec) landed
 * as a declared-only seam (cluster #2); this is their first executor.
 *
 * Query-backed and component-free: every function takes an `IElementQueries` so
 * it's callable from a renderer (via `getElementQueries()`) and unit-testable
 * with a mock. No new adapter method — built on `getChildren` / `getElementById`.
 *
 * **Scope:** the `children` relation (`org`'s rollup, the `jobs` lens) and the
 * `ancestors` relation (inheritance — what the cascade arbiter reads). `edges`
 * (curated membership) is declared on the descriptors but has no consumer yet;
 * it lands with the fuller Edges family (#6c).
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
 * Ancestor walk (`ancestors/*`) — the parent chain above `startId`, **nearest
 * first**. That order is the contract, not an accident: `inherit-unless-override`
 * takes the first ancestor carrying a value, so the caller reads position 0 and
 * stops. `direct` stops at the immediate parent; `transitive` continues to the root.
 *
 * Soft-deleted ancestors are skipped without ending the walk. `getElementById`
 * (unlike `getChildren`) returns deleted rows, and a deleted ancestor is simply not
 * a candidate to inherit from — it must not sever the live grandparent above it.
 * The `seen` set guards against the (shouldn't-happen) cyclic parentId.
 */
export async function gatherAncestors(
    startId: string,
    reach: 'direct' | 'transitive',
    q: IElementQueries,
): Promise<Element[]> {
    const out: Element[] = [];
    const seen = new Set<string>([startId]);
    const start = await q.getElementById(startId);
    let parentId = start?.parentId ?? null;
    while (parentId !== null && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = await q.getElementById(parentId);
        if (!parent) break;
        if (parent.deletedAt === null) out.push(parent);
        if (reach === 'direct') break;
        parentId = parent.parentId;
    }
    return out;
}

/**
 * Resolve a `SourceSpec` gather against `rootId`. `children/direct` = immediate
 * children; `children/transitive` = the whole subtree; `ancestors/*` = the parent
 * chain, nearest first. `edges` throws — declared, no consumer yet (scope note above).
 */
export async function gatherBySource(
    rootId: string,
    source: SourceSpec,
    q: IElementQueries,
): Promise<Element[]> {
    switch (source.relation) {
        case 'children':
            return source.reach === 'direct' ? q.getChildren(rootId) : gatherDescendants(rootId, q);
        case 'ancestors':
            return gatherAncestors(rootId, source.reach, q);
        default:
            throw new Error(
                `capabilityEngine: '${source.relation}' traversal not implemented (needs the Edges family)`,
            );
    }
}

/**
 * The `Edges(internal, live)` resolver — fetch the target Element by id, live.
 * `revision` pinning and `external` (url) edges are later (#6c).
 */
export async function resolveEdge(targetId: string, q: IElementQueries): Promise<Element | null> {
    return q.getElementById(targetId);
}
