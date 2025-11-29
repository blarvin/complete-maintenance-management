import { createNode } from "../repo/treeNodes";
import { addField } from "../repo/dataFields";
import { generateId } from "../../utils/id";

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
    await createNode({ id: input.id, nodeName: input.nodeName || "Untitled", nodeSubtitle: input.nodeSubtitle || "", parentId: null });
    for (const f of input.defaults) {
        await addField({ id: generateId(), fieldName: f.fieldName, parentNodeId: input.id, fieldValue: f.fieldValue ?? null });
    }
}

export async function createChildNodeWithDefaultFields(input: CreateChildNodeInput) {
    await createNode({ id: input.id, nodeName: input.nodeName || "Untitled", nodeSubtitle: input.nodeSubtitle || "", parentId: input.parentId });
    for (const f of input.defaults) {
        await addField({ id: generateId(), fieldName: f.fieldName, parentNodeId: input.id, fieldValue: f.fieldValue ?? null });
    }
}


