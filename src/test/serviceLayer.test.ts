/**
 * Tests for Service Layer - Adapter selection and swapping
 *
 * Covers:
 * - getNodeService / getFieldService return active services
 * - setNodeService / setFieldService allow custom injection
 * - resetServices restores defaults
 * - useStorageAdapter creates services from an adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getNodeService,
    getFieldService,
    setNodeService,
    setFieldService,
    resetServices,
    useStorageAdapter,
    type INodeService,
    type IFieldService,
} from '../data/services/index';
import type { StorageAdapter, StorageResult } from '../data/storage/storageAdapter';
import type { TreeNode, DataField, DataFieldHistory } from '../data/models';

describe('Service Layer - Adapter Selection', () => {
    // Restore defaults after each test to avoid cross-test pollution
    afterEach(() => {
        resetServices();
    });

    describe('getNodeService / getFieldService', () => {
        it('returns a node service with expected methods', () => {
            const nodeService = getNodeService();

            expect(nodeService).toBeDefined();
            expect(typeof nodeService.getRootNodes).toBe('function');
            expect(typeof nodeService.getNodeById).toBe('function');
            expect(typeof nodeService.getNodeWithChildren).toBe('function');
            expect(typeof nodeService.getChildren).toBe('function');
            expect(typeof nodeService.createWithFields).toBe('function');
            expect(typeof nodeService.createEmptyNode).toBe('function');
            expect(typeof nodeService.updateNode).toBe('function');
        });

        it('returns a field service with expected methods', () => {
            const fieldService = getFieldService();

            expect(fieldService).toBeDefined();
            expect(typeof fieldService.getFieldsForNode).toBe('function');
            expect(typeof fieldService.nextCardOrder).toBe('function');
            expect(typeof fieldService.addField).toBe('function');
            expect(typeof fieldService.updateFieldValue).toBe('function');
            expect(typeof fieldService.deleteField).toBe('function');
            expect(typeof fieldService.getFieldHistory).toBe('function');
        });

        it('returns the same service instance on repeated calls', () => {
            const nodeService1 = getNodeService();
            const nodeService2 = getNodeService();
            const fieldService1 = getFieldService();
            const fieldService2 = getFieldService();

            expect(nodeService1).toBe(nodeService2);
            expect(fieldService1).toBe(fieldService2);
        });
    });

    describe('setNodeService / setFieldService', () => {
        it('allows injecting a custom node service', async () => {
            const mockNodeService: INodeService = {
                getRootNodes: vi.fn().mockResolvedValue([{ id: 'mock-node' }]),
                getNodeById: vi.fn(),
                getNodeWithChildren: vi.fn(),
                getChildren: vi.fn(),
                createWithFields: vi.fn(),
                createEmptyNode: vi.fn(),
                updateNode: vi.fn(),
                deleteNode: vi.fn(),
            };

            setNodeService(mockNodeService);

            const activeService = getNodeService();
            expect(activeService).toBe(mockNodeService);

            const result = await activeService.getRootNodes();
            expect(result).toEqual([{ id: 'mock-node' }]);
            expect(mockNodeService.getRootNodes).toHaveBeenCalled();
        });

        it('allows injecting a custom field service', async () => {
            const mockFieldService: IFieldService = {
                getFieldsForNode: vi.fn().mockResolvedValue([{ id: 'mock-field' }]),
                nextCardOrder: vi.fn(),
                addField: vi.fn(),
                updateFieldValue: vi.fn(),
                deleteField: vi.fn(),
                getFieldHistory: vi.fn(),
            };

            setFieldService(mockFieldService);

            const activeService = getFieldService();
            expect(activeService).toBe(mockFieldService);

            const result = await activeService.getFieldsForNode('node-1');
            expect(result).toEqual([{ id: 'mock-field' }]);
            expect(mockFieldService.getFieldsForNode).toHaveBeenCalledWith('node-1');
        });

        it('injected services persist until reset', () => {
            const mockNodeService: INodeService = {
                getRootNodes: vi.fn(),
                getNodeById: vi.fn(),
                getNodeWithChildren: vi.fn(),
                getChildren: vi.fn(),
                createWithFields: vi.fn(),
                createEmptyNode: vi.fn(),
                updateNode: vi.fn(),
                deleteNode: vi.fn(),
            };

            setNodeService(mockNodeService);

            // Multiple calls should return the same injected service
            expect(getNodeService()).toBe(mockNodeService);
            expect(getNodeService()).toBe(mockNodeService);
        });
    });

    describe('resetServices', () => {
        it('restores default services after custom injection', () => {
            const originalNodeService = getNodeService();
            const originalFieldService = getFieldService();

            // Inject custom services
            const mockNodeService: INodeService = {
                getRootNodes: vi.fn(),
                getNodeById: vi.fn(),
                getNodeWithChildren: vi.fn(),
                getChildren: vi.fn(),
                createWithFields: vi.fn(),
                createEmptyNode: vi.fn(),
                updateNode: vi.fn(),
                deleteNode: vi.fn(),
            };
            const mockFieldService: IFieldService = {
                getFieldsForNode: vi.fn(),
                nextCardOrder: vi.fn(),
                addField: vi.fn(),
                updateFieldValue: vi.fn(),
                deleteField: vi.fn(),
                getFieldHistory: vi.fn(),
            };

            setNodeService(mockNodeService);
            setFieldService(mockFieldService);

            expect(getNodeService()).toBe(mockNodeService);
            expect(getFieldService()).toBe(mockFieldService);

            // Reset
            resetServices();

            // Should be back to defaults (same references as original)
            expect(getNodeService()).toBe(originalNodeService);
            expect(getFieldService()).toBe(originalFieldService);
        });
    });

    describe('useStorageAdapter', () => {
        it('creates services from a custom adapter', async () => {
            // Create a minimal mock adapter
            const mockAdapter: StorageAdapter = {
                listRootNodes: vi.fn().mockResolvedValue({ data: [{ id: 'adapter-node', nodeName: 'From Adapter' }] }),
                getNode: vi.fn().mockResolvedValue({ data: null }),
                listChildren: vi.fn().mockResolvedValue({ data: [] }),
                createNode: vi.fn().mockResolvedValue({ data: { id: 'new-node' } }),
                updateNode: vi.fn().mockResolvedValue({ data: undefined }),
                deleteNode: vi.fn().mockResolvedValue({ data: undefined }),
                listFields: vi.fn().mockResolvedValue({ data: [{ id: 'adapter-field' }] }),
                nextCardOrder: vi.fn().mockResolvedValue({ data: 5 }),
                createField: vi.fn().mockResolvedValue({ data: { id: 'new-field' } }),
                updateFieldValue: vi.fn().mockResolvedValue({ data: undefined }),
                deleteField: vi.fn().mockResolvedValue({ data: undefined }),
                getFieldHistory: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedNodes: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedChildren: vi.fn().mockResolvedValue({ data: [] }),
                restoreNode: vi.fn().mockResolvedValue({ data: undefined }),
                listDeletedFields: vi.fn().mockResolvedValue({ data: [] }),
                restoreField: vi.fn().mockResolvedValue({ data: undefined }),
            };

            useStorageAdapter(mockAdapter);

            // Node service should use the adapter
            const nodes = await getNodeService().getRootNodes();
            expect(nodes).toEqual([{ id: 'adapter-node', nodeName: 'From Adapter' }]);
            expect(mockAdapter.listRootNodes).toHaveBeenCalled();

            // Field service should use the adapter
            const fields = await getFieldService().getFieldsForNode('node-1');
            expect(fields).toEqual([{ id: 'adapter-field' }]);
            expect(mockAdapter.listFields).toHaveBeenCalledWith('node-1');

            const order = await getFieldService().nextCardOrder('node-1');
            expect(order).toBe(5);
            expect(mockAdapter.nextCardOrder).toHaveBeenCalledWith('node-1');
        });

        it('adapter services can be reset to defaults', async () => {
            const mockAdapter: StorageAdapter = {
                listRootNodes: vi.fn().mockResolvedValue({ data: [{ id: 'mock' }] }),
                getNode: vi.fn().mockResolvedValue({ data: null }),
                listChildren: vi.fn().mockResolvedValue({ data: [] }),
                createNode: vi.fn().mockResolvedValue({ data: {} }),
                updateNode: vi.fn().mockResolvedValue({ data: undefined }),
                deleteNode: vi.fn().mockResolvedValue({ data: undefined }),
                listFields: vi.fn().mockResolvedValue({ data: [] }),
                nextCardOrder: vi.fn().mockResolvedValue({ data: 0 }),
                createField: vi.fn().mockResolvedValue({ data: {} }),
                updateFieldValue: vi.fn().mockResolvedValue({ data: undefined }),
                deleteField: vi.fn().mockResolvedValue({ data: undefined }),
                getFieldHistory: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedNodes: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedChildren: vi.fn().mockResolvedValue({ data: [] }),
                restoreNode: vi.fn().mockResolvedValue({ data: undefined }),
                listDeletedFields: vi.fn().mockResolvedValue({ data: [] }),
                restoreField: vi.fn().mockResolvedValue({ data: undefined }),
            };

            const originalNodeService = getNodeService();

            useStorageAdapter(mockAdapter);
            expect(getNodeService()).not.toBe(originalNodeService);

            resetServices();
            expect(getNodeService()).toBe(originalNodeService);
        });

        it('node service methods delegate to adapter correctly', async () => {
            const mockNode: TreeNode = {
                id: 'test-node',
                parentId: null,
                nodeName: 'Test',
                nodeSubtitle: 'Sub',
                updatedBy: 'user',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            const mockAdapter: StorageAdapter = {
                listRootNodes: vi.fn().mockResolvedValue({ data: [mockNode] }),
                getNode: vi.fn().mockResolvedValue({ data: mockNode }),
                listChildren: vi.fn().mockResolvedValue({ data: [] }),
                createNode: vi.fn().mockResolvedValue({ data: mockNode }),
                updateNode: vi.fn().mockResolvedValue({ data: undefined }),
                deleteNode: vi.fn().mockResolvedValue({ data: undefined }),
                listFields: vi.fn().mockResolvedValue({ data: [] }),
                nextCardOrder: vi.fn().mockResolvedValue({ data: 0 }),
                createField: vi.fn().mockResolvedValue({ data: {} }),
                updateFieldValue: vi.fn().mockResolvedValue({ data: undefined }),
                deleteField: vi.fn().mockResolvedValue({ data: undefined }),
                getFieldHistory: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedNodes: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedChildren: vi.fn().mockResolvedValue({ data: [] }),
                restoreNode: vi.fn().mockResolvedValue({ data: undefined }),
                listDeletedFields: vi.fn().mockResolvedValue({ data: [] }),
                restoreField: vi.fn().mockResolvedValue({ data: undefined }),
            };

            useStorageAdapter(mockAdapter);
            const nodeService = getNodeService();

            // Test getNodeById
            const node = await nodeService.getNodeById('test-node');
            expect(node).toEqual(mockNode);
            expect(mockAdapter.getNode).toHaveBeenCalledWith('test-node');

            // Test getNodeWithChildren
            const result = await nodeService.getNodeWithChildren('test-node');
            expect(result.node).toEqual(mockNode);
            expect(result.children).toEqual([]);

            // Test getChildren
            await nodeService.getChildren('parent-id');
            expect(mockAdapter.listChildren).toHaveBeenCalledWith('parent-id');

            // Test updateNode
            await nodeService.updateNode('test-node', { nodeName: 'Updated' });
            expect(mockAdapter.updateNode).toHaveBeenCalledWith('test-node', { nodeName: 'Updated' });

            // Test deleteNode
            await nodeService.deleteNode('test-node');
            expect(mockAdapter.deleteNode).toHaveBeenCalledWith('test-node');
        });

        it('field service methods delegate to adapter correctly', async () => {
            const mockField: DataField = {
                id: 'test-field',
                parentNodeId: 'node-1',
                fieldName: 'Test Field',
                fieldValue: 'Value',
                cardOrder: 0,
                updatedBy: 'user',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            const mockHistory: DataFieldHistory = {
                id: 'test-field:0',
                dataFieldId: 'test-field',
                parentNodeId: 'node-1',
                action: 'create',
                property: 'fieldValue',
                prevValue: null,
                newValue: 'Value',
                updatedBy: 'user',
                updatedAt: Date.now(),
                rev: 0,
            };

            const mockAdapter: StorageAdapter = {
                listRootNodes: vi.fn().mockResolvedValue({ data: [] }),
                getNode: vi.fn().mockResolvedValue({ data: null }),
                listChildren: vi.fn().mockResolvedValue({ data: [] }),
                createNode: vi.fn().mockResolvedValue({ data: {} }),
                updateNode: vi.fn().mockResolvedValue({ data: undefined }),
                deleteNode: vi.fn().mockResolvedValue({ data: undefined }),
                listFields: vi.fn().mockResolvedValue({ data: [mockField] }),
                nextCardOrder: vi.fn().mockResolvedValue({ data: 3 }),
                createField: vi.fn().mockResolvedValue({ data: mockField }),
                updateFieldValue: vi.fn().mockResolvedValue({ data: undefined }),
                deleteField: vi.fn().mockResolvedValue({ data: undefined }),
                getFieldHistory: vi.fn().mockResolvedValue({ data: [mockHistory] }),
                listDeletedNodes: vi.fn().mockResolvedValue({ data: [] }),
                listDeletedChildren: vi.fn().mockResolvedValue({ data: [] }),
                restoreNode: vi.fn().mockResolvedValue({ data: undefined }),
                listDeletedFields: vi.fn().mockResolvedValue({ data: [] }),
                restoreField: vi.fn().mockResolvedValue({ data: undefined }),
            };

            useStorageAdapter(mockAdapter);
            const fieldService = getFieldService();

            // Test getFieldsForNode
            const fields = await fieldService.getFieldsForNode('node-1');
            expect(fields).toEqual([mockField]);
            expect(mockAdapter.listFields).toHaveBeenCalledWith('node-1');

            // Test nextCardOrder
            const order = await fieldService.nextCardOrder('node-1');
            expect(order).toBe(3);

            // Test updateFieldValue
            await fieldService.updateFieldValue('test-field', 'New Value');
            expect(mockAdapter.updateFieldValue).toHaveBeenCalledWith('test-field', { fieldValue: 'New Value' });

            // Test deleteField
            await fieldService.deleteField('test-field');
            expect(mockAdapter.deleteField).toHaveBeenCalledWith('test-field');

            // Test getFieldHistory
            const history = await fieldService.getFieldHistory('test-field');
            expect(history).toEqual([mockHistory]);
            expect(mockAdapter.getFieldHistory).toHaveBeenCalledWith('test-field');
        });
    });
});
