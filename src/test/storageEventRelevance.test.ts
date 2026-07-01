import { describe, it, expect } from 'vitest';
import { affectsChildrenOf, affectsElement } from '../data/storageEventRelevance';
import type { StorageEvent } from '../data/storageEventBus';

function written(overrides: Partial<Extract<StorageEvent, { type: 'ELEMENT_WRITTEN' }>['element']> = {}): StorageEvent {
    return {
        type: 'ELEMENT_WRITTEN',
        element: {
            id: 'el-1',
            kind: 'node',
            parentId: 'parent-1',
            name: 'Name',
            value: null,
            deletedAt: null,
            ...overrides,
        },
    };
}

const hardDeleted: StorageEvent = { type: 'ELEMENT_HARD_DELETED', elementId: 'el-1' };
const fieldDefWritten: StorageEvent = {
    type: 'DEFINITION_WRITTEN',
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

    it('always matches ELEMENT_HARD_DELETED (payload has no parentId)', () => {
        expect(affectsChildrenOf(hardDeleted, 'parent-1')).toBe(true);
        expect(affectsChildrenOf(hardDeleted, null)).toBe(true);
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

    it('matches ELEMENT_HARD_DELETED with the same id', () => {
        expect(affectsElement(hardDeleted, 'el-1')).toBe(true);
    });

    it('rejects ELEMENT_HARD_DELETED with a different id', () => {
        expect(affectsElement(hardDeleted, 'el-2')).toBe(false);
    });

    it('never matches DEFINITION_WRITTEN', () => {
        expect(affectsElement(fieldDefWritten, 'fd-1')).toBe(false);
    });
});
