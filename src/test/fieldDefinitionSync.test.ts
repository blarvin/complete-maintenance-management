/**
 * Narrow sync coverage for FieldDefinitions:
 *  - IDBAdapter filters soft-deleted on list, stamps authorId on create
 *  - IDBAdapter create-/update-/delete enqueue the right sync ops
 *  - ServerAuthorityResolver applies / skips per pending-queue state
 *  - DeltaSync and FullCollectionSync wire fieldDefinitions through
 *
 * Round-trip emulator coverage stays out of scope here — restoring the broader
 * adapter / sync suite is tracked in ISSUES.md.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../data/storage/db';
import { IDBAdapter } from '../data/storage/IDBAdapter';
import { ServerAuthorityResolver } from '../data/sync/ServerAuthorityResolver';
import { FullCollectionSync } from '../data/sync/strategies/FullCollectionSync';
import { DeltaSync } from '../data/sync/strategies/DeltaSync';
import { IDBSyncQueueManager } from '../data/sync/SyncQueueManager';
import type { RemoteSyncAdapter } from '../data/storage/storageAdapter';
import type { FieldDefinition } from '../data/models';

function mockRemote(overrides: Partial<RemoteSyncAdapter> = {}): RemoteSyncAdapter {
    return {
        applySyncItem: vi.fn(),
        pullEntitiesSince: vi.fn().mockResolvedValue([]),
        pullAllNodes: vi.fn().mockResolvedValue([]),
        pullAllFields: vi.fn().mockResolvedValue([]),
        pullAllHistory: vi.fn().mockResolvedValue([]),
        pullAllFieldDefinitions: vi.fn().mockResolvedValue([]),
        pullHistorySince: vi.fn().mockResolvedValue([]),
        pullFieldDefinitionsSince: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function makeDefinition(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
    return {
        id: 'fd_test',
        componentType: 'text-kv',
        label: 'Test',
        config: {},
        authorId: 'remoteUser',
        updatedBy: 'remoteUser',
        updatedAt: 1000,
        deletedAt: null,
        ...overrides,
    };
}

describe('IDBAdapter - FieldDefinitions', () => {
    beforeEach(async () => {
        await Promise.all([
            db.fieldDefinitions.clear(),
            db.syncQueue.clear(),
        ]);
    });

    it('createFieldDefinition stamps authorId from current user and enqueues sync op', async () => {
        const adapter = new IDBAdapter();
        const res = await adapter.createFieldDefinition({
            id: 'fd_x',
            componentType: 'text-kv',
            label: 'X',
            config: {},
        });
        expect(res.data.authorId).toBe('localUser');
        expect(res.data.deletedAt).toBeNull();

        const queue = await db.syncQueue.toArray();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('create-fieldDefinition');
        expect(queue[0].entityType).toBe('fieldDefinition');
    });

    it('updateFieldDefinition enqueues update-fieldDefinition with refreshed payload', async () => {
        const adapter = new IDBAdapter();
        await adapter.createFieldDefinition({
            id: 'fd_x',
            componentType: 'text-kv',
            label: 'X',
            config: {},
        });
        await db.syncQueue.clear();

        await adapter.updateFieldDefinition('fd_x', { label: 'X (renamed)' });
        const queue = await db.syncQueue.toArray();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('update-fieldDefinition');
        expect((queue[0].payload as FieldDefinition).label).toBe('X (renamed)');
    });

    it('listFieldDefinitions filters out rows with deletedAt set (admin tombstone)', async () => {
        await db.fieldDefinitions.bulkPut([
            makeDefinition({ id: 'fd_a', label: 'A' }),
            makeDefinition({ id: 'fd_b', label: 'B', deletedAt: 9000 }),
            makeDefinition({ id: 'fd_c', label: 'C' }),
        ]);

        const adapter = new IDBAdapter();
        const res = await adapter.listFieldDefinitions();
        const ids = res.data.map(d => d.id).sort();
        expect(ids).toEqual(['fd_a', 'fd_c']);
    });
});

describe('ServerAuthorityResolver - FieldDefinitions', () => {
    beforeEach(async () => {
        await Promise.all([
            db.fieldDefinitions.clear(),
            db.syncQueue.clear(),
        ]);
    });

    it('applies remote definition when there is no pending local op for it', async () => {
        const adapter = new IDBAdapter();
        const resolver = new ServerAuthorityResolver(adapter, adapter.syncQueue);

        const remote = makeDefinition({ id: 'fd_remote', label: 'Remote' });
        const result = await resolver.resolveFieldDefinition(remote);
        expect(result).toBe('applied');

        const stored = await db.fieldDefinitions.get('fd_remote');
        expect(stored?.label).toBe('Remote');
    });

    it('skips remote definition while a local op for the same id is pending push', async () => {
        const adapter = new IDBAdapter();
        const resolver = new ServerAuthorityResolver(adapter, adapter.syncQueue);

        // Local create queues a pending op for fd_x.
        await adapter.createFieldDefinition({
            id: 'fd_x',
            componentType: 'text-kv',
            label: 'Local',
            config: {},
        });

        const remote = makeDefinition({ id: 'fd_x', label: 'Remote', updatedAt: 5000 });
        const result = await resolver.resolveFieldDefinition(remote);
        expect(result).toBe('skipped');

        const stored = await db.fieldDefinitions.get('fd_x');
        // Local value preserved — remote skipped.
        expect(stored?.label).toBe('Local');
    });
});

describe('FullCollectionSync - FieldDefinitions', () => {
    beforeEach(async () => {
        await Promise.all([
            db.fieldDefinitions.clear(),
            db.syncQueue.clear(),
            db.nodes.clear(),
            db.fields.clear(),
            db.history.clear(),
        ]);
    });

    it('pulls and applies remote field definitions, counting applied', async () => {
        const adapter = new IDBAdapter();
        const queue = new IDBSyncQueueManager();
        const resolver = new ServerAuthorityResolver(adapter, queue);

        const remote = mockRemote({
            pullAllFieldDefinitions: vi.fn().mockResolvedValue([
                makeDefinition({ id: 'fd_a', label: 'A' }),
                makeDefinition({ id: 'fd_b', label: 'B' }),
            ]),
        });

        const sync = new FullCollectionSync(adapter, remote, resolver, queue);
        const result = await sync.sync();

        expect(result.fieldDefinitionsApplied).toBe(2);
        const all = await db.fieldDefinitions.toArray();
        expect(all.map(d => d.id).sort()).toEqual(['fd_a', 'fd_b']);
    });

    it('persists a remote soft-delete tombstone (deletedAt set) verbatim', async () => {
        const adapter = new IDBAdapter();
        const queue = new IDBSyncQueueManager();
        const resolver = new ServerAuthorityResolver(adapter, queue);

        await db.fieldDefinitions.put(makeDefinition({ id: 'fd_x', label: 'Live' }));

        const remote = mockRemote({
            pullAllFieldDefinitions: vi.fn().mockResolvedValue([
                makeDefinition({ id: 'fd_x', label: 'Live', deletedAt: 8000, updatedAt: 8000 }),
            ]),
        });

        const sync = new FullCollectionSync(adapter, remote, resolver, queue);
        await sync.sync();

        const stored = await db.fieldDefinitions.get('fd_x');
        expect(stored?.deletedAt).toBe(8000);
        // Soft-deleted rows must drop out of the normal listing.
        const listed = await adapter.listFieldDefinitions();
        expect(listed.data.find(d => d.id === 'fd_x')).toBeUndefined();
    });
});

describe('DeltaSync - FieldDefinitions', () => {
    beforeEach(async () => {
        await Promise.all([
            db.fieldDefinitions.clear(),
            db.syncQueue.clear(),
            db.nodes.clear(),
            db.fields.clear(),
            db.history.clear(),
            db.syncMetadata.clear(),
        ]);
    });

    it('calls pullFieldDefinitionsSince with lastSync and applies returned rows', async () => {
        const adapter = new IDBAdapter();
        const queue = new IDBSyncQueueManager();
        const resolver = new ServerAuthorityResolver(adapter, queue);

        await adapter.setLastSyncTimestamp(4242);

        const pullFieldDefinitionsSince = vi.fn().mockResolvedValue([
            makeDefinition({ id: 'fd_new', label: 'NewlyAdded', updatedAt: 5000 }),
        ]);
        const remote = mockRemote({ pullFieldDefinitionsSince });

        const sync = new DeltaSync(adapter, remote, resolver);
        const result = await sync.sync();

        expect(pullFieldDefinitionsSince).toHaveBeenCalledWith(4242);
        expect(result.fieldDefinitionsApplied).toBe(1);
        const stored = await db.fieldDefinitions.get('fd_new');
        expect(stored?.label).toBe('NewlyAdded');
    });
});
