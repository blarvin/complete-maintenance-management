import { describe, it, expect, beforeEach } from 'vitest';
import { handleStorageEvent } from '../data/nodeIndexSubscriber';
import { clearNodeIndex, getAncestorPath, initializeNodeIndex } from '../data/nodeIndex';

/** Build an ELEMENT_WRITTEN event payload for a node-kind element. */
function nodeWritten(id: string, parentId: string | null, name: string, deletedAt: number | null = null) {
    return {
        type: 'ELEMENT_WRITTEN' as const,
        // The node index reacts to a write whatever its origin — a pulled node has
        // to enter the index exactly like a locally created one.
        origin: 'local' as const,
        element: { id, kind: 'node' as const, parentId, name, value: null, treeType: 'business' as const, deletedAt },
    };
}

describe('nodeIndexSubscriber — handleStorageEvent', () => {
    beforeEach(() => {
        clearNodeIndex();
    });

    it('ELEMENT_WRITTEN (kind node, deletedAt=null) upserts into the index', () => {
        handleStorageEvent(nodeWritten('n1', null, 'Root'));

        const path = getAncestorPath('n1');
        expect(path).toEqual([{ id: 'n1', name: 'Root' }]);
    });

    it('ELEMENT_WRITTEN updates an existing entry', () => {
        initializeNodeIndex([{ id: 'n1', parentId: null, name: 'Old' }]);

        handleStorageEvent(nodeWritten('n1', null, 'New'));

        const path = getAncestorPath('n1');
        expect(path).toEqual([{ id: 'n1', name: 'New' }]);
    });

    it('ELEMENT_WRITTEN with deletedAt set removes from the index', () => {
        initializeNodeIndex([{ id: 'n1', parentId: null, name: 'Root' }]);

        handleStorageEvent(nodeWritten('n1', null, 'Root', 1234567890));

        const path = getAncestorPath('n1');
        expect(path).toEqual([]);
    });

    it('ELEMENT_WRITTEN for a non-node kind is ignored', () => {
        handleStorageEvent({
            type: 'ELEMENT_WRITTEN',
            origin: 'local',
            element: { id: 'f1', kind: 'text-kv', parentId: 'n1', name: 'VIN', value: 'X', treeType: 'business', deletedAt: null },
        });

        // Field elements never enter the node index.
        expect(getAncestorPath('f1')).toEqual([]);
    });

    it('ELEMENT_WRITTEN for a non-business tree is ignored (re-root policy Definition)', () => {
        handleStorageEvent({
            type: 'ELEMENT_WRITTEN',
            origin: 'local',
            element: { id: 'fd_logbook_policy', kind: 'logbook', parentId: null, name: 'Logbook Policy', value: null, treeType: 'library', deletedAt: null },
        });

        // A library row of a re-root kind is not a tree node.
        expect(getAncestorPath('fd_logbook_policy')).toEqual([]);
    });

    // Soft delete is the only removal channel — a written element carrying
    // `deletedAt` is what drops a node out of the index (IMPLEMENTATION.md →
    // *Retention over reconciliation*).
    it('a soft-deleted node is removed from the index', () => {
        initializeNodeIndex([{ id: 'n1', parentId: null, name: 'Root' }]);

        handleStorageEvent({
            type: 'ELEMENT_WRITTEN',
            origin: 'remote',
            element: { id: 'n1', kind: 'node', parentId: null, name: 'Root', value: null, treeType: 'business', deletedAt: 5000 },
        });

        expect(getAncestorPath('n1')).toEqual([]);
    });

    it('a soft delete for an unknown id does not throw', () => {
        expect(() => {
            handleStorageEvent({
                type: 'ELEMENT_WRITTEN',
                origin: 'remote',
                element: { id: 'unknown', kind: 'node', parentId: null, name: 'Gone', value: null, treeType: 'business', deletedAt: 5000 },
            });
        }).not.toThrow();
    });

    it('builds correct ancestor path after a series of events', () => {
        handleStorageEvent(nodeWritten('root', null, 'Root'));
        handleStorageEvent(nodeWritten('child', 'root', 'Child'));

        const path = getAncestorPath('child');
        expect(path).toEqual([
            { id: 'root', name: 'Root' },
            { id: 'child', name: 'Child' },
        ]);
    });
});
