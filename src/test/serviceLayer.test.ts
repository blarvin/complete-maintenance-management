/**
 * Tests for CQRS Registry - CommandBus and Query singletons
 *
 * Covers:
 * - getCommandBus / getNodeQueries / getFieldQueries return active instances
 * - setCommandBus / setNodeQueries / setFieldQueries allow custom injection
 * - resetCommandBus / resetQueries clears singletons
 * - initializeCommandBus / initializeQueries wire up from adapter
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    getCommandBus,
    setCommandBus,
    resetCommandBus,
    initializeCommandBus,
    CommandBus,
} from '../data/commands';
import {
    getNodeQueries,
    getFieldQueries,
    setNodeQueries,
    setFieldQueries,
    resetQueries,
    initializeQueries,
} from '../data/queries';
import type { INodeQueries, IFieldQueries } from '../data/queries';
import type { StorageAdapter } from '../data/storage/storageAdapter';

function mockAdapter(): StorageAdapter {
    return {
        listRootNodes: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }] }),
        getNode: vi.fn().mockResolvedValue({ data: { id: 'n1' } }),
        listChildren: vi.fn().mockResolvedValue({ data: [] }),
        createNode: vi.fn().mockResolvedValue({ data: { id: 'n1' } }),
        updateNode: vi.fn().mockResolvedValue({ data: undefined }),
        deleteNode: vi.fn().mockResolvedValue({ data: undefined }),
        listFields: vi.fn().mockResolvedValue({ data: [{ id: 'f1' }] }),
        nextCardOrder: vi.fn().mockResolvedValue({ data: 3 }),
        createField: vi.fn().mockResolvedValue({ data: { id: 'f1' } }),
        updateFieldValue: vi.fn().mockResolvedValue({ data: undefined }),
        deleteField: vi.fn().mockResolvedValue({ data: undefined }),
        getFieldHistory: vi.fn().mockResolvedValue({ data: [] }),
        listDeletedNodes: vi.fn().mockResolvedValue({ data: [] }),
        listDeletedChildren: vi.fn().mockResolvedValue({ data: [] }),
        restoreNode: vi.fn().mockResolvedValue({ data: undefined }),
        listDeletedFields: vi.fn().mockResolvedValue({ data: [] }),
        restoreField: vi.fn().mockResolvedValue({ data: undefined }),
    } as StorageAdapter;
}

describe('CQRS Registry', () => {
    afterEach(() => {
        resetCommandBus();
        resetQueries();
    });

    describe('CommandBus singleton', () => {
        it('throws when not initialized', () => {
            expect(() => getCommandBus()).toThrow('CommandBus not initialized');
        });

        it('returns bus after initializeCommandBus', () => {
            initializeCommandBus(mockAdapter());
            const bus = getCommandBus();
            expect(bus).toBeInstanceOf(CommandBus);
        });

        it('returns same instance on repeated calls', () => {
            initializeCommandBus(mockAdapter());
            expect(getCommandBus()).toBe(getCommandBus());
        });

        it('setCommandBus injects a custom bus', () => {
            const custom = new CommandBus();
            setCommandBus(custom);
            expect(getCommandBus()).toBe(custom);
        });

        it('resetCommandBus clears the singleton', () => {
            initializeCommandBus(mockAdapter());
            resetCommandBus();
            expect(() => getCommandBus()).toThrow('CommandBus not initialized');
        });

        it('initialized bus routes commands to adapter', async () => {
            const adapter = mockAdapter();
            initializeCommandBus(adapter);

            await getCommandBus().execute({ type: 'DELETE_NODE', payload: { id: 'n1' } });
            expect(adapter.deleteNode).toHaveBeenCalledWith('n1');
        });
    });

    describe('Query singletons', () => {
        it('throws when not initialized', () => {
            expect(() => getNodeQueries()).toThrow('Node queries not initialized');
            expect(() => getFieldQueries()).toThrow('Field queries not initialized');
        });

        it('returns queries after initializeQueries', async () => {
            const adapter = mockAdapter();
            initializeQueries(adapter);

            const nodes = await getNodeQueries().getRootNodes();
            expect(nodes).toEqual([{ id: 'r1' }]);
            expect(adapter.listRootNodes).toHaveBeenCalled();

            const fields = await getFieldQueries().getFieldsForNode('n1');
            expect(fields).toEqual([{ id: 'f1' }]);
            expect(adapter.listFields).toHaveBeenCalledWith('n1');
        });

        it('returns same instance on repeated calls', () => {
            initializeQueries(mockAdapter());
            expect(getNodeQueries()).toBe(getNodeQueries());
            expect(getFieldQueries()).toBe(getFieldQueries());
        });

        it('setNodeQueries / setFieldQueries inject custom implementations', async () => {
            const customNodeQueries: INodeQueries = {
                getRootNodes: vi.fn().mockResolvedValue([{ id: 'custom' }]),
                getNodeById: vi.fn(),
                getNodeWithChildren: vi.fn(),
                getChildren: vi.fn(),
            };
            const customFieldQueries: IFieldQueries = {
                getFieldsForNode: vi.fn().mockResolvedValue([{ id: 'custom-f' }]),
                getFieldHistory: vi.fn(),
                nextCardOrder: vi.fn(),
            };

            setNodeQueries(customNodeQueries);
            setFieldQueries(customFieldQueries);

            expect(getNodeQueries()).toBe(customNodeQueries);
            expect(getFieldQueries()).toBe(customFieldQueries);

            const nodes = await getNodeQueries().getRootNodes();
            expect(nodes).toEqual([{ id: 'custom' }]);
        });

        it('resetQueries clears singletons', () => {
            initializeQueries(mockAdapter());
            resetQueries();
            expect(() => getNodeQueries()).toThrow('Node queries not initialized');
            expect(() => getFieldQueries()).toThrow('Field queries not initialized');
        });

        it('node query methods delegate to adapter correctly', async () => {
            const adapter = mockAdapter();
            initializeQueries(adapter);

            await getNodeQueries().getNodeById('n1');
            expect(adapter.getNode).toHaveBeenCalledWith('n1');

            await getNodeQueries().getNodeWithChildren('n1');
            expect(adapter.getNode).toHaveBeenCalledWith('n1');
            expect(adapter.listChildren).toHaveBeenCalledWith('n1');

            await getNodeQueries().getChildren('p1');
            expect(adapter.listChildren).toHaveBeenCalledWith('p1');
        });

        it('field query methods delegate to adapter correctly', async () => {
            const adapter = mockAdapter();
            initializeQueries(adapter);

            await getFieldQueries().getFieldHistory('f1');
            expect(adapter.getFieldHistory).toHaveBeenCalledWith('f1');

            const order = await getFieldQueries().nextCardOrder('n1');
            expect(order).toBe(3);
            expect(adapter.nextCardOrder).toHaveBeenCalledWith('n1');
        });
    });
});
