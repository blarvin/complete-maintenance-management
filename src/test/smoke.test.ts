/**
 * Smoke test - verifies the test framework and Firestore connection work.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { createNode, getNodeById, deleteLeafNode } from '../data/repo/treeNodes';
import { addField, listFieldsForNode, updateFieldValue, deleteField } from '../data/repo/dataFields';

describe('Smoke Tests', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        // Clean up all test nodes created in this suite
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    it('connects to Firestore', async () => {
        // If this doesn't throw, we're connected
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
        expect(node.updatedBy).toBe('localUser');
        expect(node.updatedAt).toBeTypeOf('number');
    });

    it('creates and retrieves a node', async () => {
        const id = testId();
        createdNodeIds.push(id);
        
        await createNode({
            id,
            nodeName: 'Test Retrieval',
            nodeSubtitle: 'Should be retrievable',
            parentId: null,
        });
        
        await settle();
        
        const retrieved = await getNodeById(id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.nodeName).toBe('Test Retrieval');
    });

    it('creates and retrieves fields for a node', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);
        
        await createNode({
            id: nodeId,
            nodeName: 'Node With Fields',
            nodeSubtitle: '',
            parentId: null,
        });
        
        const fieldId = testId();
        await addField({
            id: fieldId,
            fieldName: 'Test Field',
            parentNodeId: nodeId,
            fieldValue: 'Initial Value',
        });
        
        await settle();
        
        const fields = await listFieldsForNode(nodeId);
        expect(fields.length).toBe(1);
        expect(fields[0].fieldName).toBe('Test Field');
        expect(fields[0].fieldValue).toBe('Initial Value');
    });

    it('updates a field value', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);
        
        await createNode({
            id: nodeId,
            nodeName: 'Node For Update',
            nodeSubtitle: '',
            parentId: null,
        });
        
        const fieldId = testId();
        await addField({
            id: fieldId,
            fieldName: 'Editable Field',
            parentNodeId: nodeId,
            fieldValue: 'Before',
        });
        
        await updateFieldValue(fieldId, 'After');
        await settle();
        
        const fields = await listFieldsForNode(nodeId);
        expect(fields[0].fieldValue).toBe('After');
    });

    it('deletes a field', async () => {
        const nodeId = testId();
        createdNodeIds.push(nodeId);
        
        await createNode({
            id: nodeId,
            nodeName: 'Node For Delete',
            nodeSubtitle: '',
            parentId: null,
        });
        
        const fieldId = testId();
        await addField({
            id: fieldId,
            fieldName: 'Deletable Field',
            parentNodeId: nodeId,
            fieldValue: 'Will be deleted',
        });
        
        await settle();
        let fields = await listFieldsForNode(nodeId);
        expect(fields.length).toBe(1);
        
        await deleteField(fieldId);
        await settle();
        
        fields = await listFieldsForNode(nodeId);
        expect(fields.length).toBe(0);
    });
});
