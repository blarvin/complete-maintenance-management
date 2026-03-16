/**
 * Tests for node creation via CQRS CommandBus + Queries.
 * Integration tests against real IDB (fake-indexeddb).
 * Validates the creation flow used by RootView and BranchView.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { getCommandBus, initializeCommandBus, resetCommandBus } from '../data/commands';
import { getNodeQueries, getFieldQueries, initializeQueries, resetQueries } from '../data/queries';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { IDBSyncQueueManager } from '../data/sync/SyncQueueManager';
import { DEFAULT_DATAFIELD_NAMES } from '../constants';

describe('Node Creation Service', () => {
    const createdNodeIds: string[] = [];

    beforeAll(() => {
        // Initialize CQRS layer for integration tests
        const syncQueue = new IDBSyncQueueManager();
        const adapter = new IDBAdapter(syncQueue);
        initializeCommandBus(adapter);
        initializeQueries(adapter);
    });

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
        resetCommandBus();
        resetQueries();
    });

    describe('Root node creation flow (RootView)', () => {
        it('creates node and it appears in getRootNodes', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: {
                    id,
                    parentId: null,
                    nodeName: 'New Asset',
                    nodeSubtitle: 'Created from ROOT view',
                    defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
                },
            });

            await settle();

            const roots = await getNodeQueries().getRootNodes();
            const created = roots.find(n => n.id === id);

            expect(created).toBeDefined();
            expect(created?.nodeName).toBe('New Asset');
            expect(created?.parentId).toBeNull();
        });

        it('creates default fields from DEFAULT_DATAFIELD_NAMES', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: {
                    id,
                    parentId: null,
                    nodeName: 'Node With Defaults',
                    nodeSubtitle: '',
                    defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
                },
            });

            await settle();
            const fields = await getFieldQueries().getFieldsForNode(id);

            expect(fields.length).toBe(DEFAULT_DATAFIELD_NAMES.length);
            for (const defaultName of DEFAULT_DATAFIELD_NAMES) {
                expect(fields.find(f => f.fieldName === defaultName)).toBeDefined();
            }
        });

        it('preserves field values when provided', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: {
                    id,
                    parentId: null,
                    nodeName: 'Node With Values',
                    nodeSubtitle: '',
                    defaults: [
                        { fieldName: 'Type Of', fieldValue: 'Vehicle' },
                        { fieldName: 'Description', fieldValue: 'A test vehicle' },
                        { fieldName: 'Tags', fieldValue: null },
                    ],
                },
            });

            await settle();
            const fields = await getFieldQueries().getFieldsForNode(id);

            expect(fields.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('Vehicle');
            expect(fields.find(f => f.fieldName === 'Description')?.fieldValue).toBe('A test vehicle');
            expect(fields.find(f => f.fieldName === 'Tags')?.fieldValue).toBeNull();
        });
    });

    describe('Child node creation flow (BranchView)', () => {
        it('creates child node with correct parentId', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId);
            createdNodeIds.push(childId);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: parentId, parentId: null, nodeName: 'Parent Asset', nodeSubtitle: '', defaults: [] },
            });

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: {
                    id: childId,
                    parentId,
                    nodeName: 'Child Component',
                    nodeSubtitle: 'Sub-asset',
                    defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
                },
            });

            await settle();

            const children = await getNodeQueries().getChildren(parentId);
            const created = children.find(n => n.id === childId);

            expect(created).toBeDefined();
            expect(created?.nodeName).toBe('Child Component');
            expect(created?.parentId).toBe(parentId);
        });

        it('child node is NOT in getRootNodes', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId, childId);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '', defaults: [] },
            });

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: childId, parentId, nodeName: 'Child', nodeSubtitle: '', defaults: [] },
            });

            await settle();
            const roots = await getNodeQueries().getRootNodes();

            expect(roots.find(n => n.id === parentId)).toBeDefined();
            expect(roots.find(n => n.id === childId)).toBeUndefined();
        });

        it('creates default fields for child node', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId, childId);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '', defaults: [] },
            });

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: {
                    id: childId,
                    parentId,
                    nodeName: 'Child With Fields',
                    nodeSubtitle: '',
                    defaults: [
                        { fieldName: 'Type Of', fieldValue: 'Pump' },
                        { fieldName: 'Serial Number', fieldValue: 'SN-12345' },
                    ],
                },
            });

            await settle();
            const fields = await getFieldQueries().getFieldsForNode(childId);

            expect(fields.length).toBe(2);
            expect(fields.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('Pump');
            expect(fields.find(f => f.fieldName === 'Serial Number')?.fieldValue).toBe('SN-12345');
        });
    });

    describe('Edge cases', () => {
        it('handles empty nodeName', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id, parentId: null, nodeName: '', nodeSubtitle: '', defaults: [] },
            });

            await settle();
            const node = await getNodeQueries().getNodeById(id);

            expect(node?.nodeName).toBe('');
        });

        it('handles empty defaults array', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id, parentId: null, nodeName: 'No Fields Node', nodeSubtitle: '', defaults: [] },
            });

            await settle();
            const fields = await getFieldQueries().getFieldsForNode(id);

            expect(fields.length).toBe(0);
        });
    });

    describe('listFieldsForNode behavior', () => {
        it('returns fields sorted by updatedAt ascending', async () => {
            const id = testId();
            createdNodeIds.push(id);

            const node = await getCommandBus().execute({
                type: 'CREATE_EMPTY_NODE',
                payload: { id, parentId: null },
            });

            await getCommandBus().execute({
                type: 'UPDATE_NODE',
                payload: { id, updates: { nodeName: 'Sorted Fields Node', nodeSubtitle: '' } },
            });

            await getCommandBus().execute({ type: 'ADD_FIELD', payload: { nodeId: id, fieldName: 'First', fieldValue: '1' } });
            await settle(50);
            await getCommandBus().execute({ type: 'ADD_FIELD', payload: { nodeId: id, fieldName: 'Second', fieldValue: '2' } });
            await settle(50);
            await getCommandBus().execute({ type: 'ADD_FIELD', payload: { nodeId: id, fieldName: 'Third', fieldValue: '3' } });

            await settle();
            const fields = await getFieldQueries().getFieldsForNode(id);

            expect(fields.length).toBe(3);
            expect(fields[0].fieldName).toBe('First');
            expect(fields[1].fieldName).toBe('Second');
            expect(fields[2].fieldName).toBe('Third');
        });

        it('only returns fields for the specified node', async () => {
            const nodeA = testId();
            const nodeB = testId();
            createdNodeIds.push(nodeA, nodeB);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: nodeA, parentId: null, nodeName: 'Node A', nodeSubtitle: '', defaults: [{ fieldName: 'Field A', fieldValue: 'A' }] },
            });

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: nodeB, parentId: null, nodeName: 'Node B', nodeSubtitle: '', defaults: [{ fieldName: 'Field B', fieldValue: 'B' }] },
            });

            await settle();
            const fieldsA = await getFieldQueries().getFieldsForNode(nodeA);
            const fieldsB = await getFieldQueries().getFieldsForNode(nodeB);

            expect(fieldsA.length).toBe(1);
            expect(fieldsA[0].fieldName).toBe('Field A');

            expect(fieldsB.length).toBe(1);
            expect(fieldsB[0].fieldName).toBe('Field B');
        });
    });

    describe('Navigation hierarchy', () => {
        it('can traverse from root to child via getChildren', async () => {
            const rootId = testId();
            const childId = testId();
            const grandchildId = testId();
            createdNodeIds.push(rootId, childId, grandchildId);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: rootId, parentId: null, nodeName: 'Level 0', nodeSubtitle: '', defaults: [] },
            });
            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: childId, parentId: rootId, nodeName: 'Level 1', nodeSubtitle: '', defaults: [] },
            });
            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: grandchildId, parentId: childId, nodeName: 'Level 2', nodeSubtitle: '', defaults: [] },
            });

            await settle();

            const level1 = await getNodeQueries().getChildren(rootId);
            expect(level1.length).toBe(1);
            expect(level1[0].id).toBe(childId);

            const level2 = await getNodeQueries().getChildren(childId);
            expect(level2.length).toBe(1);
            expect(level2[0].id).toBe(grandchildId);

            const grandchild = await getNodeQueries().getNodeById(grandchildId);
            expect(grandchild?.parentId).toBe(childId);

            const child = await getNodeQueries().getNodeById(childId);
            expect(child?.parentId).toBe(rootId);

            const root = await getNodeQueries().getNodeById(rootId);
            expect(root?.parentId).toBeNull();
        });

        it('child appears in getChildren of parent', async () => {
            const parentId = testId();
            const childId1 = testId();
            const childId2 = testId();
            createdNodeIds.push(parentId, childId1, childId2);

            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '', defaults: [] },
            });
            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: childId1, parentId, nodeName: 'Child One', nodeSubtitle: '', defaults: [] },
            });
            await getCommandBus().execute({
                type: 'CREATE_NODE_WITH_FIELDS',
                payload: { id: childId2, parentId, nodeName: 'Child Two', nodeSubtitle: '', defaults: [] },
            });

            await settle();
            const children = await getNodeQueries().getChildren(parentId);

            expect(children.length).toBe(2);
            expect(children.map(c => c.nodeName)).toContain('Child One');
            expect(children.map(c => c.nodeName)).toContain('Child Two');
        });
    });
});
