/**
 * In-memory node index used for synchronous navigation helpers.
 * Keeps only the minimal fields required for breadcrumbs/path computation.
 */

import type { TreeNode } from './models';

export type NodeSummary = {
    id: string;
    parentId: string | null;
    nodeName: string;
};

const nodeMap = new Map<string, NodeSummary>();

/**
 * Fully rebuild the node index using the provided nodes.
 * Only active (non-deleted) nodes should be supplied.
 */
export function initializeNodeIndex(nodes: Pick<TreeNode, 'id' | 'parentId' | 'nodeName'>[]): void {
    nodeMap.clear();
    for (const node of nodes) {
        nodeMap.set(node.id, {
            id: node.id,
            parentId: node.parentId,
            nodeName: node.nodeName,
        });
    }
}

/**
 * Insert or update a node summary in O(1).
 */
export function upsertNodeSummary(summary: NodeSummary): void {
    nodeMap.set(summary.id, summary);
}

/**
 * Remove a node from the index in O(1).
 */
export function removeNodeSummary(nodeId: string): void {
    nodeMap.delete(nodeId);
}

/**
 * Reset the index. Useful for tests or complete re-hydration.
 */
export function clearNodeIndex(): void {
    nodeMap.clear();
}

/**
 * Compute the ancestor path synchronously by following parent pointers.
 * Returns the path ordered from root → current node.
 */
export function getAncestorPath(nodeId: string): Array<{ id: string; name: string }> {
    const path: Array<{ id: string; name: string }> = [];
    const visited = new Set<string>();

    let currentId: string | null = nodeId;
    while (currentId) {
        if (visited.has(currentId)) {
            // Defensive guard against accidental cycles.
            break;
        }
        visited.add(currentId);

        const summary = nodeMap.get(currentId);
        if (!summary) {
            break;
        }

        path.unshift({
            id: summary.id,
            name: summary.nodeName,
        });

        currentId = summary.parentId;
    }

    return path;
}
