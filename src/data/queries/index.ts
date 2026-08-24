import type { StorageAdapter, StorageResult } from '../storage/storageAdapter';
import type { IDefinitionQueries, IElementQueries } from './types';

export type { IDefinitionQueries, IElementQueries } from './types';

function unwrap<T>(result: StorageResult<T>): T {
  return result.data;
}

export function elementQueriesFromAdapter(adapter: StorageAdapter): IElementQueries {
  return {
    getRootElements: async () => unwrap(await adapter.listRootElements()),
    getElementById: async (id) => unwrap(await adapter.getElement(id)),
    getChildren: async (parentId) => unwrap(await adapter.listChildElements(parentId)),
    getDeletedChildren: async (parentId) => unwrap(await adapter.listDeletedChildElements(parentId)),
    getChildrenByKind: async (parentId, kind) => unwrap(await adapter.listChildElementsByKind(parentId, kind)),
    getElementHistory: async (elementId) => unwrap(await adapter.getElementHistory(elementId)),
    nextSiblingOrder: async (parentId, kind) => unwrap(await adapter.nextSiblingOrder(parentId, kind)),
  };
}

export function definitionQueriesFromAdapter(adapter: StorageAdapter): IDefinitionQueries {
  return {
    listDefinitions: async () => unwrap(await adapter.listDefinitions()),
    getDefinitionById: async (id) => unwrap(await adapter.getDefinition(id)),
    getDefinitionByLabel: async (label) => {
      const all = unwrap(await adapter.listDefinitions());
      return all.find(d => d.label === label) ?? null;
    },
  };
}

let activeDefinitionQueries: IDefinitionQueries | null = null;
let activeElementQueries: IElementQueries | null = null;

export function getDefinitionQueries(): IDefinitionQueries {
  if (!activeDefinitionQueries) throw new Error('Definition queries not initialized. Call initializeQueries() first.');
  return activeDefinitionQueries;
}

export function getElementQueries(): IElementQueries {
  if (!activeElementQueries) throw new Error('Element queries not initialized. Call initializeQueries() first.');
  return activeElementQueries;
}

export function initializeQueries(adapter: StorageAdapter): void {
  activeDefinitionQueries = definitionQueriesFromAdapter(adapter);
  activeElementQueries = elementQueriesFromAdapter(adapter);
}

export function setDefinitionQueries(q: IDefinitionQueries): void {
  activeDefinitionQueries = q;
}

export function setElementQueries(q: IElementQueries): void {
  activeElementQueries = q;
}

export function resetQueries(): void {
  activeDefinitionQueries = null;
  activeElementQueries = null;
}
