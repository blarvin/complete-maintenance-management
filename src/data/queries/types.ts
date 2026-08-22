import type { Definition, Element, ElementHistory, Kind } from '../models';

export interface IDefinitionQueries {
  listDefinitions(): Promise<Definition[]>;
  getDefinitionById(id: string): Promise<Definition | null>;
  getDefinitionByLabel(label: string): Promise<Definition | null>;
}

export interface IElementQueries {
  getRootElements(): Promise<Element[]>;
  getElementById(id: string): Promise<Element | null>;
  getChildren(parentId: string): Promise<Element[]>;
  /** Soft-deleted children only, newest tombstone first. Read by the restore list. */
  getDeletedChildren(parentId: string): Promise<Element[]>;
  getChildrenByKind(parentId: string, kind: Kind): Promise<Element[]>;
  getElementHistory(elementId: string): Promise<ElementHistory[]>;
  nextSiblingOrder(parentId: string | null, kind?: Kind): Promise<number>;
}
