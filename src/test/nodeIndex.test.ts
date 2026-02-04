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
            { id: 'root', parentId: null, nodeName: 'Root' },
            { id: 'child', parentId: 'root', nodeName: 'Child' },
            { id: 'grandchild', parentId: 'child', nodeName: 'Grandchild' },
        ]);

        const path = getAncestorPath('grandchild');

        expect(path).toEqual([
            { id: 'root', name: 'Root' },
            { id: 'child', name: 'Child' },
            { id: 'grandchild', name: 'Grandchild' },
        ]);
    });

    it('updates entries via upsert without touching descendants', () => {
        initializeNodeIndex([{ id: 'node-1', parentId: null, nodeName: 'Old Name' }]);

        upsertNodeSummary({ id: 'node-1', parentId: null, nodeName: 'New Name' });

        expect(getAncestorPath('node-1')).toEqual([{ id: 'node-1', name: 'New Name' }]);
    });

    it('removes entries via removeNodeSummary', () => {
        initializeNodeIndex([
            { id: 'root', parentId: null, nodeName: 'Root' },
            { id: 'child', parentId: 'root', nodeName: 'Child' },
        ]);

        removeNodeSummary('child');

        expect(getAncestorPath('child')).toEqual([]);
    });
});
