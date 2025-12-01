/**
 * Node Service - High-level operations for TreeNodes.
 * Abstracts the repo layer so components don't depend on Firestore directly.
 */

import { getNodeById, listRootNodes, listChildren } from '../repo/treeNodes';
import type { TreeNode } from '../models';

export const nodeService = {
    /**
     * Get all root nodes (nodes with parentId = null).
     * Used by RootView to display top-level assets.
     */
    getRootNodes: (): Promise<TreeNode[]> => listRootNodes(),

    /**
     * Get a single node by ID.
     * Returns null if not found.
     */
    getNodeById: (id: string): Promise<TreeNode | null> => getNodeById(id),

    /**
     * Get a node and its children in parallel.
     * Used by BranchView to load parent + children efficiently.
     */
    getNodeWithChildren: async (id: string): Promise<{ node: TreeNode | null; children: TreeNode[] }> => {
        const [node, children] = await Promise.all([
            getNodeById(id),
            listChildren(id),
        ]);
        return { node, children };
    },

    /**
     * Get children of a node.
     * Returns empty array if node has no children.
     */
    getChildren: (parentId: string): Promise<TreeNode[]> => listChildren(parentId),
};

