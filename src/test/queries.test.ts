import { describe, it, expect, vi } from 'vitest';
import { nodeQueriesFromAdapter, fieldQueriesFromAdapter } from '../data/queries';
import type { StorageAdapter } from '../data/storage/storageAdapter';

function mockAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    listRootNodes: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }] }),
    getNode: vi.fn().mockResolvedValue({ data: { id: 'n1' } }),
    listChildren: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }] }),
    listFields: vi.fn().mockResolvedValue({ data: [{ id: 'f1' }] }),
    getFieldHistory: vi.fn().mockResolvedValue({ data: [{ id: 'h1' }] }),
    nextCardOrder: vi.fn().mockResolvedValue({ data: 3 }),
    // Unused in queries but required by interface
    createNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    createField: vi.fn(),
    updateFieldValue: vi.fn(),
    deleteField: vi.fn(),
    listDeletedNodes: vi.fn(),
    listDeletedChildren: vi.fn(),
    restoreNode: vi.fn(),
    listDeletedFields: vi.fn(),
    restoreField: vi.fn(),
    ...overrides,
  } as StorageAdapter;
}

describe('Query factories', () => {
  describe('nodeQueriesFromAdapter', () => {
    it('getRootNodes unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = nodeQueriesFromAdapter(adapter);
      const result = await q.getRootNodes();
      expect(result).toEqual([{ id: 'r1' }]);
      expect(adapter.listRootNodes).toHaveBeenCalled();
    });

    it('getNodeById delegates to adapter.getNode', async () => {
      const adapter = mockAdapter();
      const q = nodeQueriesFromAdapter(adapter);
      const result = await q.getNodeById('n1');
      expect(result).toEqual({ id: 'n1' });
      expect(adapter.getNode).toHaveBeenCalledWith('n1');
    });

    it('getNodeWithChildren fetches node and children in parallel', async () => {
      const adapter = mockAdapter();
      const q = nodeQueriesFromAdapter(adapter);
      const result = await q.getNodeWithChildren('n1');
      expect(result.node).toEqual({ id: 'n1' });
      expect(result.children).toEqual([{ id: 'c1' }]);
      expect(adapter.getNode).toHaveBeenCalledWith('n1');
      expect(adapter.listChildren).toHaveBeenCalledWith('n1');
    });

    it('getChildren delegates to adapter.listChildren', async () => {
      const adapter = mockAdapter();
      const q = nodeQueriesFromAdapter(adapter);
      const result = await q.getChildren('p1');
      expect(result).toEqual([{ id: 'c1' }]);
      expect(adapter.listChildren).toHaveBeenCalledWith('p1');
    });
  });

  describe('fieldQueriesFromAdapter', () => {
    it('getFieldsForNode unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = fieldQueriesFromAdapter(adapter);
      const result = await q.getFieldsForNode('n1');
      expect(result).toEqual([{ id: 'f1' }]);
      expect(adapter.listFields).toHaveBeenCalledWith('n1');
    });

    it('getFieldHistory delegates to adapter.getFieldHistory', async () => {
      const adapter = mockAdapter();
      const q = fieldQueriesFromAdapter(adapter);
      const result = await q.getFieldHistory('f1');
      expect(result).toEqual([{ id: 'h1' }]);
      expect(adapter.getFieldHistory).toHaveBeenCalledWith('f1');
    });

    it('nextCardOrder unwraps StorageResult', async () => {
      const adapter = mockAdapter();
      const q = fieldQueriesFromAdapter(adapter);
      const result = await q.nextCardOrder('n1');
      expect(result).toBe(3);
      expect(adapter.nextCardOrder).toHaveBeenCalledWith('n1');
    });
  });
});
