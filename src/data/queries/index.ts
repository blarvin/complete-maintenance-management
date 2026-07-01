import type { StorageAdapter, StorageResult } from '../storage/storageAdapter';
import type { IFieldDefinitionQueries, IElementQueries } from './types';

export type { IFieldDefinitionQueries, IElementQueries } from './types';

function unwrap<T>(result: StorageResult<T>): T {
  return result.data;
}

export function elementQueriesFromAdapter(adapter: StorageAdapter): IElementQueries {
  return {
    getRootElements: async () => unwrap(await adapter.listRootElements()),
    getElementById: async (id) => unwrap(await adapter.getElement(id)),
    getChildren: async (parentId) => unwrap(await adapter.listChildElements(parentId)),
    getChildrenByKind: async (parentId, kind) => unwrap(await adapter.listChildElementsByKind(parentId, kind)),
    getElementHistory: async (elementId) => unwrap(await adapter.getElementHistory(elementId)),
    nextSiblingOrder: async (parentId, kind) => unwrap(await adapter.nextSiblingOrder(parentId, kind)),
  };
}

export function fieldDefinitionQueriesFromAdapter(adapter: StorageAdapter): IFieldDefinitionQueries {
  return {
    listFieldDefinitions: async () => unwrap(await adapter.listFieldDefinitions()),
    getFieldDefinitionById: async (id) => unwrap(await adapter.getFieldDefinition(id)),
    getFieldDefinitionByLabel: async (label) => {
      const all = unwrap(await adapter.listFieldDefinitions());
      return all.find(d => d.label === label) ?? null;
    },
  };
}

let activeFieldDefinitionQueries: IFieldDefinitionQueries | null = null;
let activeElementQueries: IElementQueries | null = null;

export function getFieldDefinitionQueries(): IFieldDefinitionQueries {
  if (!activeFieldDefinitionQueries) throw new Error('FieldDefinition queries not initialized. Call initializeQueries() first.');
  return activeFieldDefinitionQueries;
}

export function getElementQueries(): IElementQueries {
  if (!activeElementQueries) throw new Error('Element queries not initialized. Call initializeQueries() first.');
  return activeElementQueries;
}

export function initializeQueries(adapter: StorageAdapter): void {
  activeFieldDefinitionQueries = fieldDefinitionQueriesFromAdapter(adapter);
  activeElementQueries = elementQueriesFromAdapter(adapter);
}

export function setFieldDefinitionQueries(q: IFieldDefinitionQueries): void {
  activeFieldDefinitionQueries = q;
}

export function setElementQueries(q: IElementQueries): void {
  activeElementQueries = q;
}

export function resetQueries(): void {
  activeFieldDefinitionQueries = null;
  activeElementQueries = null;
}
