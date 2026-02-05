/**
 * TDD Tests for IDBAdapter - IndexedDB implementation of StorageAdapter
 *
 * These tests define the contract for the IDBAdapter before implementation.
 * Run these tests BEFORE implementing the adapter - they should all FAIL initially.
 * Then implement the adapter to make them pass (Red → Green → Refactor).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { db } from '../data/storage/db';
import { testId } from './testUtils';

describe('IDBAdapter - Core Storage Operations', () => {
    let adapter: IDBAdapter;

    beforeEach(async () => {
        adapter = new IDBAdapter();
        // Clear IDB before each test for clean slate
        await db.delete();
        await db.open();
    });

    afterEach(async () => {
        await db.delete();
    });

    describe('Node Operations', () => {
        it('creates node and persists to IndexedDB', async () => {
            const id = testId();
            const result = await adapter.createNode({
                id,
                parentId: null,
                nodeName: 'Test Node',
                nodeSubtitle: 'Test Subtitle',
            });

            // Verify returned data
            expect(result.data.id).toBe(id);
            expect(result.data.nodeName).toBe('Test Node');
            expect(result.data.nodeSubtitle).toBe('Test Subtitle');
            expect(result.data.parentId).toBeNull();
            expect(result.data.updatedBy).toBeDefined();
            expect(result.data.updatedAt).toBeTypeOf('number');
            expect(result.meta?.adapter).toBe('idb');

            // Verify actually persisted to IDB
            const retrieved = await adapter.getNode(id);
            expect(retrieved.data).toBeDefined();
            expect(retrieved.data?.nodeName).toBe('Test Node');
        });

        it('lists root nodes from IndexedDB', async () => {
            const id1 = testId();
            const id2 = testId();
            const childId = testId();

            await adapter.createNode({ id: id1, parentId: null, nodeName: 'Root 1', nodeSubtitle: '' });
            await adapter.createNode({ id: id2, parentId: null, nodeName: 'Root 2', nodeSubtitle: '' });
            await adapter.createNode({ id: childId, parentId: id1, nodeName: 'Child', nodeSubtitle: '' });

            const result = await adapter.listRootNodes();

            // Should only contain root nodes (parentId = null)
            expect(result.data.length).toBe(2);
            expect(result.data.find(n => n.id === id1)).toBeDefined();
            expect(result.data.find(n => n.id === id2)).toBeDefined();
            expect(result.data.find(n => n.id === childId)).toBeUndefined();
        });

        it('lists children for a parent node', async () => {
            const parentId = testId();
            const childId1 = testId();
            const childId2 = testId();
            const otherId = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            await adapter.createNode({ id: childId1, parentId, nodeName: 'Child 1', nodeSubtitle: '' });
            await adapter.createNode({ id: childId2, parentId, nodeName: 'Child 2', nodeSubtitle: '' });
            await adapter.createNode({ id: otherId, parentId: null, nodeName: 'Other Root', nodeSubtitle: '' });

            const result = await adapter.listChildren(parentId);

            expect(result.data.length).toBe(2);
            expect(result.data.find(n => n.id === childId1)).toBeDefined();
            expect(result.data.find(n => n.id === childId2)).toBeDefined();
            expect(result.data.find(n => n.id === otherId)).toBeUndefined();
        });

        it('gets node by ID', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Get Test', nodeSubtitle: 'Sub' });

            const result = await adapter.getNode(id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(id);
            expect(result.data?.nodeName).toBe('Get Test');
            expect(result.data?.nodeSubtitle).toBe('Sub');
        });

        it('returns null for non-existent node', async () => {
            const result = await adapter.getNode('nonexistent-id-12345');

            expect(result.data).toBeNull();
        });

        it('updates node in IndexedDB', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Original', nodeSubtitle: 'Old' });

            await adapter.updateNode(id, { nodeName: 'Updated', nodeSubtitle: 'New' });

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data?.nodeName).toBe('Updated');
            expect(retrieved.data?.nodeSubtitle).toBe('New');
        });

        it('updates only specified fields', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Original', nodeSubtitle: 'Original Sub' });

            // Update only nodeName
            await adapter.updateNode(id, { nodeName: 'Updated' });

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data?.nodeName).toBe('Updated');
            expect(retrieved.data?.nodeSubtitle).toBe('Original Sub'); // Unchanged
        });

        it('soft deletes node (sets deletedAt instead of removing)', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            await adapter.deleteNode(id);

            // Node still exists but has deletedAt set
            const retrieved = await adapter.getNode(id);
            expect(retrieved.data).not.toBeNull();
            expect(retrieved.data?.deletedAt).not.toBeNull();
            expect(retrieved.data?.deletedAt).toBeTypeOf('number');
        });

        it('soft deleted node is excluded from listRootNodes', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            await adapter.deleteNode(id);

            const result = await adapter.listRootNodes();
            expect(result.data.find(n => n.id === id)).toBeUndefined();
        });

        it('soft deletes node with children (children implicitly hidden)', async () => {
            const parentId = testId();
            const childId = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            await adapter.createNode({ id: childId, parentId, nodeName: 'Child', nodeSubtitle: '' });

            // Soft delete should succeed (no leaf-only restriction)
            await adapter.deleteNode(parentId);

            const retrieved = await adapter.getNode(parentId);
            expect(retrieved.data?.deletedAt).not.toBeNull();
        });
    });

    describe('Field Operations', () => {
        it('creates field and persists to IndexedDB', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            const result = await adapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Test Field',
                fieldValue: 'Test Value',
            });

            expect(result.data.id).toBe(fieldId);
            expect(result.data.fieldName).toBe('Test Field');
            expect(result.data.fieldValue).toBe('Test Value');
            expect(result.data.parentNodeId).toBe(nodeId);
            expect(result.data.cardOrder).toBeTypeOf('number');
            expect(result.meta?.adapter).toBe('idb');
        });

        it('lists fields for a node', async () => {
            const nodeId = testId();
            const field1Id = testId();
            const field2Id = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: field1Id, parentNodeId: nodeId, fieldName: 'Field 1', fieldValue: 'Val 1' });
            await adapter.createField({ id: field2Id, parentNodeId: nodeId, fieldName: 'Field 2', fieldValue: 'Val 2' });

            const result = await adapter.listFields(nodeId);

            expect(result.data.length).toBe(2);
            expect(result.data.find(f => f.id === field1Id)).toBeDefined();
            expect(result.data.find(f => f.id === field2Id)).toBeDefined();
        });

        it('returns fields sorted by cardOrder', async () => {
            const nodeId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Field 2', fieldValue: null, cardOrder: 2 });
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Field 0', fieldValue: null, cardOrder: 0 });
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Field 1', fieldValue: null, cardOrder: 1 });

            const result = await adapter.listFields(nodeId);

            expect(result.data[0].fieldName).toBe('Field 0');
            expect(result.data[1].fieldName).toBe('Field 1');
            expect(result.data[2].fieldName).toBe('Field 2');
        });

        it('calculates next cardOrder correctly', async () => {
            const nodeId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Empty node
            let result = await adapter.nextCardOrder(nodeId);
            expect(result.data).toBe(0);

            // Add field with cardOrder 0
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Field 1', fieldValue: null, cardOrder: 0 });
            result = await adapter.nextCardOrder(nodeId);
            expect(result.data).toBe(1);

            // Add another
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Field 2', fieldValue: null, cardOrder: 1 });
            result = await adapter.nextCardOrder(nodeId);
            expect(result.data).toBe(2);
        });

        it('updates field value', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Original' });

            await adapter.updateFieldValue(fieldId, { fieldValue: 'Updated' });

            const fields = await adapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field?.fieldValue).toBe('Updated');
        });

        it('allows setting field value to null', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Has Value' });

            await adapter.updateFieldValue(fieldId, { fieldValue: null });

            const fields = await adapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field?.fieldValue).toBeNull();
        });

        it('deletes field from IndexedDB', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            await adapter.deleteField(fieldId);

            const fields = await adapter.listFields(nodeId);
            expect(fields.data.find(f => f.id === fieldId)).toBeUndefined();
        });
    });

    describe('History Operations', () => {
        it('creates history entry when creating field', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Initial' });

            const history = await adapter.getFieldHistory(fieldId);

            expect(history.data.length).toBe(1);
            expect(history.data[0].action).toBe('create');
            expect(history.data[0].prevValue).toBeNull();
            expect(history.data[0].newValue).toBe('Initial');
            expect(history.data[0].rev).toBe(0);
        });

        it('creates history entry when updating field', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Before' });
            await adapter.updateFieldValue(fieldId, { fieldValue: 'After' });

            const history = await adapter.getFieldHistory(fieldId);

            expect(history.data.length).toBe(2);
            expect(history.data[0].action).toBe('create');
            expect(history.data[1].action).toBe('update');
            expect(history.data[1].prevValue).toBe('Before');
            expect(history.data[1].newValue).toBe('After');
            expect(history.data[1].rev).toBe(1);
        });

        it('creates history entry when deleting field', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'To Delete' });
            await adapter.deleteField(fieldId);

            const history = await adapter.getFieldHistory(fieldId);

            expect(history.data.length).toBe(2);
            expect(history.data[0].action).toBe('create');
            expect(history.data[1].action).toBe('delete');
            expect(history.data[1].prevValue).toBe('To Delete');
            expect(history.data[1].newValue).toBeNull();
        });

        it('returns history sorted by rev ascending', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'v0' });
            await adapter.updateFieldValue(fieldId, { fieldValue: 'v1' });
            await adapter.updateFieldValue(fieldId, { fieldValue: 'v2' });

            const history = await adapter.getFieldHistory(fieldId);

            expect(history.data.length).toBe(3);
            expect(history.data[0].rev).toBe(0);
            expect(history.data[1].rev).toBe(1);
            expect(history.data[2].rev).toBe(2);
            expect(history.data[0].newValue).toBe('v0');
            expect(history.data[1].newValue).toBe('v1');
            expect(history.data[2].newValue).toBe('v2');
        });
    });

    describe('Sync Queue Operations', () => {
        it('enqueues create-node operation', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const op = queue.find(item => item.operation === 'create-node' && item.entityId === id);

            expect(op).toBeDefined();
            expect(op?.status).toBe('pending');
            expect(op?.entityType).toBe('node');
            expect(op?.payload).toBeDefined();
        });

        it('enqueues update-node operation', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Clear queue
            const createQueue = await adapter.syncQueue.getSyncQueue();
            for (const item of createQueue) {
                await adapter.syncQueue.markSynced(item.id);
            }

            await adapter.updateNode(id, { nodeName: 'Updated' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const op = queue.find(item => item.operation === 'update-node' && item.entityId === id);

            expect(op).toBeDefined();
        });

        it('enqueues create-field operation', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const op = queue.find(item => item.operation === 'create-field' && item.entityId === fieldId);

            expect(op).toBeDefined();
            expect(op?.entityType).toBe('field');
        });

        it('marks queue item as synced', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const item = queue.find(i => i.entityId === id);
            expect(item).toBeDefined();

            await adapter.syncQueue.markSynced(item!.id);

            const updatedQueue = await adapter.syncQueue.getSyncQueue();
            expect(updatedQueue.find(i => i.id === item!.id)).toBeUndefined();
        });

        it('marks queue item as failed with error message', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const item = queue.find(i => i.entityId === id);

            await adapter.syncQueue.markFailed(item!.id, new Error('Test error'));

            // Failed items should still be in queue but with status='failed'
            const allQueue = await db.syncQueue.toArray();
            const failedItem = allQueue.find(i => i.id === item!.id);

            expect(failedItem).toBeDefined();
            expect(failedItem?.status).toBe('failed');
            expect(failedItem?.lastError).toContain('Test error');
            expect(failedItem?.retryCount).toBe(1);
        });

        it('returns only pending items from getSyncQueue', async () => {
            const id1 = testId();
            const id2 = testId();

            await adapter.createNode({ id: id1, parentId: null, nodeName: 'Node 1', nodeSubtitle: '' });
            await adapter.createNode({ id: id2, parentId: null, nodeName: 'Node 2', nodeSubtitle: '' });

            const queue = await adapter.syncQueue.getSyncQueue();
            const item1 = queue.find(i => i.entityId === id1);

            // Mark one as synced
            await adapter.syncQueue.markSynced(item1!.id);

            const pendingQueue = await adapter.syncQueue.getSyncQueue();
            expect(pendingQueue.find(i => i.entityId === id1)).toBeUndefined();
            expect(pendingQueue.find(i => i.entityId === id2)).toBeDefined();
        });
    });

    describe('Sync Metadata Operations', () => {
        it('gets and sets lastSyncTimestamp', async () => {
            const now = Date.now();

            await adapter.setLastSyncTimestamp(now);
            const retrieved = await adapter.getLastSyncTimestamp();

            expect(retrieved).toBe(now);
        });

        it('returns 0 for lastSyncTimestamp when never synced', async () => {
            const timestamp = await adapter.getLastSyncTimestamp();
            expect(timestamp).toBe(0);
        });

        it('updates lastSyncTimestamp', async () => {
            await adapter.setLastSyncTimestamp(1000);
            await adapter.setLastSyncTimestamp(2000);

            const timestamp = await adapter.getLastSyncTimestamp();
            expect(timestamp).toBe(2000);
        });
    });

    describe('Remote Update Application', () => {
        it('applies remote node update to IDB', async () => {
            const node = {
                id: 'remote-node',
                parentId: null,
                nodeName: 'Remote Node',
                nodeSubtitle: 'From Server',
                updatedBy: 'remoteUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await adapter.applyRemoteUpdate('node', node);

            const retrieved = await adapter.getNode('remote-node');
            expect(retrieved.data).toBeDefined();
            expect(retrieved.data?.nodeName).toBe('Remote Node');
        });

        it('applies remote field update to IDB', async () => {
            const nodeId = testId();
            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            const field = {
                id: 'remote-field',
                parentNodeId: nodeId,
                fieldName: 'Remote Field',
                fieldValue: 'From Server',
                cardOrder: 0,
                updatedBy: 'remoteUser',
                updatedAt: Date.now(),
                deletedAt: null, // Include deletedAt for soft delete compatibility
            };

            await adapter.applyRemoteUpdate('field', field);

            const fields = await adapter.listFields(nodeId);
            const retrieved = fields.data.find(f => f.id === 'remote-field');
            expect(retrieved).toBeDefined();
            expect(retrieved?.fieldValue).toBe('From Server');
        });
    });

    describe('History Sync Operations', () => {
        it('getAllHistory returns all history entries', async () => {
            const nodeId = testId();
            const fieldId = testId();

            // Create node and field (field creation creates history)
            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Field',
                fieldValue: 'Initial',
            });

            // Update field (creates another history entry)
            await adapter.updateFieldValue(fieldId, { fieldValue: 'Updated' });

            const allHistory = await adapter.getAllHistory();

            expect(allHistory.length).toBe(2);
            expect(allHistory.some(h => h.action === 'create')).toBe(true);
            expect(allHistory.some(h => h.action === 'update')).toBe(true);
        });

        it('getAllHistory returns empty array when no history exists', async () => {
            const allHistory = await adapter.getAllHistory();
            expect(allHistory).toEqual([]);
        });

        it('applyRemoteHistory inserts new history entry', async () => {
            const historyEntry = {
                id: 'field123:0',
                dataFieldId: 'field123',
                parentNodeId: 'node123',
                action: 'create' as const,
                property: 'fieldValue' as const,
                prevValue: null,
                newValue: 'test value',
                updatedBy: 'remoteUser',
                updatedAt: Date.now(),
                rev: 0,
            };

            await adapter.applyRemoteHistory(historyEntry);

            const allHistory = await adapter.getAllHistory();
            expect(allHistory.length).toBe(1);
            expect(allHistory[0].id).toBe('field123:0');
            expect(allHistory[0].newValue).toBe('test value');
        });

        it('applyRemoteHistory upserts existing history entry', async () => {
            const historyEntry = {
                id: 'field123:0',
                dataFieldId: 'field123',
                parentNodeId: 'node123',
                action: 'create' as const,
                property: 'fieldValue' as const,
                prevValue: null,
                newValue: 'original',
                updatedBy: 'remoteUser',
                updatedAt: Date.now(),
                rev: 0,
            };

            // Insert first
            await adapter.applyRemoteHistory(historyEntry);

            // Upsert with updated value (simulating remote update)
            const updatedEntry = { ...historyEntry, newValue: 'updated from remote' };
            await adapter.applyRemoteHistory(updatedEntry);

            const allHistory = await adapter.getAllHistory();
            expect(allHistory.length).toBe(1); // Still just one entry
            expect(allHistory[0].newValue).toBe('updated from remote');
        });

        it('applyRemoteHistory preserves existing local history when adding remote', async () => {
            const nodeId = testId();
            const fieldId = testId();

            // Create local history by creating a field
            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Local Field',
                fieldValue: 'Local Value',
            });

            // Add remote history for a different field
            const remoteHistory = {
                id: 'remote-field:0',
                dataFieldId: 'remote-field',
                parentNodeId: 'remote-node',
                action: 'create' as const,
                property: 'fieldValue' as const,
                prevValue: null,
                newValue: 'remote value',
                updatedBy: 'remoteUser',
                updatedAt: Date.now(),
                rev: 0,
            };

            await adapter.applyRemoteHistory(remoteHistory);

            const allHistory = await adapter.getAllHistory();
            expect(allHistory.length).toBe(2); // Local + remote
            expect(allHistory.some(h => h.dataFieldId === fieldId)).toBe(true);
            expect(allHistory.some(h => h.dataFieldId === 'remote-field')).toBe(true);
        });
    });

    describe('Soft Delete Operations - Nodes', () => {
        it('listDeletedNodes returns only soft-deleted nodes', async () => {
            const activeId = testId();
            const deletedId = testId();

            await adapter.createNode({ id: activeId, parentId: null, nodeName: 'Active', nodeSubtitle: '' });
            await adapter.createNode({ id: deletedId, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            // Soft delete one node
            await adapter.deleteNode(deletedId);

            const deleted = await adapter.listDeletedNodes();
            expect(deleted.data.length).toBe(1);
            expect(deleted.data[0].id).toBe(deletedId);
        });

        it('listDeletedChildren returns only soft-deleted children', async () => {
            const parentId = testId();
            const activeChildId = testId();
            const deletedChildId = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            await adapter.createNode({ id: activeChildId, parentId, nodeName: 'Active Child', nodeSubtitle: '' });
            await adapter.createNode({ id: deletedChildId, parentId, nodeName: 'Deleted Child', nodeSubtitle: '' });

            // Soft delete one child
            await adapter.deleteNode(deletedChildId);

            const activeChildren = await adapter.listChildren(parentId);
            expect(activeChildren.data.length).toBe(1);
            expect(activeChildren.data[0].id).toBe(activeChildId);

            const deletedChildren = await adapter.listDeletedChildren(parentId);
            expect(deletedChildren.data.length).toBe(1);
            expect(deletedChildren.data[0].id).toBe(deletedChildId);
        });

        it('restoreNode clears deletedAt and makes node visible again', async () => {
            const id = testId();

            await adapter.createNode({ id, parentId: null, nodeName: 'To Restore', nodeSubtitle: '' });
            await adapter.deleteNode(id);

            // Verify deleted
            const beforeRestore = await adapter.listRootNodes();
            expect(beforeRestore.data.find(n => n.id === id)).toBeUndefined();

            // Restore
            await adapter.restoreNode(id);

            // Verify restored
            const afterRestore = await adapter.listRootNodes();
            expect(afterRestore.data.find(n => n.id === id)).toBeDefined();

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data?.deletedAt).toBeNull();
        });
    });

    describe('Soft Delete Operations - Fields', () => {
        it('soft deleted field is excluded from listFields', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            // Soft delete
            await adapter.deleteField(fieldId);

            const fields = await adapter.listFields(nodeId);
            expect(fields.data.find(f => f.id === fieldId)).toBeUndefined();
        });

        it('listDeletedFields returns only soft-deleted fields', async () => {
            const nodeId = testId();
            const activeFieldId = testId();
            const deletedFieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: activeFieldId, parentNodeId: nodeId, fieldName: 'Active', fieldValue: 'V1' });
            await adapter.createField({ id: deletedFieldId, parentNodeId: nodeId, fieldName: 'Deleted', fieldValue: 'V2' });

            // Soft delete one field
            await adapter.deleteField(deletedFieldId);

            const deletedFields = await adapter.listDeletedFields(nodeId);
            expect(deletedFields.data.length).toBe(1);
            expect(deletedFields.data[0].id).toBe(deletedFieldId);
        });

        it('restoreField clears deletedAt and makes field visible again', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });
            await adapter.deleteField(fieldId);

            // Verify deleted
            const beforeRestore = await adapter.listFields(nodeId);
            expect(beforeRestore.data.find(f => f.id === fieldId)).toBeUndefined();

            // Restore
            await adapter.restoreField(fieldId);

            // Verify restored
            const afterRestore = await adapter.listFields(nodeId);
            expect(afterRestore.data.find(f => f.id === fieldId)).toBeDefined();
        });

        it('soft delete field creates history entry with action delete', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            // Soft delete
            await adapter.deleteField(fieldId);

            const history = await adapter.getFieldHistory(fieldId);
            const deleteEntry = history.data.find(h => h.action === 'delete');
            expect(deleteEntry).toBeDefined();
            expect(deleteEntry?.prevValue).toBe('Value');
            expect(deleteEntry?.newValue).toBeNull();
        });
    });
});
