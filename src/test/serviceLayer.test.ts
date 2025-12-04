/**
 * Tests for the Data Access Service Layer.
 * These services abstract the repo layer so components don't depend on Firestore directly.
 * 
 * Includes smoke test to verify Firestore connectivity.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { nodeService } from '../data/services/nodeService';
import { fieldService } from '../data/services/fieldService';
import { createNodeWithDefaultFields } from '../data/services/createNode';
import { deleteLeafNode, createNode } from '../data/repo/treeNodes';
import { updateFieldValue } from '../data/repo/dataFields';
import { DEFAULT_DATAFIELD_NAMES } from '../constants';
import { getCurrentUserId } from '../context/userContext';

/**
 * Smoke test - verifies the test framework and Firestore connection work.
 */
describe('Smoke Test', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    it('connects to Firestore and can create/read data', async () => {
        const id = testId();
        createdNodeIds.push(id);

        const node = await createNode({
            id,
            nodeName: 'Smoke Test Node',
            nodeSubtitle: 'Created by test',
            parentId: null,
        });

        expect(node.id).toBe(id);
        expect(node.nodeName).toBe('Smoke Test Node');
        expect(node.updatedBy).toBe(getCurrentUserId());
        expect(node.updatedAt).toBeTypeOf('number');
    });
});

describe('nodeService', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    describe('getRootNodes', () => {
        it('returns all root nodes (parentId = null)', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createNodeWithDefaultFields({
                id,
                parentId: null,
                nodeName: 'Root via service test',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const roots = await nodeService.getRootNodes();
            const found = roots.find(n => n.id === id);

            expect(found).toBeDefined();
            expect(found?.parentId).toBeNull();
        });
    });

    describe('getNodeById', () => {
        it('returns node when exists', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createNodeWithDefaultFields({
                id,
                parentId: null,
                nodeName: 'Get by ID test',
                nodeSubtitle: 'subtitle here',
                defaults: [],
            });

            await settle();
            const node = await nodeService.getNodeById(id);

            expect(node).toBeDefined();
            expect(node?.nodeName).toBe('Get by ID test');
            expect(node?.nodeSubtitle).toBe('subtitle here');
        });

        it('returns null when not exists', async () => {
            const node = await nodeService.getNodeById('nonexistent-id-12345');
            expect(node).toBeNull();
        });
    });

    describe('getNodeWithChildren', () => {
        it('returns parent node and children in parallel', async () => {
            const parentId = testId();
            const childId1 = testId();
            const childId2 = testId();
            createdNodeIds.push(parentId, childId1, childId2);

            // Create parent
            await createNodeWithDefaultFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent Node',
                nodeSubtitle: '',
                defaults: [],
            });

            // Create children
            await createNodeWithDefaultFields({
                id: childId1,
                parentId,
                nodeName: 'Child 1',
                nodeSubtitle: '',
                defaults: [],
            });
            await createNodeWithDefaultFields({
                id: childId2,
                parentId,
                nodeName: 'Child 2',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const result = await nodeService.getNodeWithChildren(parentId);

            expect(result.node).toBeDefined();
            expect(result.node?.nodeName).toBe('Parent Node');
            expect(result.children.length).toBe(2);
            expect(result.children.map(c => c.id)).toContain(childId1);
            expect(result.children.map(c => c.id)).toContain(childId2);
        });

        it('returns empty children array if no children', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await createNodeWithDefaultFields({
                id,
                parentId: null,
                nodeName: 'Lonely Node',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const result = await nodeService.getNodeWithChildren(id);

            expect(result.node).toBeDefined();
            expect(result.children).toEqual([]);
        });
    });

    describe('getChildren', () => {
        it('returns children for a parent', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId, childId);

            await createNodeWithDefaultFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent',
                nodeSubtitle: '',
                defaults: [],
            });
            await createNodeWithDefaultFields({
                id: childId,
                parentId,
                nodeName: 'Child',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const children = await nodeService.getChildren(parentId);

            expect(children.length).toBe(1);
            expect(children[0].id).toBe(childId);
        });
    });
});

describe('fieldService', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    describe('getFieldsForNode', () => {
        it('returns all fields for a node', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Node with fields',
                nodeSubtitle: '',
                defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
            });

            await settle();
            const fields = await fieldService.getFieldsForNode(nodeId);

            expect(fields.length).toBe(DEFAULT_DATAFIELD_NAMES.length);
            for (const name of DEFAULT_DATAFIELD_NAMES) {
                expect(fields.find(f => f.fieldName === name)).toBeDefined();
            }
        });

        it('returns empty array if node has no fields', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Node without fields',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const fields = await fieldService.getFieldsForNode(nodeId);

            expect(fields).toEqual([]);
        });
    });

    describe('updateFieldValue', () => {
        it('updates field value and returns updated field', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Node for update test',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Type Of', fieldValue: 'Original' }],
            });

            await settle();
            const fields = await fieldService.getFieldsForNode(nodeId);
            const field = fields.find(f => f.fieldName === 'Type Of');
            expect(field).toBeDefined();

            await fieldService.updateFieldValue(field!.id, 'Updated');

            await settle();
            const updatedFields = await fieldService.getFieldsForNode(nodeId);
            const updatedField = updatedFields.find(f => f.fieldName === 'Type Of');

            expect(updatedField?.fieldValue).toBe('Updated');
        });

        it('allows setting value to null', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Null value test',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Description', fieldValue: 'Has value' }],
            });

            await settle();
            const fields = await fieldService.getFieldsForNode(nodeId);
            const field = fields.find(f => f.fieldName === 'Description');

            await fieldService.updateFieldValue(field!.id, null);

            await settle();
            const updatedFields = await fieldService.getFieldsForNode(nodeId);
            const updatedField = updatedFields.find(f => f.fieldName === 'Description');

            expect(updatedField?.fieldValue).toBeNull();
        });
    });

    describe('deleteField', () => {
        it('deletes a field from the node', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Node for delete field test',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Deletable Field', fieldValue: 'Will be deleted' }],
            });

            await settle();
            let fields = await fieldService.getFieldsForNode(nodeId);
            expect(fields.length).toBe(1);

            await fieldService.deleteField(fields[0].id);
            await settle();

            fields = await fieldService.getFieldsForNode(nodeId);
            expect(fields.length).toBe(0);
        });
    });

    describe('addField', () => {
        it('adds a new field to an existing node', async () => {
            const nodeId = testId();
            createdNodeIds.push(nodeId);

            await createNodeWithDefaultFields({
                id: nodeId,
                parentId: null,
                nodeName: 'Node for add field test',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const newField = await fieldService.addField(nodeId, 'New Field', 'New Value');
            await settle();

            expect(newField.fieldName).toBe('New Field');
            expect(newField.fieldValue).toBe('New Value');
            expect(newField.parentNodeId).toBe(nodeId);

            const fields = await fieldService.getFieldsForNode(nodeId);
            expect(fields.length).toBe(1);
            expect(fields[0].fieldName).toBe('New Field');
        });
    });
});

/**
 * Navigation scenario tests - verify correct data isolation when "navigating"
 * between parent and child nodes (simulating the BranchView navigation flow).
 * 
 * This tests the data layer behavior that supports the UI fix where adding
 * key={nodeId} to TreeNode ensures component remount on navigation.
 */
describe('Navigation data isolation', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    it('parent and child have distinct field values that do not leak', async () => {
        const parentId = testId();
        const childId = testId();
        createdNodeIds.push(parentId, childId);

        // Create parent with specific Tags value
        await createNodeWithDefaultFields({
            id: parentId,
            parentId: null,
            nodeName: 'Parent Node',
            nodeSubtitle: 'Parent subtitle',
            defaults: [{ fieldName: 'Tags', fieldValue: 'parent, alpha, one' }],
        });

        // Create child with DIFFERENT Tags value
        await createNodeWithDefaultFields({
            id: childId,
            parentId,
            nodeName: 'Child Node',
            nodeSubtitle: 'Child subtitle',
            defaults: [{ fieldName: 'Tags', fieldValue: 'child, beta, two' }],
        });

        await settle();

        // Step 1: "View parent" - get parent's fields
        const parentFields = await fieldService.getFieldsForNode(parentId);
        const parentTags = parentFields.find(f => f.fieldName === 'Tags');
        
        expect(parentTags?.fieldValue).toBe('parent, alpha, one');

        // Step 2: "Navigate to child" - get child's fields
        const childFields = await fieldService.getFieldsForNode(childId);
        const childTags = childFields.find(f => f.fieldName === 'Tags');
        
        expect(childTags?.fieldValue).toBe('child, beta, two');

        // Verify they are different (the bug was showing parent's value for child)
        expect(parentTags?.fieldValue).not.toBe(childTags?.fieldValue);
    });

    it('getNodeWithChildren returns correct node data when navigating into child', async () => {
        const parentId = testId();
        const childId = testId();
        const grandchildId = testId();
        createdNodeIds.push(parentId, childId, grandchildId);

        // Build hierarchy: parent -> child -> grandchild
        await createNodeWithDefaultFields({
            id: parentId,
            parentId: null,
            nodeName: 'Grandparent',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Tags', fieldValue: 'grandparent-tags' }],
        });

        await createNodeWithDefaultFields({
            id: childId,
            parentId,
            nodeName: 'Parent (was child)',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Tags', fieldValue: 'parent-tags' }],
        });

        await createNodeWithDefaultFields({
            id: grandchildId,
            parentId: childId,
            nodeName: 'Child (was grandchild)',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Tags', fieldValue: 'child-tags' }],
        });

        await settle();

        // Step 1: View grandparent as current node (isParent state)
        const viewGrandparent = await nodeService.getNodeWithChildren(parentId);
        expect(viewGrandparent.node?.nodeName).toBe('Grandparent');
        expect(viewGrandparent.children.length).toBe(1);
        expect(viewGrandparent.children[0].nodeName).toBe('Parent (was child)');

        // Step 2: "Navigate into" child - now child becomes current node (isParent state)
        const viewParent = await nodeService.getNodeWithChildren(childId);
        expect(viewParent.node?.nodeName).toBe('Parent (was child)');
        expect(viewParent.children.length).toBe(1);
        expect(viewParent.children[0].nodeName).toBe('Child (was grandchild)');

        // Verify fields are isolated to each node
        const grandparentFields = await fieldService.getFieldsForNode(parentId);
        const parentFields = await fieldService.getFieldsForNode(childId);
        const childFields = await fieldService.getFieldsForNode(grandchildId);

        expect(grandparentFields.find(f => f.fieldName === 'Tags')?.fieldValue).toBe('grandparent-tags');
        expect(parentFields.find(f => f.fieldName === 'Tags')?.fieldValue).toBe('parent-tags');
        expect(childFields.find(f => f.fieldName === 'Tags')?.fieldValue).toBe('child-tags');
    });

    it('sequential navigation calls return correct isolated data', async () => {
        const nodeA = testId();
        const nodeB = testId();
        createdNodeIds.push(nodeA, nodeB);

        // Create two sibling nodes with distinct data
        await createNodeWithDefaultFields({
            id: nodeA,
            parentId: null,
            nodeName: 'Node A',
            nodeSubtitle: '',
            defaults: [
                { fieldName: 'Type Of', fieldValue: 'TypeA' },
                { fieldName: 'Description', fieldValue: 'DescA' },
            ],
        });

        await createNodeWithDefaultFields({
            id: nodeB,
            parentId: null,
            nodeName: 'Node B',
            nodeSubtitle: '',
            defaults: [
                { fieldName: 'Type Of', fieldValue: 'TypeB' },
                { fieldName: 'Description', fieldValue: 'DescB' },
            ],
        });

        await settle();

        // Simulate rapid navigation: A -> B -> A -> B
        const fieldsA1 = await fieldService.getFieldsForNode(nodeA);
        const fieldsB1 = await fieldService.getFieldsForNode(nodeB);
        const fieldsA2 = await fieldService.getFieldsForNode(nodeA);
        const fieldsB2 = await fieldService.getFieldsForNode(nodeB);

        // All calls should return consistent, isolated data
        expect(fieldsA1.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('TypeA');
        expect(fieldsB1.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('TypeB');
        expect(fieldsA2.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('TypeA');
        expect(fieldsB2.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('TypeB');

        // Descriptions should also be isolated
        expect(fieldsA1.find(f => f.fieldName === 'Description')?.fieldValue).toBe('DescA');
        expect(fieldsB1.find(f => f.fieldName === 'Description')?.fieldValue).toBe('DescB');
    });
});

/**
 * Regression tests for edge cases and error handling.
 * These tests prevent regressions in critical paths.
 */
describe('Regression: deleteLeafNode guard', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    it('successfully deletes a leaf node', async () => {
        const id = testId();
        createdNodeIds.push(id);

        await createNodeWithDefaultFields({
            id,
            parentId: null,
            nodeName: 'Leaf to delete',
            nodeSubtitle: '',
            defaults: [],
        });

        await settle();
        await deleteLeafNode(id);

        const node = await nodeService.getNodeById(id);
        expect(node).toBeNull();
    });

    it('throws when trying to delete a node with children', async () => {
        const parentId = testId();
        const childId = testId();
        createdNodeIds.push(parentId, childId);

        await createNodeWithDefaultFields({
            id: parentId,
            parentId: null,
            nodeName: 'Parent with child',
            nodeSubtitle: '',
            defaults: [],
        });

        await createNodeWithDefaultFields({
            id: childId,
            parentId,
            nodeName: 'Child node',
            nodeSubtitle: '',
            defaults: [],
        });

        await settle();
        
        await expect(deleteLeafNode(parentId)).rejects.toThrow('Only leaf nodes can be deleted');
    });
});

describe('Regression: updateFieldValue error handling', () => {
    it('throws when updating a non-existent field', async () => {
        await expect(updateFieldValue('nonexistent-field-id-12345', 'value'))
            .rejects.toThrow('Field not found');
    });
});

/**
 * DataFieldHistory tests - verify history is recorded correctly.
 */
describe('DataFieldHistory', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    it('records create history when adding a field', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);

        await createNodeWithDefaultFields({
            id: nodeId,
            parentId: null,
            nodeName: 'Node for history test',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Type Of', fieldValue: 'Initial' }],
        });

        await settle();
        const fields = await fieldService.getFieldsForNode(nodeId);
        const field = fields[0];

        const history = await fieldService.getFieldHistory(field.id);
        
        expect(history.length).toBe(1);
        expect(history[0].action).toBe('create');
        expect(history[0].prevValue).toBeNull();
        expect(history[0].newValue).toBe('Initial');
        expect(history[0].rev).toBe(0);
    });

    it('records update history with previous and new values', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);

        await createNodeWithDefaultFields({
            id: nodeId,
            parentId: null,
            nodeName: 'Node for update history',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Description', fieldValue: 'Before' }],
        });

        await settle();
        const fields = await fieldService.getFieldsForNode(nodeId);
        const field = fields[0];

        await fieldService.updateFieldValue(field.id, 'After');
        await settle();

        const history = await fieldService.getFieldHistory(field.id);
        
        expect(history.length).toBe(2);
        
        // First entry is create
        expect(history[0].action).toBe('create');
        expect(history[0].rev).toBe(0);
        
        // Second entry is update
        expect(history[1].action).toBe('update');
        expect(history[1].prevValue).toBe('Before');
        expect(history[1].newValue).toBe('After');
        expect(history[1].rev).toBe(1);
    });

    it('records delete history', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);

        await createNodeWithDefaultFields({
            id: nodeId,
            parentId: null,
            nodeName: 'Node for delete history',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Tags', fieldValue: 'test-value' }],
        });

        await settle();
        const fields = await fieldService.getFieldsForNode(nodeId);
        const field = fields[0];
        const fieldId = field.id;

        await fieldService.deleteField(fieldId);
        await settle();

        const history = await fieldService.getFieldHistory(fieldId);
        
        expect(history.length).toBe(2);
        
        // Last entry should be delete
        const deleteEntry = history[history.length - 1];
        expect(deleteEntry.action).toBe('delete');
        expect(deleteEntry.prevValue).toBe('test-value');
        expect(deleteEntry.newValue).toBeNull();
    });

    it('returns history sorted by rev ascending', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);

        await createNodeWithDefaultFields({
            id: nodeId,
            parentId: null,
            nodeName: 'Node for history order',
            nodeSubtitle: '',
            defaults: [{ fieldName: 'Note', fieldValue: 'v0' }],
        });

        await settle();
        const fields = await fieldService.getFieldsForNode(nodeId);
        const field = fields[0];

        // Make several updates
        await fieldService.updateFieldValue(field.id, 'v1');
        await settle();
        await fieldService.updateFieldValue(field.id, 'v2');
        await settle();
        await fieldService.updateFieldValue(field.id, 'v3');
        await settle();

        const history = await fieldService.getFieldHistory(field.id);
        
        expect(history.length).toBe(4);
        
        // Verify sorted by rev
        for (let i = 1; i < history.length; i++) {
            expect(history[i].rev).toBeGreaterThan(history[i - 1].rev);
        }
        
        // Verify values track correctly
        expect(history[0].newValue).toBe('v0');
        expect(history[1].newValue).toBe('v1');
        expect(history[2].newValue).toBe('v2');
        expect(history[3].newValue).toBe('v3');
    });
});

