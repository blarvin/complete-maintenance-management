/**
 * TreeNode behavior tests - validates the data layer that backs TreeNode component.
 * These tests ensure refactoring TreeNode doesn't break:
 * 1. Node creation with default fields (under-construction flow)
 * 2. Field loading for display mode
 * 3. Parent-child hierarchy (navigation)
 */

import { describe, it, expect, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { createNode, getNodeById, listChildren, listRootNodes } from '../data/repo/treeNodes';
import { listFieldsForNode, addField } from '../data/repo/dataFields';
import { createRootNodeWithDefaultFields, createChildNodeWithDefaultFields } from '../data/services/createNode';

describe('TreeNode Data Layer', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    describe('createRootNodeWithDefaultFields', () => {
        it('creates a root node with parentId=null', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createRootNodeWithDefaultFields({
                id,
                nodeName: 'Test Root',
                nodeSubtitle: 'A root node',
                defaults: [],
            });

            await settle();
            const node = await getNodeById(id);

            expect(node).not.toBeNull();
            expect(node?.nodeName).toBe('Test Root');
            expect(node?.nodeSubtitle).toBe('A root node');
            expect(node?.parentId).toBeNull();
        });

        it('creates default fields for the node', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createRootNodeWithDefaultFields({
                id,
                nodeName: 'Node With Defaults',
                nodeSubtitle: '',
                defaults: [
                    { fieldName: 'Type Of', fieldValue: 'Vehicle' },
                    { fieldName: 'Description', fieldValue: null },
                    { fieldName: 'Tags', fieldValue: 'test, demo' },
                ],
            });

            await settle();
            const fields = await listFieldsForNode(id);

            expect(fields.length).toBe(3);
            expect(fields.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('Vehicle');
            expect(fields.find(f => f.fieldName === 'Description')?.fieldValue).toBeNull();
            expect(fields.find(f => f.fieldName === 'Tags')?.fieldValue).toBe('test, demo');
        });

        it('uses "Untitled" when nodeName is empty', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createRootNodeWithDefaultFields({
                id,
                nodeName: '',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const node = await getNodeById(id);

            expect(node?.nodeName).toBe('Untitled');
        });
    });

    describe('createChildNodeWithDefaultFields', () => {
        it('creates a child node with correct parentId', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId);
            createdNodeIds.push(childId);

            // Create parent first
            await createRootNodeWithDefaultFields({
                id: parentId,
                nodeName: 'Parent Node',
                nodeSubtitle: '',
                defaults: [],
            });

            // Create child
            await createChildNodeWithDefaultFields({
                id: childId,
                parentId,
                nodeName: 'Child Node',
                nodeSubtitle: 'Under parent',
                defaults: [{ fieldName: 'Type Of', fieldValue: 'Component' }],
            });

            await settle();
            const child = await getNodeById(childId);

            expect(child).not.toBeNull();
            expect(child?.nodeName).toBe('Child Node');
            expect(child?.parentId).toBe(parentId);
        });

        it('child appears in listChildren of parent', async () => {
            const parentId = testId();
            const childId1 = testId();
            const childId2 = testId();
            createdNodeIds.push(parentId);
            createdNodeIds.push(childId1);
            createdNodeIds.push(childId2);

            await createRootNodeWithDefaultFields({
                id: parentId,
                nodeName: 'Parent',
                nodeSubtitle: '',
                defaults: [],
            });

            await createChildNodeWithDefaultFields({
                id: childId1,
                parentId,
                nodeName: 'Child One',
                nodeSubtitle: '',
                defaults: [],
            });

            await createChildNodeWithDefaultFields({
                id: childId2,
                parentId,
                nodeName: 'Child Two',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const children = await listChildren(parentId);

            expect(children.length).toBe(2);
            expect(children.map(c => c.nodeName)).toContain('Child One');
            expect(children.map(c => c.nodeName)).toContain('Child Two');
        });
    });

    describe('listFieldsForNode (display mode)', () => {
        it('returns empty array for node with no fields', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createNode({
                id,
                nodeName: 'Empty Node',
                nodeSubtitle: '',
                parentId: null,
            });

            await settle();
            const fields = await listFieldsForNode(id);

            expect(fields).toEqual([]);
        });

        it('returns fields sorted by updatedAt ascending', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node without fields first
            await createNode({
                id,
                nodeName: 'Sorted Fields Node',
                nodeSubtitle: '',
                parentId: null,
            });

            // Create fields sequentially with delays to ensure different timestamps
            await addField({ id: testId(), fieldName: 'First', parentNodeId: id, fieldValue: '1' });
            await settle(50);
            await addField({ id: testId(), fieldName: 'Second', parentNodeId: id, fieldValue: '2' });
            await settle(50);
            await addField({ id: testId(), fieldName: 'Third', parentNodeId: id, fieldValue: '3' });

            await settle();
            const fields = await listFieldsForNode(id);

            // Fields should be in creation order (by updatedAt)
            expect(fields.length).toBe(3);
            expect(fields[0].fieldName).toBe('First');
            expect(fields[1].fieldName).toBe('Second');
            expect(fields[2].fieldName).toBe('Third');
        });

        it('only returns fields for the specified node', async () => {
            const nodeA = testId();
            const nodeB = testId();
            createdNodeIds.push(nodeA);
            createdNodeIds.push(nodeB);

            await createRootNodeWithDefaultFields({
                id: nodeA,
                nodeName: 'Node A',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Field A', fieldValue: 'A' }],
            });

            await createRootNodeWithDefaultFields({
                id: nodeB,
                nodeName: 'Node B',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Field B', fieldValue: 'B' }],
            });

            await settle();
            const fieldsA = await listFieldsForNode(nodeA);
            const fieldsB = await listFieldsForNode(nodeB);

            expect(fieldsA.length).toBe(1);
            expect(fieldsA[0].fieldName).toBe('Field A');

            expect(fieldsB.length).toBe(1);
            expect(fieldsB[0].fieldName).toBe('Field B');
        });
    });

    describe('listRootNodes (ROOT view)', () => {
        it('returns only nodes with parentId=null', async () => {
            const rootId = testId();
            const childId = testId();
            createdNodeIds.push(rootId);
            createdNodeIds.push(childId);

            await createRootNodeWithDefaultFields({
                id: rootId,
                nodeName: 'Root For List',
                nodeSubtitle: '',
                defaults: [],
            });

            await createChildNodeWithDefaultFields({
                id: childId,
                parentId: rootId,
                nodeName: 'Child Not In List',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const roots = await listRootNodes();

            // Should contain our root
            const ourRoot = roots.find(r => r.id === rootId);
            expect(ourRoot).toBeDefined();
            expect(ourRoot?.nodeName).toBe('Root For List');

            // Should NOT contain the child
            const child = roots.find(r => r.id === childId);
            expect(child).toBeUndefined();
        });
    });

    describe('Navigation hierarchy', () => {
        it('can traverse from root to child via listChildren', async () => {
            const rootId = testId();
            const childId = testId();
            const grandchildId = testId();
            createdNodeIds.push(rootId);
            createdNodeIds.push(childId);
            createdNodeIds.push(grandchildId);

            // Create 3-level hierarchy
            await createRootNodeWithDefaultFields({
                id: rootId,
                nodeName: 'Level 0',
                nodeSubtitle: '',
                defaults: [],
            });

            await createChildNodeWithDefaultFields({
                id: childId,
                parentId: rootId,
                nodeName: 'Level 1',
                nodeSubtitle: '',
                defaults: [],
            });

            await createChildNodeWithDefaultFields({
                id: grandchildId,
                parentId: childId,
                nodeName: 'Level 2',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();

            // Navigate down
            const level1 = await listChildren(rootId);
            expect(level1.length).toBe(1);
            expect(level1[0].id).toBe(childId);

            const level2 = await listChildren(childId);
            expect(level2.length).toBe(1);
            expect(level2[0].id).toBe(grandchildId);

            // Verify parentId chain for navigation back up
            const grandchild = await getNodeById(grandchildId);
            expect(grandchild?.parentId).toBe(childId);

            const child = await getNodeById(childId);
            expect(child?.parentId).toBe(rootId);

            const root = await getNodeById(rootId);
            expect(root?.parentId).toBeNull();
        });
    });
});
