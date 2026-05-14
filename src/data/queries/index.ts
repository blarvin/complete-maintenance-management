import type { StorageAdapter, StorageResult } from '../storage/storageAdapter';
import type { INodeQueries, IFieldQueries, IFieldDefinitionQueries } from './types';

export type { INodeQueries, IFieldQueries, IFieldDefinitionQueries } from './types';

function unwrap<T>(result: StorageResult<T>): T {
  return result.data;
}

export function nodeQueriesFromAdapter(adapter: StorageAdapter): INodeQueries {
  return {
    getRootNodes: async () => unwrap(await adapter.listRootNodes()),
    getNodeById: async (id) => unwrap(await adapter.getNode(id)),
    getNodeWithChildren: async (id) => {
      const [nodeRes, childRes] = await Promise.all([
        adapter.getNode(id),
        adapter.listChildren(id),
      ]);
      return { node: unwrap(nodeRes), children: unwrap(childRes) };
    },
    getChildren: async (parentId) => unwrap(await adapter.listChildren(parentId)),
  };
}

export function fieldQueriesFromAdapter(adapter: StorageAdapter): IFieldQueries {
  return {
    getFieldsForNode: async (nodeId) => unwrap(await adapter.listFields(nodeId)),
    getFieldHistory: async (fieldId) => unwrap(await adapter.getFieldHistory(fieldId)),
    nextCardOrder: async (nodeId) => unwrap(await adapter.nextCardOrder(nodeId)),
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

let activeNodeQueries: INodeQueries | null = null;
let activeFieldQueries: IFieldQueries | null = null;
let activeFieldDefinitionQueries: IFieldDefinitionQueries | null = null;

export function getNodeQueries(): INodeQueries {
  if (!activeNodeQueries) throw new Error('Node queries not initialized. Call initializeQueries() first.');
  return activeNodeQueries;
}

export function getFieldQueries(): IFieldQueries {
  if (!activeFieldQueries) throw new Error('Field queries not initialized. Call initializeQueries() first.');
  return activeFieldQueries;
}

export function getFieldDefinitionQueries(): IFieldDefinitionQueries {
  if (!activeFieldDefinitionQueries) throw new Error('FieldDefinition queries not initialized. Call initializeQueries() first.');
  return activeFieldDefinitionQueries;
}

export function initializeQueries(adapter: StorageAdapter): void {
  activeNodeQueries = nodeQueriesFromAdapter(adapter);
  activeFieldQueries = fieldQueriesFromAdapter(adapter);
  activeFieldDefinitionQueries = fieldDefinitionQueriesFromAdapter(adapter);
}

export function setNodeQueries(q: INodeQueries): void {
  activeNodeQueries = q;
}

export function setFieldQueries(q: IFieldQueries): void {
  activeFieldQueries = q;
}

export function setFieldDefinitionQueries(q: IFieldDefinitionQueries): void {
  activeFieldDefinitionQueries = q;
}

export function resetQueries(): void {
  activeNodeQueries = null;
  activeFieldQueries = null;
  activeFieldDefinitionQueries = null;
}
