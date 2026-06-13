import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeNodeIndex,
    clearNodeIndex,
    getAncestorPath,
    upsertNodeSummary,
    removeNodeSummary,
} from '../data/nodeIndex';

describe('nodeIndex', () => {
    beforeEach(() => {
        clearNodeIndex();
    });

    it('computes ancestor paths from seeded data', () => {
        initializeNodeIndex([
            { id: 'root', parentId: null, name: 'Root' },
            { id: 'child', parentId: 'root', name: 'Child' },
            { id: 'grandchild', parentId: 'child', name: 'Grandchild' },
        ]);

        const path = getAncestorPath('grandchild');

        expect(path).toEqual([
            { id: 'root', name: 'Root' },
            { id: 'child', name: 'Child' },
            { id: 'grandchild', name: 'Grandchild' },
        ]);
    });

    it('updates entries via upsert without touching descendants', () => {
        initializeNodeIndex([{ id: 'node-1', parentId: null, name: 'Old Name' }]);

        upsertNodeSummary({ id: 'node-1', parentId: null, name: 'New Name' });

        expect(getAncestorPath('node-1')).toEqual([{ id: 'node-1', name: 'New Name' }]);
    });

    it('removes entries via removeNodeSummary', () => {
        initializeNodeIndex([
            { id: 'root', parentId: null, name: 'Root' },
            { id: 'child', parentId: 'root', name: 'Child' },
        ]);

        removeNodeSummary('child');

        expect(getAncestorPath('child')).toEqual([]);
    });
});
