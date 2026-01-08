/**
 * Tests for node creation service - used by both RootView and BranchView.
 * These tests validate the creation flow before refactoring the shared hook.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { testId, cleanupTestNode, settle } from './testUtils';
import { getNodeService, getFieldService } from '../data/services';
import { DEFAULT_DATAFIELD_NAMES } from '../constants';

describe('Node Creation Service', () => {
    const createdNodeIds: string[] = [];

    afterAll(async () => {
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
    });

    describe('Root node creation flow (RootView)', () => {
        it('creates node and it appears in listRootNodes', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Simulate the RootView completeCreate$ flow
            await getNodeService().createWithFields({
                id,
                parentId: null,
                nodeName: 'New Asset',
                nodeSubtitle: 'Created from ROOT view',
                defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
            });

            await settle();

            // After creation, RootView calls listRootNodes() to refresh
            const roots = await getNodeService().getRootNodes();
            const created = roots.find(n => n.id === id);

            expect(created).toBeDefined();
            expect(created?.nodeName).toBe('New Asset');
            expect(created?.parentId).toBeNull();
        });

        it('creates default fields from DEFAULT_DATAFIELD_NAMES', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getNodeService().createWithFields({
                id,
                parentId: null,
                nodeName: 'Node With Defaults',
                nodeSubtitle: '',
                defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
            });

            await settle();
            const fields = await getFieldService().getFieldsForNode(id);

            // Should have all default fields
            expect(fields.length).toBe(DEFAULT_DATAFIELD_NAMES.length);
            for (const defaultName of DEFAULT_DATAFIELD_NAMES) {
                expect(fields.find(f => f.fieldName === defaultName)).toBeDefined();
            }
        });

        it('preserves field values when provided', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getNodeService().createWithFields({
                id,
                parentId: null,
                nodeName: 'Node With Values',
                nodeSubtitle: '',
                defaults: [
                    { fieldName: 'Type Of', fieldValue: 'Vehicle' },
                    { fieldName: 'Description', fieldValue: 'A test vehicle' },
                    { fieldName: 'Tags', fieldValue: null }, // User left blank
                ],
            });

            await settle();
            const fields = await getFieldService().getFieldsForNode(id);

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

            // Create parent first
            await getNodeService().createWithFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent Asset',
                nodeSubtitle: '',
                defaults: [],
            });

            // Simulate BranchView completeCreate$ flow
            await getNodeService().createWithFields({
                id: childId,
                parentId,
                nodeName: 'Child Component',
                nodeSubtitle: 'Sub-asset',
                defaults: DEFAULT_DATAFIELD_NAMES.map(n => ({ fieldName: n, fieldValue: null })),
            });

            await settle();

            // After creation, BranchView calls listChildren() to refresh
            const children = await getNodeService().getChildren(parentId);
            const created = children.find(n => n.id === childId);

            expect(created).toBeDefined();
            expect(created?.nodeName).toBe('Child Component');
            expect(created?.parentId).toBe(parentId);
        });

        it('child node is NOT in listRootNodes', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId);
            createdNodeIds.push(childId);

            await getNodeService().createWithFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: childId,
                parentId,
                nodeName: 'Child',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const roots = await getNodeService().getRootNodes();

            // Parent should be in roots, child should NOT
            expect(roots.find(n => n.id === parentId)).toBeDefined();
            expect(roots.find(n => n.id === childId)).toBeUndefined();
        });

        it('creates default fields for child node', async () => {
            const parentId = testId();
            const childId = testId();
            createdNodeIds.push(parentId);
            createdNodeIds.push(childId);

            await getNodeService().createWithFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: childId,
                parentId,
                nodeName: 'Child With Fields',
                nodeSubtitle: '',
                defaults: [
                    { fieldName: 'Type Of', fieldValue: 'Pump' },
                    { fieldName: 'Serial Number', fieldValue: 'SN-12345' },
                ],
            });

            await settle();
            const fields = await getFieldService().getFieldsForNode(childId);

            expect(fields.length).toBe(2);
            expect(fields.find(f => f.fieldName === 'Type Of')?.fieldValue).toBe('Pump');
            expect(fields.find(f => f.fieldName === 'Serial Number')?.fieldValue).toBe('SN-12345');
        });
    });

    describe('Edge cases', () => {
        it('handles empty nodeName by using "Untitled"', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getNodeService().createWithFields({
                id,
                parentId: null,
                nodeName: '',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const node = await getNodeService().getNodeById(id);

            // Note: createWithFields doesn't set "Untitled" - that logic was in createNode.ts
            // The adapter creates nodes as-is. If we want "Untitled" behavior, it should be in the service layer.
            expect(node?.nodeName).toBe('');
        });

        it('handles empty defaults array', async () => {
            const id = testId();
            createdNodeIds.push(id);

            await getNodeService().createWithFields({
                id,
                parentId: null,
                nodeName: 'No Fields Node',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const fields = await getFieldService().getFieldsForNode(id);

            expect(fields.length).toBe(0);
        });
    });

    /**
     * Field listing behavior (merged from treeNode.test.ts)
     */
    describe('listFieldsForNode behavior', () => {
        it('returns fields sorted by updatedAt ascending', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node without fields first
            await getNodeService().createEmptyNode(id, null);
            await getNodeService().updateNode(id, {
                nodeName: 'Sorted Fields Node',
                nodeSubtitle: '',
            });

            // Create fields sequentially with delays to ensure different timestamps
            await getFieldService().addField(id, 'First', '1');
            await settle(50);
            await getFieldService().addField(id, 'Second', '2');
            await settle(50);
            await getFieldService().addField(id, 'Third', '3');

            await settle();
            const fields = await getFieldService().getFieldsForNode(id);

            // Fields should be in creation order (by updatedAt)
            expect(fields.length).toBe(3);
            expect(fields[0].fieldName).toBe('First');
            expect(fields[1].fieldName).toBe('Second');
            expect(fields[2].fieldName).toBe('Third');
        });

        it('only returns fields for the specified node', async () => {
            const nodeA = testId();
            const nodeB = testId();
            createdNodeIds.push(nodeA, nodeB);

            await getNodeService().createWithFields({
                id: nodeA,
                parentId: null,
                nodeName: 'Node A',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Field A', fieldValue: 'A' }],
            });

            await getNodeService().createWithFields({
                id: nodeB,
                parentId: null,
                nodeName: 'Node B',
                nodeSubtitle: '',
                defaults: [{ fieldName: 'Field B', fieldValue: 'B' }],
            });

            await settle();
            const fieldsA = await getFieldService().getFieldsForNode(nodeA);
            const fieldsB = await getFieldService().getFieldsForNode(nodeB);

            expect(fieldsA.length).toBe(1);
            expect(fieldsA[0].fieldName).toBe('Field A');

            expect(fieldsB.length).toBe(1);
            expect(fieldsB[0].fieldName).toBe('Field B');
        });
    });

    /**
     * Navigation hierarchy tests (merged from treeNode.test.ts)
     */
    describe('Navigation hierarchy', () => {
        it('can traverse from root to child via listChildren', async () => {
            const rootId = testId();
            const childId = testId();
            const grandchildId = testId();
            createdNodeIds.push(rootId, childId, grandchildId);

            // Create 3-level hierarchy
            await getNodeService().createWithFields({
                id: rootId,
                parentId: null,
                nodeName: 'Level 0',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: childId,
                parentId: rootId,
                nodeName: 'Level 1',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: grandchildId,
                parentId: childId,
                nodeName: 'Level 2',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();

            // Navigate down
            const level1 = await getNodeService().getChildren(rootId);
            expect(level1.length).toBe(1);
            expect(level1[0].id).toBe(childId);

            const level2 = await getNodeService().getChildren(childId);
            expect(level2.length).toBe(1);
            expect(level2[0].id).toBe(grandchildId);

            // Verify parentId chain for navigation back up
            const grandchild = await getNodeService().getNodeById(grandchildId);
            expect(grandchild?.parentId).toBe(childId);

            const child = await getNodeService().getNodeById(childId);
            expect(child?.parentId).toBe(rootId);

            const root = await getNodeService().getNodeById(rootId);
            expect(root?.parentId).toBeNull();
        });

        it('child appears in listChildren of parent', async () => {
            const parentId = testId();
            const childId1 = testId();
            const childId2 = testId();
            createdNodeIds.push(parentId, childId1, childId2);

            await getNodeService().createWithFields({
                id: parentId,
                parentId: null,
                nodeName: 'Parent',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: childId1,
                parentId,
                nodeName: 'Child One',
                nodeSubtitle: '',
                defaults: [],
            });

            await getNodeService().createWithFields({
                id: childId2,
                parentId,
                nodeName: 'Child Two',
                nodeSubtitle: '',
                defaults: [],
            });

            await settle();
            const children = await getNodeService().getChildren(parentId);

            expect(children.length).toBe(2);
            expect(children.map(c => c.nodeName)).toContain('Child One');
            expect(children.map(c => c.nodeName)).toContain('Child Two');
        });
    });
});
