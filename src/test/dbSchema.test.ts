/**
 * Tests for Dexie database schema.
 * Validates table structure, indexes, and schema integrity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, AppDatabase, type SyncQueueItem, type SyncMetadata } from '../data/storage/db';
import type { TreeNode, DataField, DataFieldHistory } from '../data/models';

describe('Database Schema', () => {
    beforeEach(async () => {
        await db.delete();
        await db.open();
    });

    afterEach(async () => {
        await db.delete();
    });

    describe('Database Configuration', () => {
        it('uses correct database name', () => {
            expect(db.name).toBe('complete-maintenance-management');
        });

        it('is an instance of AppDatabase', () => {
            expect(db).toBeInstanceOf(AppDatabase);
        });

        it('has version 2', () => {
            expect(db.verno).toBe(2);
        });
    });

    describe('Tables', () => {
        it('has nodes table', () => {
            expect(db.nodes).toBeDefined();
            expect(db.table('nodes')).toBeDefined();
        });

        it('has fields table', () => {
            expect(db.fields).toBeDefined();
            expect(db.table('fields')).toBeDefined();
        });

        it('has history table', () => {
            expect(db.history).toBeDefined();
            expect(db.table('history')).toBeDefined();
        });

        it('has syncQueue table', () => {
            expect(db.syncQueue).toBeDefined();
            expect(db.table('syncQueue')).toBeDefined();
        });

        it('has syncMetadata table', () => {
            expect(db.syncMetadata).toBeDefined();
            expect(db.table('syncMetadata')).toBeDefined();
        });

        it('has exactly 5 tables', () => {
            expect(db.tables.length).toBe(5);
        });
    });

    describe('Nodes Table Schema', () => {
        it('has id as primary key', async () => {
            const schema = db.nodes.schema;
            expect(schema.primKey.name).toBe('id');
        });

        it('has parentId index', async () => {
            const schema = db.nodes.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('parentId');
        });

        it('has updatedAt index', async () => {
            const schema = db.nodes.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('updatedAt');
        });

        it('can store and retrieve TreeNode', async () => {
            const node: TreeNode = {
                id: 'test-node-1',
                nodeName: 'Test Node',
                nodeSubtitle: 'Subtitle',
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.nodes.add(node);
            const retrieved = await db.nodes.get('test-node-1');

            expect(retrieved).toEqual(node);
        });

        it('can query by parentId index', async () => {
            const parentNode: TreeNode = {
                id: 'parent-1',
                nodeName: 'Parent',
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };
            const childNode: TreeNode = {
                id: 'child-1',
                nodeName: 'Child',
                parentId: 'parent-1',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.nodes.bulkAdd([parentNode, childNode]);
            const children = await db.nodes.where('parentId').equals('parent-1').toArray();

            expect(children.length).toBe(1);
            expect(children[0].id).toBe('child-1');
        });

        it('can query root nodes (parentId = null)', async () => {
            const rootNode: TreeNode = {
                id: 'root-1',
                nodeName: 'Root',
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };
            const childNode: TreeNode = {
                id: 'child-1',
                nodeName: 'Child',
                parentId: 'root-1',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.nodes.bulkAdd([rootNode, childNode]);
            // Dexie can't directly query for null, but we can filter
            const allNodes = await db.nodes.toArray();
            const roots = allNodes.filter(n => n.parentId === null);

            expect(roots.length).toBe(1);
            expect(roots[0].id).toBe('root-1');
        });
    });

    describe('Fields Table Schema', () => {
        it('has id as primary key', async () => {
            const schema = db.fields.schema;
            expect(schema.primKey.name).toBe('id');
        });

        it('has parentNodeId index', async () => {
            const schema = db.fields.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('parentNodeId');
        });

        it('has cardOrder index', async () => {
            const schema = db.fields.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('cardOrder');
        });

        it('has updatedAt index', async () => {
            const schema = db.fields.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('updatedAt');
        });

        it('can store and retrieve DataField', async () => {
            const field: DataField = {
                id: 'test-field-1',
                fieldName: 'Test Field',
                parentNodeId: 'node-1',
                fieldValue: 'test value',
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.fields.add(field);
            const retrieved = await db.fields.get('test-field-1');

            expect(retrieved).toEqual(field);
        });

        it('can query by parentNodeId index', async () => {
            const field1: DataField = {
                id: 'field-1',
                fieldName: 'Field 1',
                parentNodeId: 'node-1',
                fieldValue: 'value 1',
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };
            const field2: DataField = {
                id: 'field-2',
                fieldName: 'Field 2',
                parentNodeId: 'node-2',
                fieldValue: 'value 2',
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.fields.bulkAdd([field1, field2]);
            const nodeFields = await db.fields.where('parentNodeId').equals('node-1').toArray();

            expect(nodeFields.length).toBe(1);
            expect(nodeFields[0].id).toBe('field-1');
        });

        it('can store null fieldValue', async () => {
            const field: DataField = {
                id: 'null-value-field',
                fieldName: 'Empty Field',
                parentNodeId: 'node-1',
                fieldValue: null,
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.fields.add(field);
            const retrieved = await db.fields.get('null-value-field');

            expect(retrieved?.fieldValue).toBeNull();
        });
    });

    describe('History Table Schema', () => {
        it('has id as primary key', async () => {
            const schema = db.history.schema;
            expect(schema.primKey.name).toBe('id');
        });

        it('has dataFieldId index', async () => {
            const schema = db.history.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('dataFieldId');
        });

        it('has updatedAt index', async () => {
            const schema = db.history.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('updatedAt');
        });

        it('has rev index', async () => {
            const schema = db.history.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('rev');
        });

        it('can store and retrieve DataFieldHistory', async () => {
            const history: DataFieldHistory = {
                id: 'field-1:0',
                dataFieldId: 'field-1',
                parentNodeId: 'node-1',
                action: 'create',
                property: 'fieldValue',
                prevValue: null,
                newValue: 'initial value',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                rev: 0,
            };

            await db.history.add(history);
            const retrieved = await db.history.get('field-1:0');

            expect(retrieved).toEqual(history);
        });

        it('can query history by dataFieldId', async () => {
            const history1: DataFieldHistory = {
                id: 'field-1:0',
                dataFieldId: 'field-1',
                parentNodeId: 'node-1',
                action: 'create',
                property: 'fieldValue',
                prevValue: null,
                newValue: 'v1',
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                rev: 0,
            };
            const history2: DataFieldHistory = {
                id: 'field-1:1',
                dataFieldId: 'field-1',
                parentNodeId: 'node-1',
                action: 'update',
                property: 'fieldValue',
                prevValue: 'v1',
                newValue: 'v2',
                updatedBy: 'testUser',
                updatedAt: Date.now() + 1000,
                rev: 1,
            };

            await db.history.bulkAdd([history1, history2]);
            const fieldHistory = await db.history.where('dataFieldId').equals('field-1').toArray();

            expect(fieldHistory.length).toBe(2);
        });

        it('supports all action types', async () => {
            const actions: DataFieldHistory['action'][] = ['create', 'update', 'delete'];

            for (let i = 0; i < actions.length; i++) {
                const history: DataFieldHistory = {
                    id: `action-test:${i}`,
                    dataFieldId: 'action-test',
                    parentNodeId: 'node-1',
                    action: actions[i],
                    property: 'fieldValue',
                    prevValue: i === 0 ? null : `value-${i - 1}`,
                    newValue: actions[i] === 'delete' ? null : `value-${i}`,
                    updatedBy: 'testUser',
                    updatedAt: Date.now() + i,
                    rev: i,
                };
                await db.history.add(history);
            }

            const allHistory = await db.history.where('dataFieldId').equals('action-test').toArray();
            expect(allHistory.length).toBe(3);
        });
    });

    describe('SyncQueue Table Schema', () => {
        it('has id as primary key', async () => {
            const schema = db.syncQueue.schema;
            expect(schema.primKey.name).toBe('id');
        });

        it('has status index', async () => {
            const schema = db.syncQueue.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('status');
        });

        it('has timestamp index', async () => {
            const schema = db.syncQueue.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('timestamp');
        });

        it('has entityType index', async () => {
            const schema = db.syncQueue.schema;
            const indexNames = schema.indexes.map(idx => idx.name);
            expect(indexNames).toContain('entityType');
        });

        it('can store and retrieve SyncQueueItem', async () => {
            const item: SyncQueueItem = {
                id: 'sync-1',
                operation: 'create-node',
                entityType: 'node',
                entityId: 'node-1',
                payload: { nodeName: 'Test' },
                timestamp: Date.now(),
                status: 'pending',
                retryCount: 0,
            };

            await db.syncQueue.add(item);
            const retrieved = await db.syncQueue.get('sync-1');

            expect(retrieved).toEqual(item);
        });

        it('can query pending items by status', async () => {
            const pending: SyncQueueItem = {
                id: 'sync-pending',
                operation: 'create-node',
                entityType: 'node',
                entityId: 'node-1',
                payload: {},
                timestamp: Date.now(),
                status: 'pending',
                retryCount: 0,
            };
            const synced: SyncQueueItem = {
                id: 'sync-synced',
                operation: 'update-node',
                entityType: 'node',
                entityId: 'node-2',
                payload: {},
                timestamp: Date.now(),
                status: 'synced',
                retryCount: 0,
            };

            await db.syncQueue.bulkAdd([pending, synced]);
            const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();

            expect(pendingItems.length).toBe(1);
            expect(pendingItems[0].id).toBe('sync-pending');
        });

        it('supports all operation types', async () => {
            const operations: SyncQueueItem['operation'][] = [
                'create-node',
                'update-node',
                'delete-node',
                'create-field',
                'update-field',
                'delete-field',
            ];

            for (let i = 0; i < operations.length; i++) {
                const item: SyncQueueItem = {
                    id: `op-${i}`,
                    operation: operations[i],
                    entityType: operations[i].includes('node') ? 'node' : 'field',
                    entityId: `entity-${i}`,
                    payload: {},
                    timestamp: Date.now() + i,
                    status: 'pending',
                    retryCount: 0,
                };
                await db.syncQueue.add(item);
            }

            const allItems = await db.syncQueue.toArray();
            expect(allItems.length).toBe(operations.length);
        });

        it('supports all status types', async () => {
            const statuses: SyncQueueItem['status'][] = ['pending', 'syncing', 'synced', 'failed'];

            for (let i = 0; i < statuses.length; i++) {
                const item: SyncQueueItem = {
                    id: `status-${i}`,
                    operation: 'create-node',
                    entityType: 'node',
                    entityId: `entity-${i}`,
                    payload: {},
                    timestamp: Date.now(),
                    status: statuses[i],
                    retryCount: i,
                };
                await db.syncQueue.add(item);
            }

            for (const status of statuses) {
                const items = await db.syncQueue.where('status').equals(status).toArray();
                expect(items.length).toBe(1);
            }
        });

        it('can store lastError for failed items', async () => {
            const item: SyncQueueItem = {
                id: 'failed-sync',
                operation: 'update-node',
                entityType: 'node',
                entityId: 'node-1',
                payload: {},
                timestamp: Date.now(),
                status: 'failed',
                retryCount: 3,
                lastError: 'Network timeout',
            };

            await db.syncQueue.add(item);
            const retrieved = await db.syncQueue.get('failed-sync');

            expect(retrieved?.lastError).toBe('Network timeout');
        });
    });

    describe('SyncMetadata Table Schema', () => {
        it('has key as primary key', async () => {
            const schema = db.syncMetadata.schema;
            expect(schema.primKey.name).toBe('key');
        });

        it('can store and retrieve metadata', async () => {
            const meta: SyncMetadata = {
                key: 'lastSyncTimestamp',
                value: 1704067200000,
            };

            await db.syncMetadata.add(meta);
            const retrieved = await db.syncMetadata.get('lastSyncTimestamp');

            expect(retrieved?.value).toBe(1704067200000);
        });

        it('can update metadata value', async () => {
            const meta: SyncMetadata = {
                key: 'lastPullTimestamp',
                value: 1000,
            };

            await db.syncMetadata.add(meta);
            await db.syncMetadata.update('lastPullTimestamp', { value: 2000 });
            const retrieved = await db.syncMetadata.get('lastPullTimestamp');

            expect(retrieved?.value).toBe(2000);
        });

        it('can store complex value types', async () => {
            const meta: SyncMetadata = {
                key: 'syncState',
                value: { lastSync: Date.now(), status: 'complete', count: 42 },
            };

            await db.syncMetadata.add(meta);
            const retrieved = await db.syncMetadata.get('syncState');

            expect(retrieved?.value).toEqual(meta.value);
        });
    });

    describe('Index Integrity', () => {
        it('nodes table has exactly 3 indexes (excluding primary key)', async () => {
            const schema = db.nodes.schema;
            expect(schema.indexes.length).toBe(3); // parentId, updatedAt, deletedAt
        });

        it('fields table has exactly 4 indexes (excluding primary key)', async () => {
            const schema = db.fields.schema;
            expect(schema.indexes.length).toBe(4); // parentNodeId, cardOrder, updatedAt, deletedAt
        });

        it('history table has exactly 4 indexes (excluding primary key)', async () => {
            const schema = db.history.schema;
            expect(schema.indexes.length).toBe(4); // dataFieldId, parentNodeId, updatedAt, rev
        });

        it('syncQueue table has exactly 3 indexes (excluding primary key)', async () => {
            const schema = db.syncQueue.schema;
            expect(schema.indexes.length).toBe(3); // status, timestamp, entityType
        });

        it('syncMetadata table has no additional indexes', async () => {
            const schema = db.syncMetadata.schema;
            expect(schema.indexes.length).toBe(0); // Only primary key
        });
    });

    describe('Database Operations', () => {
        it('can perform bulk operations', async () => {
            const nodes: TreeNode[] = Array.from({ length: 10 }, (_, i) => ({
                id: `bulk-node-${i}`,
                nodeName: `Node ${i}`,
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now() + i,
                deletedAt: null,
            }));

            await db.nodes.bulkAdd(nodes);
            const count = await db.nodes.count();

            expect(count).toBe(10);
        });

        it('can clear individual tables', async () => {
            await db.nodes.add({
                id: 'clear-test',
                nodeName: 'Test',
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            });

            await db.nodes.clear();
            const count = await db.nodes.count();

            expect(count).toBe(0);
        });

        it('maintains referential data (not enforced, but stored)', async () => {
            // Note: Dexie doesn't enforce foreign keys, but we can store related data
            const node: TreeNode = {
                id: 'ref-node',
                nodeName: 'Parent Node',
                parentId: null,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };
            const field: DataField = {
                id: 'ref-field',
                fieldName: 'Field',
                parentNodeId: 'ref-node', // References node
                fieldValue: 'value',
                cardOrder: 0,
                updatedBy: 'testUser',
                updatedAt: Date.now(),
                deletedAt: null,
            };

            await db.nodes.add(node);
            await db.fields.add(field);

            const retrievedField = await db.fields.get('ref-field');
            expect(retrievedField?.parentNodeId).toBe('ref-node');

            // Verify we can find the related node
            const relatedNode = await db.nodes.get(retrievedField!.parentNodeId);
            expect(relatedNode?.nodeName).toBe('Parent Node');
        });
    });
});
