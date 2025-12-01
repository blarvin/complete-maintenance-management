/**
 * Tests for the Data Access Service Layer.
 * These services abstract the repo layer so components don't depend on Firestore directly.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { nodeService } from '../data/services/nodeService';
import { fieldService } from '../data/services/fieldService';
import { createNodeWithDefaultFields } from '../data/services/createNode';
import { DEFAULT_DATAFIELD_NAMES } from '../data/fieldLibrary';

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
});

