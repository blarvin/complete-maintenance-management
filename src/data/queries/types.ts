import type { TreeNode, DataField, DataFieldHistory, FieldDefinition, Element, ElementHistory, Kind } from '../models';

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

export interface IFieldDefinitionQueries {
  listFieldDefinitions(): Promise<FieldDefinition[]>;
  getFieldDefinitionById(id: string): Promise<FieldDefinition | null>;
  getFieldDefinitionByLabel(label: string): Promise<FieldDefinition | null>;
}

export interface IElementQueries {
  getRootElements(): Promise<Element[]>;
  getElementById(id: string): Promise<Element | null>;
  getChildren(parentId: string): Promise<Element[]>;
  getChildrenByKind(parentId: string, kind: Kind): Promise<Element[]>;
  getElementHistory(elementId: string): Promise<ElementHistory[]>;
  nextSiblingOrder(parentId: string | null): Promise<number>;
}
