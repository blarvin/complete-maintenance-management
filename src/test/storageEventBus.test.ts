import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEventBus } from '../data/storageEventBus';
import type { StorageEvent } from '../data/storageEventBus';

describe('StorageEventBus', () => {
    let bus: StorageEventBus;

    beforeEach(() => {
        bus = new StorageEventBus();
    });

    it('delivers events to subscribers', () => {
        const received: StorageEvent[] = [];
        bus.subscribe(e => received.push(e));

        const event: StorageEvent = {
            type: 'ELEMENT_WRITTEN',
            origin: 'local',
            element: { id: 'n1', kind: 'node', parentId: null, name: 'Root', value: null, treeType: 'business', deletedAt: null },
        };
        bus.emit(event);

        expect(received).toEqual([event]);
    });

    it('delivers to multiple subscribers', () => {
        const a: StorageEvent[] = [];
        const b: StorageEvent[] = [];
        bus.subscribe(e => a.push(e));
        bus.subscribe(e => b.push(e));

        const event: StorageEvent = {
            type: 'DEFINITION_WRITTEN',
            origin: 'remote',
            definition: { id: 'fd-1', deletedAt: null },
        };
        bus.emit(event);

        expect(a).toEqual([event]);
        expect(b).toEqual([event]);
    });

    it('unsubscribe removes only that subscriber', () => {
        const a: StorageEvent[] = [];
        const b: StorageEvent[] = [];
        const unsub = bus.subscribe(e => a.push(e));
        bus.subscribe(e => b.push(e));

        unsub();

        const event: StorageEvent = {
            type: 'ELEMENT_WRITTEN',
            origin: 'local',
            element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: null },
        };
        bus.emit(event);

        expect(a).toEqual([]);
        expect(b).toEqual([event]);
    });

    it('clear removes all subscribers', () => {
        const received: StorageEvent[] = [];
        bus.subscribe(e => received.push(e));
        bus.subscribe(e => received.push(e));

        bus.clear();
        bus.emit({ type: 'DEFINITION_WRITTEN', origin: 'remote', definition: { id: 'fd-1', deletedAt: null } });

        expect(received).toEqual([]);
    });

    it('emitting with no subscribers does not throw', () => {
        expect(() => {
            bus.emit({ type: 'DEFINITION_WRITTEN', origin: 'remote', definition: { id: 'fd-1', deletedAt: null } });
        }).not.toThrow();
    });
});
