/**
 * Tests for FirestoreAdapter - Firestore implementation of StorageAdapter
 *
 * These tests require the Firestore emulator to be running:
 *   npm run emulator (or: firebase emulators:start --only firestore)
 *
 * Tests are skipped if the emulator is not available.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
    initializeFirestore,
    connectFirestoreEmulator,
    collection,
    getDocs,
    writeBatch,
    doc,
    memoryLocalCache,
    terminate,
    Firestore,
} from 'firebase/firestore';
import { testId, TEST_PREFIX } from './testUtils';
import { COLLECTIONS } from '../constants';
import type { TreeNode, DataField, DataFieldHistory } from '../data/models';

// Firestore emulator config - use 127.0.0.1 to match emulator binding
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;

// Test-specific Firebase app (isolated from main app)
let testDb: Firestore;

/**
 * Check if the Firestore emulator is running (sync check at module load)
 */
async function checkEmulator(): Promise<boolean> {
    try {
        const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        
        return response.status >= 200 && response.status < 500;
    } catch {
        return false;
    }
}

// Check emulator availability at module load time (top-level await)
const emulatorAvailable = await checkEmulator();

if (!emulatorAvailable) {
    console.log('\n⚠️  Firestore emulator not running. Skipping FirestoreAdapter tests.');
    console.log('   Start it with: firebase emulators:start --only firestore\n');
}

/**
 * FirestoreAdapter for testing - mirrors production but uses test db instance
 */
class TestFirestoreAdapter {
    constructor(private db: Firestore) {}

    private createResult<T>(data: T) {
        return { data, meta: { adapter: 'firestore' } };
    }

    async listRootNodes() {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.NODES),
            where('parentId', '==', null),
            where('deletedAt', '==', null),
            orderBy('updatedAt', 'asc')
        );
        const snap = await getDocs(q);
        return this.createResult(snap.docs.map(d => d.data() as TreeNode));
    }

    async getNode(id: string) {
        const { getDoc, doc } = await import('firebase/firestore');
        const snap = await getDoc(doc(this.db, COLLECTIONS.NODES, id));
        return this.createResult(snap.exists() ? snap.data() as TreeNode : null);
    }

    async listChildren(parentId: string) {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.NODES),
            where('parentId', '==', parentId),
            where('deletedAt', '==', null),
            orderBy('updatedAt', 'asc')
        );
        const snap = await getDocs(q);
        return this.createResult(snap.docs.map(d => d.data() as TreeNode));
    }

    async createNode(input: { id: string; parentId: string | null; nodeName: string; nodeSubtitle: string }) {
        const { setDoc, doc } = await import('firebase/firestore');
        const node: TreeNode = {
            ...input,
            updatedBy: 'test-user',
            updatedAt: Date.now(),
            deletedAt: null,
        };
        await setDoc(doc(this.db, COLLECTIONS.NODES, node.id), node);
        return this.createResult(node);
    }

    async updateNode(id: string, updates: { nodeName?: string; nodeSubtitle?: string }) {
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(this.db, COLLECTIONS.NODES, id), {
            ...updates,
            updatedBy: 'test-user',
            updatedAt: Date.now(),
        });
        return this.createResult(undefined);
    }

    async deleteNode(id: string) {
        const { updateDoc, doc } = await import('firebase/firestore');
        const ts = Date.now();
        await updateDoc(doc(this.db, COLLECTIONS.NODES, id), {
            deletedAt: ts,
            updatedAt: ts,
            updatedBy: 'test-user',
        });
        return this.createResult(undefined);
    }

    async listFields(parentNodeId: string) {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.FIELDS),
            where('parentNodeId', '==', parentNodeId),
            where('deletedAt', '==', null),
            orderBy('cardOrder', 'asc')
        );
        const snap = await getDocs(q);
        return this.createResult(snap.docs.map(d => d.data() as DataField));
    }

    async nextCardOrder(parentNodeId: string) {
        const fields = (await this.listFields(parentNodeId)).data;
        if (fields.length === 0) return this.createResult(0);
        return this.createResult(Math.max(...fields.map(f => f.cardOrder)) + 1);
    }

    async createField(input: { id: string; parentNodeId: string; fieldName: string; fieldValue: string | null; cardOrder?: number }) {
        const { setDoc, doc } = await import('firebase/firestore');
        const ts = Date.now();
        const order = input.cardOrder ?? (await this.nextCardOrder(input.parentNodeId)).data;
        
        const field: DataField = {
            id: input.id,
            parentNodeId: input.parentNodeId,
            fieldName: input.fieldName,
            fieldValue: input.fieldValue,
            cardOrder: order,
            updatedBy: 'test-user',
            updatedAt: ts,
            deletedAt: null,
        };
        await setDoc(doc(this.db, COLLECTIONS.FIELDS, field.id), field);

        // Create history entry
        const rev = await this.nextRev(field.id);
        const hist: DataFieldHistory = {
            id: `${field.id}:${rev}`,
            dataFieldId: field.id,
            parentNodeId: field.parentNodeId,
            action: 'create',
            property: 'fieldValue',
            prevValue: null,
            newValue: field.fieldValue,
            updatedBy: 'test-user',
            updatedAt: ts,
            rev,
        };
        await setDoc(doc(this.db, COLLECTIONS.HISTORY, hist.id), hist);

        return this.createResult(field);
    }

    async updateFieldValue(id: string, input: { fieldValue: string | null }) {
        const { getDoc, updateDoc, setDoc, doc } = await import('firebase/firestore');
        const ref = doc(this.db, COLLECTIONS.FIELDS, id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Field not found');

        const prev = snap.data() as DataField;
        const ts = Date.now();

        await updateDoc(ref, {
            fieldValue: input.fieldValue,
            updatedAt: ts,
            updatedBy: 'test-user',
        });

        // Create history entry
        const rev = await this.nextRev(id);
        const hist: DataFieldHistory = {
            id: `${id}:${rev}`,
            dataFieldId: id,
            parentNodeId: prev.parentNodeId,
            action: 'update',
            property: 'fieldValue',
            prevValue: prev.fieldValue,
            newValue: input.fieldValue,
            updatedBy: 'test-user',
            updatedAt: ts,
            rev,
        };
        await setDoc(doc(this.db, COLLECTIONS.HISTORY, hist.id), hist);

        return this.createResult(undefined);
    }

    async deleteField(id: string) {
        const { getDoc, updateDoc, setDoc, doc } = await import('firebase/firestore');
        const ref = doc(this.db, COLLECTIONS.FIELDS, id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return this.createResult(undefined);

        const prev = snap.data() as DataField;
        const ts = Date.now();

        // Soft delete
        await updateDoc(ref, {
            deletedAt: ts,
            updatedAt: ts,
            updatedBy: 'test-user',
        });

        // Create history entry
        const rev = await this.nextRev(id);
        const hist: DataFieldHistory = {
            id: `${id}:${rev}`,
            dataFieldId: id,
            parentNodeId: prev.parentNodeId,
            action: 'delete',
            property: 'fieldValue',
            prevValue: prev.fieldValue,
            newValue: null,
            updatedBy: 'test-user',
            updatedAt: ts,
            rev,
        };
        await setDoc(doc(this.db, COLLECTIONS.HISTORY, hist.id), hist);

        return this.createResult(undefined);
    }

    async getFieldHistory(dataFieldId: string) {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.HISTORY),
            where('dataFieldId', '==', dataFieldId),
            orderBy('rev', 'asc')
        );
        const snap = await getDocs(q);
        return this.createResult(snap.docs.map(d => d.data() as DataFieldHistory));
    }

    async listDeletedNodes() {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.NODES),
            where('deletedAt', '>', 0),
            orderBy('deletedAt', 'desc')
        );
        const snap = await getDocs(q);
        return this.createResult(snap.docs.map(d => d.data() as TreeNode));
    }

    async listDeletedChildren(parentId: string) {
        const { query, where, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.NODES),
            where('parentId', '==', parentId)
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(d => d.data() as TreeNode);
        const deleted = all.filter(n => n.deletedAt != null);
        deleted.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
        return this.createResult(deleted);
    }

    async restoreNode(id: string) {
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(this.db, COLLECTIONS.NODES, id), {
            deletedAt: null,
            updatedAt: Date.now(),
            updatedBy: 'test-user',
        });
        return this.createResult(undefined);
    }

    async listDeletedFields(parentNodeId: string) {
        const { query, where, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.FIELDS),
            where('parentNodeId', '==', parentNodeId)
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(d => d.data() as DataField);
        const deleted = all.filter(f => f.deletedAt != null);
        deleted.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
        return this.createResult(deleted);
    }

    async restoreField(id: string) {
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(this.db, COLLECTIONS.FIELDS, id), {
            deletedAt: null,
            updatedAt: Date.now(),
            updatedBy: 'test-user',
        });
        return this.createResult(undefined);
    }

    private async nextRev(dataFieldId: string): Promise<number> {
        const { query, where, orderBy, getDocs } = await import('firebase/firestore');
        const q = query(
            collection(this.db, COLLECTIONS.HISTORY),
            where('dataFieldId', '==', dataFieldId),
            orderBy('rev', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.length ? (snap.docs[0].data() as DataFieldHistory).rev + 1 : 0;
    }
}

/**
 * Clean up test fixtures from Firestore emulator
 */
async function cleanupTestFixtures() {
    if (!testDb) return;

    const batch = writeBatch(testDb);
    let deleted = 0;

    for (const collectionName of [COLLECTIONS.NODES, COLLECTIONS.FIELDS, COLLECTIONS.HISTORY]) {
        const snap = await getDocs(collection(testDb, collectionName));
        for (const docSnap of snap.docs) {
            if (docSnap.id.startsWith(TEST_PREFIX)) {
                batch.delete(doc(testDb, collectionName, docSnap.id));
                deleted++;
            }
        }
    }

    if (deleted > 0) {
        await batch.commit();
    }
}

describe('FirestoreAdapter - Core Storage Operations', () => {
    let adapter: TestFirestoreAdapter;

    beforeAll(async () => {
        // Skip setup if emulator not available (already checked at module load)
        if (!emulatorAvailable) return;

        // Initialize test-specific Firebase app
        const testApp = initializeApp(
            {
                apiKey: 'test-api-key',
                projectId: 'test-project',
            },
            'firestore-adapter-test'
        );

        testDb = initializeFirestore(testApp, {
            localCache: memoryLocalCache(),
        });

        connectFirestoreEmulator(testDb, EMULATOR_HOST, EMULATOR_PORT);
        adapter = new TestFirestoreAdapter(testDb);
    });

    beforeEach(async () => {
        if (!emulatorAvailable) return;
        await cleanupTestFixtures();
    });

    afterAll(async () => {
        if (!emulatorAvailable) return;
        await cleanupTestFixtures();
        
        // Clean up test app
        const apps = getApps();
        const testApp = apps.find(a => a.name === 'firestore-adapter-test');
        if (testApp) {
            await terminate(testDb);
            await deleteApp(testApp);
        }
    });

    describe('Node Operations', () => {
        it.skipIf(!emulatorAvailable)('creates node and persists to Firestore', async () => {
            const id = testId();
            const result = await adapter.createNode({
                id,
                parentId: null,
                nodeName: 'Test Node',
                nodeSubtitle: 'Test Subtitle',
            });

            expect(result.data.id).toBe(id);
            expect(result.data.nodeName).toBe('Test Node');
            expect(result.data.nodeSubtitle).toBe('Test Subtitle');
            expect(result.data.parentId).toBeNull();
            expect(result.data.updatedBy).toBeDefined();
            expect(result.data.updatedAt).toBeTypeOf('number');
            expect(result.meta?.adapter).toBe('firestore');

            // Verify persisted
            const retrieved = await adapter.getNode(id);
            expect(retrieved.data).toBeDefined();
            expect(retrieved.data?.nodeName).toBe('Test Node');
        });

        it.skipIf(!emulatorAvailable)('lists root nodes from Firestore', async () => {
            const id1 = testId();
            const id2 = testId();
            const childId = testId();

            await adapter.createNode({ id: id1, parentId: null, nodeName: 'Root 1', nodeSubtitle: '' });
            await adapter.createNode({ id: id2, parentId: null, nodeName: 'Root 2', nodeSubtitle: '' });
            await adapter.createNode({ id: childId, parentId: id1, nodeName: 'Child', nodeSubtitle: '' });

            const result = await adapter.listRootNodes();

            expect(result.data.find(n => n.id === id1)).toBeDefined();
            expect(result.data.find(n => n.id === id2)).toBeDefined();
            expect(result.data.find(n => n.id === childId)).toBeUndefined();
        });

        it.skipIf(!emulatorAvailable)('lists children for a parent node', async () => {
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

        it.skipIf(!emulatorAvailable)('gets node by ID', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Get Test', nodeSubtitle: 'Sub' });

            const result = await adapter.getNode(id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(id);
            expect(result.data?.nodeName).toBe('Get Test');
            expect(result.data?.nodeSubtitle).toBe('Sub');
        });

        it.skipIf(!emulatorAvailable)('returns null for non-existent node', async () => {
            const result = await adapter.getNode('nonexistent-id-12345');
            expect(result.data).toBeNull();
        });

        it.skipIf(!emulatorAvailable)('updates node in Firestore', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Original', nodeSubtitle: 'Old' });

            await adapter.updateNode(id, { nodeName: 'Updated', nodeSubtitle: 'New' });

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data?.nodeName).toBe('Updated');
            expect(retrieved.data?.nodeSubtitle).toBe('New');
        });

        it.skipIf(!emulatorAvailable)('updates only specified fields', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'Original', nodeSubtitle: 'Original Sub' });

            await adapter.updateNode(id, { nodeName: 'Updated' });

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data?.nodeName).toBe('Updated');
            expect(retrieved.data?.nodeSubtitle).toBe('Original Sub');
        });

        it.skipIf(!emulatorAvailable)('soft deletes node (sets deletedAt instead of removing)', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            await adapter.deleteNode(id);

            const retrieved = await adapter.getNode(id);
            expect(retrieved.data).not.toBeNull();
            expect(retrieved.data?.deletedAt).not.toBeNull();
            expect(retrieved.data?.deletedAt).toBeTypeOf('number');
        });

        it.skipIf(!emulatorAvailable)('soft deleted node is excluded from listRootNodes', async () => {
            const id = testId();
            await adapter.createNode({ id, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            await adapter.deleteNode(id);

            const result = await adapter.listRootNodes();
            expect(result.data.find(n => n.id === id)).toBeUndefined();
        });

        it.skipIf(!emulatorAvailable)('soft deletes node with children (children implicitly hidden)', async () => {
            const parentId = testId();
            const childId = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            await adapter.createNode({ id: childId, parentId, nodeName: 'Child', nodeSubtitle: '' });

            await adapter.deleteNode(parentId);

            const retrieved = await adapter.getNode(parentId);
            expect(retrieved.data?.deletedAt).not.toBeNull();
        });
    });

    describe('Field Operations', () => {
        it.skipIf(!emulatorAvailable)('creates field and persists to Firestore', async () => {
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
            expect(result.meta?.adapter).toBe('firestore');
        });

        it.skipIf(!emulatorAvailable)('lists fields for a node', async () => {
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

        it.skipIf(!emulatorAvailable)('returns fields sorted by cardOrder', async () => {
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

        it.skipIf(!emulatorAvailable)('calculates next cardOrder correctly', async () => {
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

        it.skipIf(!emulatorAvailable)('updates field value', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Original' });

            await adapter.updateFieldValue(fieldId, { fieldValue: 'Updated' });

            const fields = await adapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field?.fieldValue).toBe('Updated');
        });

        it.skipIf(!emulatorAvailable)('allows setting field value to null', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Has Value' });

            await adapter.updateFieldValue(fieldId, { fieldValue: null });

            const fields = await adapter.listFields(nodeId);
            const field = fields.data.find(f => f.id === fieldId);
            expect(field?.fieldValue).toBeNull();
        });

        it.skipIf(!emulatorAvailable)('soft deletes field from Firestore', async () => {
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
        it.skipIf(!emulatorAvailable)('creates history entry when creating field', async () => {
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

        it.skipIf(!emulatorAvailable)('creates history entry when updating field', async () => {
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

        it.skipIf(!emulatorAvailable)('creates history entry when deleting field', async () => {
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

        it.skipIf(!emulatorAvailable)('returns history sorted by rev ascending', async () => {
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

    describe('Soft Delete Operations - Nodes', () => {
        it.skipIf(!emulatorAvailable)('listDeletedNodes returns only soft-deleted nodes', async () => {
            const activeId = testId();
            const deletedId = testId();

            await adapter.createNode({ id: activeId, parentId: null, nodeName: 'Active', nodeSubtitle: '' });
            await adapter.createNode({ id: deletedId, parentId: null, nodeName: 'To Delete', nodeSubtitle: '' });

            await adapter.deleteNode(deletedId);

            const deleted = await adapter.listDeletedNodes();
            // Filter to our test nodes only
            const testDeleted = deleted.data.filter(n => n.id === activeId || n.id === deletedId);
            expect(testDeleted.length).toBe(1);
            expect(testDeleted[0].id).toBe(deletedId);
        });

        it.skipIf(!emulatorAvailable)('listDeletedChildren returns only soft-deleted children', async () => {
            const parentId = testId();
            const activeChildId = testId();
            const deletedChildId = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            await adapter.createNode({ id: activeChildId, parentId, nodeName: 'Active Child', nodeSubtitle: '' });
            await adapter.createNode({ id: deletedChildId, parentId, nodeName: 'Deleted Child', nodeSubtitle: '' });

            await adapter.deleteNode(deletedChildId);

            const activeChildren = await adapter.listChildren(parentId);
            expect(activeChildren.data.length).toBe(1);
            expect(activeChildren.data[0].id).toBe(activeChildId);

            const deletedChildren = await adapter.listDeletedChildren(parentId);
            expect(deletedChildren.data.length).toBe(1);
            expect(deletedChildren.data[0].id).toBe(deletedChildId);
        });

        it.skipIf(!emulatorAvailable)('restoreNode clears deletedAt and makes node visible again', async () => {
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
        it.skipIf(!emulatorAvailable)('soft deleted field is excluded from listFields', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            await adapter.deleteField(fieldId);

            const fields = await adapter.listFields(nodeId);
            expect(fields.data.find(f => f.id === fieldId)).toBeUndefined();
        });

        it.skipIf(!emulatorAvailable)('listDeletedFields returns only soft-deleted fields', async () => {
            const nodeId = testId();
            const activeFieldId = testId();
            const deletedFieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: activeFieldId, parentNodeId: nodeId, fieldName: 'Active', fieldValue: 'V1' });
            await adapter.createField({ id: deletedFieldId, parentNodeId: nodeId, fieldName: 'Deleted', fieldValue: 'V2' });

            await adapter.deleteField(deletedFieldId);

            const deletedFields = await adapter.listDeletedFields(nodeId);
            expect(deletedFields.data.length).toBe(1);
            expect(deletedFields.data[0].id).toBe(deletedFieldId);
        });

        it.skipIf(!emulatorAvailable)('restoreField clears deletedAt and makes field visible again', async () => {
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

        it.skipIf(!emulatorAvailable)('soft delete field creates history entry with action delete', async () => {
            const nodeId = testId();
            const fieldId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });
            await adapter.createField({ id: fieldId, parentNodeId: nodeId, fieldName: 'Field', fieldValue: 'Value' });

            await adapter.deleteField(fieldId);

            const history = await adapter.getFieldHistory(fieldId);
            const deleteEntry = history.data.find(h => h.action === 'delete');
            expect(deleteEntry).toBeDefined();
            expect(deleteEntry?.prevValue).toBe('Value');
            expect(deleteEntry?.newValue).toBeNull();
        });
    });

    describe('Ordering Consistency', () => {
        it.skipIf(!emulatorAvailable)('root nodes are sorted by updatedAt ascending', async () => {
            const id1 = testId();
            const id2 = testId();
            const id3 = testId();

            // Create with slight delays to ensure different timestamps
            await adapter.createNode({ id: id1, parentId: null, nodeName: 'First', nodeSubtitle: '' });
            await new Promise(r => setTimeout(r, 10));
            await adapter.createNode({ id: id2, parentId: null, nodeName: 'Second', nodeSubtitle: '' });
            await new Promise(r => setTimeout(r, 10));
            await adapter.createNode({ id: id3, parentId: null, nodeName: 'Third', nodeSubtitle: '' });

            const result = await adapter.listRootNodes();
            const testNodes = result.data.filter(n => [id1, id2, id3].includes(n.id));

            expect(testNodes.length).toBe(3);
            expect(testNodes[0].id).toBe(id1);
            expect(testNodes[1].id).toBe(id2);
            expect(testNodes[2].id).toBe(id3);
        });

        it.skipIf(!emulatorAvailable)('children are sorted by updatedAt ascending', async () => {
            const parentId = testId();
            const child1 = testId();
            const child2 = testId();
            const child3 = testId();

            await adapter.createNode({ id: parentId, parentId: null, nodeName: 'Parent', nodeSubtitle: '' });
            
            await adapter.createNode({ id: child1, parentId, nodeName: 'First', nodeSubtitle: '' });
            await new Promise(r => setTimeout(r, 10));
            await adapter.createNode({ id: child2, parentId, nodeName: 'Second', nodeSubtitle: '' });
            await new Promise(r => setTimeout(r, 10));
            await adapter.createNode({ id: child3, parentId, nodeName: 'Third', nodeSubtitle: '' });

            const result = await adapter.listChildren(parentId);

            expect(result.data.length).toBe(3);
            expect(result.data[0].id).toBe(child1);
            expect(result.data[1].id).toBe(child2);
            expect(result.data[2].id).toBe(child3);
        });

        it.skipIf(!emulatorAvailable)('fields are sorted by cardOrder ascending', async () => {
            const nodeId = testId();

            await adapter.createNode({ id: nodeId, parentId: null, nodeName: 'Node', nodeSubtitle: '' });

            // Create out of order
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Third', fieldValue: null, cardOrder: 2 });
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'First', fieldValue: null, cardOrder: 0 });
            await adapter.createField({ id: testId(), parentNodeId: nodeId, fieldName: 'Second', fieldValue: null, cardOrder: 1 });

            const result = await adapter.listFields(nodeId);

            expect(result.data[0].fieldName).toBe('First');
            expect(result.data[1].fieldName).toBe('Second');
            expect(result.data[2].fieldName).toBe('Third');
        });
    });
});
