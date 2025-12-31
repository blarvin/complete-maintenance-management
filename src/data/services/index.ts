/**
 * Data Services - Unified export for all data operations.
 * 
 * This module provides the abstraction layer for data access.
 * Components import from here, not from concrete implementations.
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
// DEFAULT IMPLEMENTATIONS (Firestore)
// ============================================================================

import { nodeService as firestoreNodes } from './nodeService';
import { fieldService as firestoreFields } from './fieldService';
import { createNodeWithDefaultFields } from './createNode';

const defaultNodeService: INodeService = {
    ...firestoreNodes,
    createWithFields: createNodeWithDefaultFields,
    createEmptyNode: firestoreNodes.createEmptyNode,
    updateNode: firestoreNodes.updateNode,
};

const defaultFieldService: IFieldService = firestoreFields;

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


