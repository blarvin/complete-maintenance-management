import type { FieldDefinition, Element, ElementHistory, Kind } from '../models';

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
