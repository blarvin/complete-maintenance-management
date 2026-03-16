/**
 * Data Services - Legacy interfaces (deprecated).
 *
 * All production code now uses:
 * - getCommandBus().execute() for writes (src/data/commands/)
 * - getNodeQueries() / getFieldQueries() for reads (src/data/queries/)
 *
 * These interfaces are kept for type compatibility only.
 * CreateNodeInput is re-exported from commands/types.ts.
 */

import type { TreeNode, DataField, DataFieldHistory } from '../models';

// ============================================================================
// TYPE RE-EXPORTS (backward compat)
// ============================================================================

/** @deprecated Use CreateNodeInput from '../commands/types' instead */
export type { CreateNodeInput } from '../commands/types';

/** @deprecated Use getCommandBus() for writes and getNodeQueries() for reads */
export interface INodeService {
    getRootNodes(): Promise<TreeNode[]>;
    getNodeById(id: string): Promise<TreeNode | null>;
    getNodeWithChildren(id: string): Promise<{ node: TreeNode | null; children: TreeNode[] }>;
    getChildren(parentId: string): Promise<TreeNode[]>;
    createWithFields(input: import('../commands/types').CreateNodeInput): Promise<void>;
    createEmptyNode(id: string, parentId: string | null): Promise<TreeNode>;
    updateNode(id: string, updates: { nodeName?: string; nodeSubtitle?: string }): Promise<void>;
    deleteNode(id: string): Promise<void>;
}

/** @deprecated Use getCommandBus() for writes and getFieldQueries() for reads */
export interface IFieldService {
    getFieldsForNode(nodeId: string): Promise<DataField[]>;
    nextCardOrder(nodeId: string): Promise<number>;
    addField(nodeId: string, fieldName: string, fieldValue: string | null, cardOrder?: number): Promise<DataField>;
    updateFieldValue(fieldId: string, newValue: string | null): Promise<void>;
    deleteField(fieldId: string): Promise<void>;
    getFieldHistory(fieldId: string): Promise<DataFieldHistory[]>;
}
