/**
 * Node creation service - creates nodes with default fields.
 * Unified function handles both root and child nodes.
 */

import { createNode } from "../repo/treeNodes";
import { addField } from "../repo/dataFields";
import { generateId } from "../../utils/id";

export type CreateNodeInput = {
    id: string;
    parentId?: string | null;  // null/undefined = root node
    nodeName: string;
    nodeSubtitle: string;
    defaults: { fieldName: string; fieldValue: string | null }[];
};

/**
 * Creates a node with default fields.
 * - If parentId is null/undefined, creates a root node
 * - If parentId is provided, creates a child node
 * - Fields are created in parallel for better performance
 */
export async function createNodeWithDefaultFields(input: CreateNodeInput) {
    await createNode({
        id: input.id,
        nodeName: input.nodeName || "Untitled",
        nodeSubtitle: input.nodeSubtitle || "",
        parentId: input.parentId ?? null,
    });

    // Create fields in parallel
    await Promise.all(
        input.defaults.map((f) =>
            addField({
                id: generateId(),
                fieldName: f.fieldName,
                parentNodeId: input.id,
                fieldValue: f.fieldValue ?? null,
            })
        )
    );
}

// Legacy exports for backwards compatibility (used by existing views)
export type CreateRootNodeInput = {
    id: string;
    nodeName: string;
    nodeSubtitle: string;
    defaults: { fieldName: string; fieldValue: string | null }[];
};

export type CreateChildNodeInput = {
    id: string;
    parentId: string;
    nodeName: string;
    nodeSubtitle: string;
    defaults: { fieldName: string; fieldValue: string | null }[];
};

export async function createRootNodeWithDefaultFields(input: CreateRootNodeInput) {
    return createNodeWithDefaultFields({ ...input, parentId: null });
}

export async function createChildNodeWithDefaultFields(input: CreateChildNodeInput) {
    return createNodeWithDefaultFields(input);
}
