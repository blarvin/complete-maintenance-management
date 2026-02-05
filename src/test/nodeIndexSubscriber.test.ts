import { describe, it, expect, beforeEach } from 'vitest';
import { handleStorageEvent } from '../data/nodeIndexSubscriber';
import { clearNodeIndex, getAncestorPath, initializeNodeIndex } from '../data/nodeIndex';

describe('nodeIndexSubscriber — handleStorageEvent', () => {
    beforeEach(() => {
        clearNodeIndex();
    });

    it('NODE_WRITTEN with deletedAt=null upserts into the index', () => {
        handleStorageEvent({
            type: 'NODE_WRITTEN',
            node: { id: 'n1', parentId: null, nodeName: 'Root', deletedAt: null },
        });

        const path = getAncestorPath('n1');
        expect(path).toEqual([{ id: 'n1', name: 'Root' }]);
    });

    it('NODE_WRITTEN updates an existing entry', () => {
        // Seed initial entry
        initializeNodeIndex([{ id: 'n1', parentId: null, nodeName: 'Old' }]);

        handleStorageEvent({
            type: 'NODE_WRITTEN',
            node: { id: 'n1', parentId: null, nodeName: 'New', deletedAt: null },
        });

        const path = getAncestorPath('n1');
        expect(path).toEqual([{ id: 'n1', name: 'New' }]);
    });

    it('NODE_WRITTEN with deletedAt set removes from the index', () => {
        initializeNodeIndex([{ id: 'n1', parentId: null, nodeName: 'Root' }]);

        handleStorageEvent({
            type: 'NODE_WRITTEN',
            node: { id: 'n1', parentId: null, nodeName: 'Root', deletedAt: 1234567890 },
        });

        const path = getAncestorPath('n1');
        expect(path).toEqual([]);
    });

    it('NODE_HARD_DELETED removes from the index', () => {
        initializeNodeIndex([{ id: 'n1', parentId: null, nodeName: 'Root' }]);

        handleStorageEvent({
            type: 'NODE_HARD_DELETED',
            nodeId: 'n1',
        });

        const path = getAncestorPath('n1');
        expect(path).toEqual([]);
    });

    it('NODE_HARD_DELETED for unknown id does not throw', () => {
        expect(() => {
            handleStorageEvent({ type: 'NODE_HARD_DELETED', nodeId: 'unknown' });
        }).not.toThrow();
    });

    it('builds correct ancestor path after a series of events', () => {
        handleStorageEvent({
            type: 'NODE_WRITTEN',
            node: { id: 'root', parentId: null, nodeName: 'Root', deletedAt: null },
        });
        handleStorageEvent({
            type: 'NODE_WRITTEN',
            node: { id: 'child', parentId: 'root', nodeName: 'Child', deletedAt: null },
        });

        const path = getAncestorPath('child');
        expect(path).toEqual([
            { id: 'root', name: 'Root' },
            { id: 'child', name: 'Child' },
        ]);
    });
});
