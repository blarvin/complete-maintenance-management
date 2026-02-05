/**
 * Data Services - Unified export for all data operations.
 *
 * This module provides the abstraction layer for data access.
 * Components import from here, not from concrete implementations.
 *
 * OFFLINE-FIRST ARCHITECTURE:
 * - IDBAdapter (IndexedDB) is the PRIMARY storage
 * - All reads/writes go to IDB first
 * - SyncManager handles bidirectional sync with Firestore in background
 * - App works fully offline, syncs when online
 *
 * For swapping implementations (testing, different backends):
 * - Use setNodeService() and setFieldService() before app initialization
 * - Or use module mocking in tests
 *
 * This pattern works with Qwik because:
 * - Services are imported, not passed through context
 * - No function objects need to be serialized in closures
 * - The abstraction (interfaces) is maintained for DIP compliance
 */

import type { TreeNode, DataField, DataFieldHistory } from '../models';
import type { StorageAdapter, StorageResult } from '../storage/storageAdapter';
import { generateId } from '../../utils/id';

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export type CreateNodeInput = {
    id: string;
    parentId: string | null;
    nodeName: string;
    nodeSubtitle: string;
    defaults: { fieldName: string; fieldValue: string | null }[];
};

export interface INodeService {
    getRootNodes(): Promise<TreeNode[]>;
    getNodeById(id: string): Promise<TreeNode | null>;
    getNodeWithChildren(id: string): Promise<{ node: TreeNode | null; children: TreeNode[] }>;
    getChildren(parentId: string): Promise<TreeNode[]>;
    createWithFields(input: CreateNodeInput): Promise<void>;
    createEmptyNode(id: string, parentId: string | null): Promise<TreeNode>;
    updateNode(id: string, updates: { nodeName?: string; nodeSubtitle?: string }): Promise<void>;
    deleteNode(id: string): Promise<void>;
}

export interface IFieldService {
    getFieldsForNode(nodeId: string): Promise<DataField[]>;
    nextCardOrder(nodeId: string): Promise<number>;
    addField(nodeId: string, fieldName: string, fieldValue: string | null, cardOrder?: number): Promise<DataField>;
    updateFieldValue(fieldId: string, newValue: string | null): Promise<void>;
    deleteField(fieldId: string): Promise<void>;
    getFieldHistory(fieldId: string): Promise<DataFieldHistory[]>;
}

// ============================================================================
// DEFAULT IMPLEMENTATIONS (IDB as primary, Firestore for sync)
// ============================================================================

import { IDBAdapter } from '../storage/IDBAdapter';
import { FirestoreAdapter } from '../storage/firestoreAdapter';

// Create adapters
const idbAdapter = new IDBAdapter();
const firestoreAdapter = new FirestoreAdapter();

// Use IDBAdapter as primary storage (offline-first)
const defaultNodeService: INodeService = nodeServiceFromAdapter(idbAdapter);
const defaultFieldService: IFieldService = fieldServiceFromAdapter(idbAdapter);

// Export adapters for SyncManager initialization
export { idbAdapter, firestoreAdapter };

function unwrap<T>(result: StorageResult<T>): T {
    return result.data;
}

function nodeServiceFromAdapter(adapter: StorageAdapter): INodeService {
    return {
        getRootNodes: async () => unwrap(await adapter.listRootNodes()),
        getNodeById: async (id: string) => unwrap(await adapter.getNode(id)),
        getNodeWithChildren: async (id: string) => {
            const [nodeRes, childRes] = await Promise.all([
                adapter.getNode(id),
                adapter.listChildren(id),
            ]);
            return {
                node: unwrap(nodeRes),
                children: unwrap(childRes),
            };
        },
        getChildren: async (parentId: string) => unwrap(await adapter.listChildren(parentId)),
        createWithFields: async (input) => {
            // create node first, then fields; caller provides IDs and defaults
            await adapter.createNode({
                id: input.id,
                parentId: input.parentId,
                nodeName: input.nodeName,
                nodeSubtitle: input.nodeSubtitle,
            });
            await Promise.all(
                input.defaults.map((field) =>
                    adapter.createField({
                        id: generateId(),
                        parentNodeId: input.id,
                        fieldName: field.fieldName,
                        fieldValue: field.fieldValue,
                    })
                )
            );
        },
        createEmptyNode: async (id: string, parentId: string | null) => {
            return unwrap(await adapter.createNode({ id, parentId, nodeName: "", nodeSubtitle: "" }));
        },
        updateNode: async (id: string, updates) => {
            await adapter.updateNode(id, updates);
        },
        deleteNode: async (id: string) => {
            console.log('[NodeService] Deleting node:', id);
            await adapter.deleteNode(id);
        },
    };
}

function fieldServiceFromAdapter(adapter: StorageAdapter): IFieldService {
    return {
        getFieldsForNode: async (nodeId: string) => unwrap(await adapter.listFields(nodeId)),
        nextCardOrder: async (nodeId: string) => unwrap(await adapter.nextCardOrder(nodeId)),
        addField: async (nodeId: string, fieldName: string, fieldValue: string | null, cardOrder?: number) =>
            unwrap(
                await adapter.createField({
                    id: generateId(),
                    parentNodeId: nodeId,
                    fieldName,
                    fieldValue,
                    cardOrder,
                })
            ),
        updateFieldValue: async (fieldId: string, newValue: string | null) => {
            await adapter.updateFieldValue(fieldId, { fieldValue: newValue });
        },
        deleteField: async (fieldId: string) => {
            await adapter.deleteField(fieldId);
        },
        getFieldHistory: async (fieldId: string) => unwrap(await adapter.getFieldHistory(fieldId)),
    };
}

// ============================================================================
// ACTIVE SERVICES (can be swapped for testing)
// ============================================================================

let activeNodeService: INodeService = defaultNodeService;
let activeFieldService: IFieldService = defaultFieldService;

/**
 * Get the active node service.
 * Used by components to access node operations.
 */
export function getNodeService(): INodeService {
    return activeNodeService;
}

/**
 * Get the active field service.
 * Used by components to access field operations.
 */
export function getFieldService(): IFieldService {
    return activeFieldService;
}

/**
 * Set custom node service (for testing or different backends).
 * Call before app initialization.
 */
export function setNodeService(service: INodeService): void {
    activeNodeService = service;
}

/**
 * Set custom field service (for testing or different backends).
 * Call before app initialization.
 */
export function setFieldService(service: IFieldService): void {
    activeFieldService = service;
}

/**
 * Reset services to defaults (useful in tests).
 */
export function resetServices(): void {
    activeNodeService = defaultNodeService;
    activeFieldService = defaultFieldService;
}

/**
 * Swap services to use a storage adapter (backend-agnostic).
 * Firestore stays as default until an adapter is provided.
 */
export function useStorageAdapter(adapter: StorageAdapter): void {
    activeNodeService = nodeServiceFromAdapter(adapter);
    activeFieldService = fieldServiceFromAdapter(adapter);
}


