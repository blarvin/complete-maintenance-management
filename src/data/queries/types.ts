import type { TreeNode, DataField, DataFieldHistory } from '../models';

export interface INodeQueries {
  getRootNodes(): Promise<TreeNode[]>;
  getNodeById(id: string): Promise<TreeNode | null>;
  getNodeWithChildren(id: string): Promise<{ node: TreeNode | null; children: TreeNode[] }>;
  getChildren(parentId: string): Promise<TreeNode[]>;
}

export interface IFieldQueries {
  getFieldsForNode(nodeId: string): Promise<DataField[]>;
  getFieldHistory(fieldId: string): Promise<DataFieldHistory[]>;
  nextCardOrder(nodeId: string): Promise<number>;
}
