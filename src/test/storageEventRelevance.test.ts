import { describe, it, expect } from 'vitest';
import { affectsChildrenOf, affectsElement } from '../data/storageEventRelevance';
import type { StorageEvent } from '../data/storageEventBus';

function written(overrides: Partial<Extract<StorageEvent, { type: 'ELEMENT_WRITTEN' }>['element']> = {}): StorageEvent {
    return {
        type: 'ELEMENT_WRITTEN',
        // Relevance is about *which* element changed, never about where the write
        // came from — a remote row is as relevant to a subscribed view as a local one.
        origin: 'local',
        element: {
            id: 'el-1',
            kind: 'node',
            parentId: 'parent-1',
            name: 'Name',
            value: null,
            treeType: 'business',
            deletedAt: null,
            ...overrides,
        },
    };
}

const fieldDefWritten: StorageEvent = {
    type: 'DEFINITION_WRITTEN',
    origin: 'local',
    definition: { id: 'fd-1', deletedAt: null },
};

describe('affectsChildrenOf', () => {
    it('matches ELEMENT_WRITTEN with the same parentId', () => {
        expect(affectsChildrenOf(written({ parentId: 'parent-1' }), 'parent-1')).toBe(true);
    });

    it('rejects ELEMENT_WRITTEN with a different parentId', () => {
        expect(affectsChildrenOf(written({ parentId: 'parent-2' }), 'parent-1')).toBe(false);
    });

    it('matches root (null parentId) writes against null', () => {
        expect(affectsChildrenOf(written({ parentId: null }), null)).toBe(true);
    });

    it('rejects non-root writes against null', () => {
        expect(affectsChildrenOf(written({ parentId: 'parent-1' }), null)).toBe(false);
    });

    // A soft delete is an ordinary write carrying `deletedAt`, so it routes on
    // parentId like any other — no blind "reload everything" branch remains.
    it('routes a soft delete by parentId, like any other write', () => {
        expect(affectsChildrenOf(written({ parentId: 'parent-1', deletedAt: 5000 }), 'parent-1')).toBe(true);
        expect(affectsChildrenOf(written({ parentId: 'parent-2', deletedAt: 5000 }), 'parent-1')).toBe(false);
    });

    it('never matches DEFINITION_WRITTEN', () => {
        expect(affectsChildrenOf(fieldDefWritten, 'parent-1')).toBe(false);
        expect(affectsChildrenOf(fieldDefWritten, null)).toBe(false);
    });
});

describe('affectsElement', () => {
    it('matches ELEMENT_WRITTEN with the same id', () => {
        expect(affectsElement(written({ id: 'el-1' }), 'el-1')).toBe(true);
    });

    it('rejects ELEMENT_WRITTEN with a different id', () => {
        expect(affectsElement(written({ id: 'el-2' }), 'el-1')).toBe(false);
    });

    it('matches a soft delete by id', () => {
        expect(affectsElement(written({ id: 'el-1', deletedAt: 5000 }), 'el-1')).toBe(true);
        expect(affectsElement(written({ id: 'el-2', deletedAt: 5000 }), 'el-1')).toBe(false);
    });

    it('never matches DEFINITION_WRITTEN', () => {
        expect(affectsElement(fieldDefWritten, 'fd-1')).toBe(false);
    });
});
