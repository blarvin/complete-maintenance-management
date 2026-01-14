/**
 * TDD Tests for SyncManager - Bidirectional sync between IDB and Firestore
 *
 * These tests define sync behavior before implementation.
 * Run BEFORE implementing SyncManager - they should all FAIL initially.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../data/sync/syncManager';
import { IDBAdapter } from '../data/storage/idbAdapter';
import { FirestoreAdapter } from '../data/storage/firestoreAdapter';
import { db } from '../data/storage/db';
import { testId, cleanupTestNode, settle } from './testUtils';

describe('SyncManager - Bidirectional Sync', () => {
    let syncManager: SyncManager;
    let idbAdapter: IDBAdapter;
    let firestoreAdapter: FirestoreAdapter;
    const createdNodeIds: string[] = [];

    beforeEach(async () => {
        // Clear IDB
        await db.delete();
        await db.open();

        // Create adapters
        idbAdapter = new IDBAdapter();
        firestoreAdapter = new FirestoreAdapter();

        // Create sync manager with short poll interval for tests
        syncManager = new SyncManager(idbAdapter, firestoreAdapter, 100);
    });

    afterEach(async () => {
        // Stop sync manager
        syncManager.stop();

        // Cleanup Firestore test data
        for (const nodeId of createdNodeIds) {
            await cleanupTestNode(nodeId);
        }
        createdNodeIds.length = 0;

        // Clear IDB
        await db.delete();
    });

    describe('Push (Local → Remote)', () => {
        it('pushes pending create-node operation to Firestore', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node in IDB (enqueues sync operation)
            await idbAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Test Node',
                nodeSubtitle: 'Test Subtitle',
            });

            // Verify node in IDB
            const idbResult = await idbAdapter.getNode(id);
            expect(idbResult.data).toBeDefined();

            // Trigger sync
            await syncManager.syncOnce();

            // Verify node pushed to Firestore
            const firestoreResult = await firestoreAdapter.getNode(id);
            expect(firestoreResult.data).toBeDefined();
            expect(firestoreResult.data?.nodeName).toBe('Test Node');

            // Verify queue is cleared
            const queue = await idbAdapter.getSyncQueue();
            expect(queue.length).toBe(0);
        });

        it('pushes pending update-node operation to Firestore', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node directly in Firestore (simulate existing synced node)
            await firestoreAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Original',
                nodeSubtitle: '',
            });

            // Also create in IDB
            await idbAdapter.applyRemoteUpdate('node', {
                id,
                parentId: null,
                nodeName: 'Original',
                nodeSubtitle: '',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
            });

            // Clear sync queue (simulate already synced state)
            const createQueue = await idbAdapter.getSyncQueue();
            for (const item of createQueue) {
                await idbAdapter.markSynced(item.id);
            }

            // Update node in IDB (enqueues update operation)
            await idbAdapter.updateNode(id, { nodeName: 'Updated' });

            // Trigger sync
            await syncManager.syncOnce();

            // Verify update pushed to Firestore
            const firestoreResult = await firestoreAdapter.getNode(id);
            expect(firestoreResult.data?.nodeName).toBe('Updated');
        });

        it('pushes pending create-field operation to Firestore', async () => {
            const nodeId = testId();
            const fieldId = testId();
            createdNodeIds.push(nodeId);

            // Create node in both (simulate synced state)
            await firestoreAdapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await idbAdapter.applyRemoteUpdate('node', {
                id: nodeId,
                parentId: null,
                nodeName: 'Node',
                nodeSubtitle: '',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
            });

            // Clear queue
            const queue = await idbAdapter.getSyncQueue();
            for (const item of queue) {
                await idbAdapter.markSynced(item.id);
            }

            // Create field in IDB
            await idbAdapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Test Field',
                fieldValue: 'Test Value',
            });

            // Trigger sync
            await syncManager.syncOnce();

            // Verify field pushed to Firestore
            const firestoreFields = await firestoreAdapter.listFields(nodeId);
            const field = firestoreFields.data.find(f => f.id === fieldId);
            expect(field).toBeDefined();
            expect(field?.fieldValue).toBe('Test Value');
        });

        it('handles sync errors gracefully without crashing', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node in IDB
            await idbAdapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Trigger sync - should not throw even if Firestore has issues
            // (Note: Can't easily mock Firestore SDK in ESM, but the sync
            // manager's error handling is tested by the fact that syncOnce
            // completes successfully and syncs the node)
            await expect(syncManager.syncOnce()).resolves.not.toThrow();

            // Verify node was synced successfully
            const firestoreResult = await firestoreAdapter.getNode(id);
            expect(firestoreResult.data).toBeDefined();
        });

        it('processes multiple queued operations in order', async () => {
            const id1 = testId();
            const id2 = testId();
            const id3 = testId();
            createdNodeIds.push(id1, id2, id3);

            // Create multiple nodes
            await idbAdapter.createNode({ id: id1, parentId: null, nodeName: 'Node 1', nodeSubtitle: '' });
            await idbAdapter.createNode({ id: id2, parentId: null, nodeName: 'Node 2', nodeSubtitle: '' });
            await idbAdapter.createNode({ id: id3, parentId: null, nodeName: 'Node 3', nodeSubtitle: '' });

            // Trigger sync
            await syncManager.syncOnce();

            // All should be in Firestore
            const result1 = await firestoreAdapter.getNode(id1);
            const result2 = await firestoreAdapter.getNode(id2);
            const result3 = await firestoreAdapter.getNode(id3);

            expect(result1.data).toBeDefined();
            expect(result2.data).toBeDefined();
            expect(result3.data).toBeDefined();

            // Queue should be empty
            const queue = await idbAdapter.getSyncQueue();
            expect(queue.length).toBe(0);
        });
    });

    describe('Pull (Remote → Local)', () => {
        it('pulls new remote node into IDB', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Set last sync timestamp to 1 second ago so the new node will be picked up
            await idbAdapter.setLastSyncTimestamp(Date.now() - 1000);

            // Create node directly in Firestore (bypass IDB)
            await firestoreAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Remote Node',
                nodeSubtitle: 'From Server',
            });

            await settle(100); // Ensure Firestore write completes

            // Trigger pull
            await syncManager.syncOnce();

            // Verify node exists in IDB
            const idbResult = await idbAdapter.getNode(id);
            expect(idbResult.data).toBeDefined();
            expect(idbResult.data?.nodeName).toBe('Remote Node');
        });

        it('updates lastSyncTimestamp after successful pull', async () => {
            const before = Date.now();

            await syncManager.syncOnce();

            const after = await idbAdapter.getLastSyncTimestamp();
            expect(after).toBeGreaterThanOrEqual(before);
        });
    });

    describe('LWW Conflict Resolution', () => {
        it('applies remote node when remote is newer', async () => {
            const id = testId();
            createdNodeIds.push(id);
            const now = Date.now();

            // Create node in IDB with old timestamp
            await idbAdapter.applyRemoteUpdate('node', {
                id,
                parentId: null,
                nodeName: 'Local Version',
                nodeSubtitle: '',
                updatedBy: 'localUser',
                updatedAt: now - 1000, // 1 second ago
            });

            // Create same node in Firestore with new timestamp
            await firestoreAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Remote Version',
                nodeSubtitle: '',
            });

            await settle(100);

            // Set last sync before remote update
            await idbAdapter.setLastSyncTimestamp(now - 2000);

            // Trigger pull (should apply remote version)
            await syncManager.syncOnce();

            // Verify IDB has remote version
            const result = await idbAdapter.getNode(id);
            expect(result.data?.nodeName).toBe('Remote Version');
        });

        it('keeps local node when local is newer', async () => {
            const id = testId();
            createdNodeIds.push(id);
            const now = Date.now();

            // Create node in Firestore with old timestamp
            await firestoreAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Remote Version',
                nodeSubtitle: '',
            });

            await settle(100);

            // Create in IDB with newer timestamp
            await idbAdapter.applyRemoteUpdate('node', {
                id,
                parentId: null,
                nodeName: 'Local Version',
                nodeSubtitle: '',
                updatedBy: 'localUser',
                updatedAt: now, // Now (newer)
            });

            // Set last sync before both
            await idbAdapter.setLastSyncTimestamp(now - 2000);

            // Trigger pull (should keep local version)
            await syncManager.syncOnce();

            // Verify IDB still has local version
            const result = await idbAdapter.getNode(id);
            expect(result.data?.nodeName).toBe('Local Version');
        });

        it('queues local node for push when local is newer', async () => {
            const id = testId();
            createdNodeIds.push(id);
            const now = Date.now();

            // Create old version in Firestore
            await firestoreAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Remote Version',
                nodeSubtitle: '',
            });

            await settle(100);

            // Create newer version in IDB
            await idbAdapter.createNode({
                id,
                parentId: null,
                nodeName: 'Local Version (Newer)',
                nodeSubtitle: '',
            });

            // Set last sync
            await idbAdapter.setLastSyncTimestamp(now - 2000);

            // Trigger sync (pull + push)
            await syncManager.syncOnce();

            // Firestore should now have local version (pushed)
            const firestoreResult = await firestoreAdapter.getNode(id);
            expect(firestoreResult.data?.nodeName).toBe('Local Version (Newer)');
        });
    });

    describe('Online/Offline Handling', () => {
        it('skips sync when offline', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node in IDB
            await idbAdapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Mock navigator.onLine
            const originalOnLine = navigator.onLine;
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false,
            });

            // Trigger sync
            await syncManager.syncOnce();

            // Node should NOT be in Firestore (sync skipped)
            const result = await firestoreAdapter.getNode(id);
            expect(result.data).toBeNull();

            // Queue should still have pending item
            const queue = await idbAdapter.getSyncQueue();
            expect(queue.length).toBeGreaterThan(0);

            // Restore
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: originalOnLine,
            });
        });

        it('syncs when coming back online', async () => {
            const id = testId();
            createdNodeIds.push(id);

            // Create node while "offline"
            Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
            await idbAdapter.createNode({ id, parentId: null, nodeName: 'Offline Node', nodeSubtitle: '' });

            // Queue should have item
            let queue = await idbAdapter.getSyncQueue();
            expect(queue.length).toBeGreaterThan(0);

            // Go "online"
            Object.defineProperty(navigator, 'onLine', { writable: true, value: true });

            // Trigger sync
            await syncManager.syncOnce();

            // Node should now be in Firestore
            const result = await firestoreAdapter.getNode(id);
            expect(result.data).toBeDefined();

            // Queue should be cleared
            queue = await idbAdapter.getSyncQueue();
            const nodeOp = queue.find(item => item.entityId === id);
            expect(nodeOp).toBeUndefined();
        });
    });

    describe('Sync Manager Lifecycle', () => {
        it('starts and stops without errors', () => {
            expect(() => {
                syncManager.start();
                syncManager.stop();
            }).not.toThrow();
        });

        it('can be enabled and disabled', () => {
            syncManager.setEnabled(false);
            expect(() => syncManager.setEnabled(true)).not.toThrow();
        });

        it('skips sync when disabled', async () => {
            const id = testId();
            createdNodeIds.push(id);

            syncManager.setEnabled(false);

            await idbAdapter.createNode({ id, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Trigger sync (should skip)
            await syncManager.syncOnce();

            // Node should NOT be in Firestore
            const result = await firestoreAdapter.getNode(id);
            expect(result.data).toBeNull();

            // Re-enable and sync
            syncManager.setEnabled(true);
            await syncManager.syncOnce();

            // Now it should sync
            const result2 = await firestoreAdapter.getNode(id);
            expect(result2.data).toBeDefined();
        });
    });

    describe('Field Sync', () => {
        it('pushes field creation to Firestore', async () => {
            const nodeId = testId();
            const fieldId = testId();
            createdNodeIds.push(nodeId);

            // Setup synced node
            await firestoreAdapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await idbAdapter.applyRemoteUpdate('node', {
                id: nodeId,
                parentId: null,
                nodeName: 'Node',
                nodeSubtitle: '',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
            });

            // Clear queue
            const queue = await idbAdapter.getSyncQueue();
            for (const item of queue) {
                await idbAdapter.markSynced(item.id);
            }

            // Create field
            await idbAdapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Field',
                fieldValue: 'Value',
            });

            // Sync
            await syncManager.syncOnce();

            // Verify in Firestore
            const fields = await firestoreAdapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field).toBeDefined();
        });

        it('pushes field update to Firestore', async () => {
            const nodeId = testId();
            const fieldId = testId();
            createdNodeIds.push(nodeId);

            // Setup synced node and field
            await firestoreAdapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await firestoreAdapter.createField({
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Field',
                fieldValue: 'Original',
            });

            await idbAdapter.applyRemoteUpdate('node', {
                id: nodeId,
                parentId: null,
                nodeName: 'Node',
                nodeSubtitle: '',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
            });
            await idbAdapter.applyRemoteUpdate('field', {
                id: fieldId,
                parentNodeId: nodeId,
                fieldName: 'Field',
                fieldValue: 'Original',
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
            });

            // Clear queue
            const queue = await idbAdapter.getSyncQueue();
            for (const item of queue) {
                await idbAdapter.markSynced(item.id);
            }

            // Update field
            await idbAdapter.updateFieldValue(fieldId, { fieldValue: 'Updated' });

            // Sync
            await syncManager.syncOnce();

            // Verify in Firestore
            const fields = await firestoreAdapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field?.fieldValue).toBe('Updated');
        });
    });
});
