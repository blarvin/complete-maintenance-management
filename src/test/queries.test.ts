import { describe, it, expect, vi } from 'vitest';
import { elementQueriesFromAdapter, definitionQueriesFromAdapter } from '../data/queries';
import type { StorageAdapter } from '../data/storage/storageAdapter';

function mockAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    listRootElements: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }] }),
    getElement: vi.fn().mockResolvedValue({ data: { id: 'e1' } }),
    listChildElements: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }] }),
    listChildElementsByKind: vi.fn().mockResolvedValue({ data: [{ id: 'k1' }] }),
    getElementHistory: vi.fn().mockResolvedValue({ data: [{ id: 'h1' }] }),
    nextSiblingOrder: vi.fn().mockResolvedValue({ data: 3 }),
    listDefinitions: vi.fn().mockResolvedValue({ data: [{ id: 'fd1', label: 'A' }] }),
    getDefinition: vi.fn().mockResolvedValue({ data: { id: 'fd1' } }),
    ...overrides,
  } as unknown as StorageAdapter;
}

describe('Query factories', () => {
  describe('elementQueriesFromAdapter', () => {
    it('getRootElements unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.getRootElements();
      expect(result).toEqual([{ id: 'r1' }]);
      expect(adapter.listRootElements).toHaveBeenCalled();
    });

    it('getElementById delegates to adapter.getElement', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.getElementById('e1');
      expect(result).toEqual({ id: 'e1' });
      expect(adapter.getElement).toHaveBeenCalledWith('e1');
    });

    it('getChildren delegates to adapter.listChildElements', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.getChildren('p1');
      expect(result).toEqual([{ id: 'c1' }]);
      expect(adapter.listChildElements).toHaveBeenCalledWith('p1');
    });

    it('getChildrenByKind delegates to adapter.listChildElementsByKind', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.getChildrenByKind('p1', 'text-kv');
      expect(result).toEqual([{ id: 'k1' }]);
      expect(adapter.listChildElementsByKind).toHaveBeenCalledWith('p1', 'text-kv');
    });

    it('getElementHistory delegates to adapter.getElementHistory', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.getElementHistory('e1');
      expect(result).toEqual([{ id: 'h1' }]);
      expect(adapter.getElementHistory).toHaveBeenCalledWith('e1');
    });

    it('nextSiblingOrder unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = elementQueriesFromAdapter(adapter);
      const result = await q.nextSiblingOrder('p1', 'node');
      expect(result).toBe(3);
      expect(adapter.nextSiblingOrder).toHaveBeenCalledWith('p1', 'node');
    });
  });

  describe('definitionQueriesFromAdapter', () => {
    it('listDefinitions unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = definitionQueriesFromAdapter(adapter);
      const result = await q.listDefinitions();
      expect(result).toEqual([{ id: 'fd1', label: 'A' }]);
    });

    it('getDefinitionByLabel finds the matching definition', async () => {
      const adapter = mockAdapter();
      const q = definitionQueriesFromAdapter(adapter);
      const result = await q.getDefinitionByLabel('A');
      expect(result).toEqual({ id: 'fd1', label: 'A' });
    });
  });
});
