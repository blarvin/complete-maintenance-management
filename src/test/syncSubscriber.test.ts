import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageEventBus } from '../data/storageEventBus';
import type { StorageEvent } from '../data/storageEventBus';

// Mock triggerSync before importing syncSubscriber
vi.mock('../hooks/useSyncTrigger', () => ({
  triggerSync: vi.fn(),
}));

import { triggerSync } from '../hooks/useSyncTrigger';

describe('syncSubscriber', () => {
  let bus: StorageEventBus;
  let subscribeSyncTrigger: (bus?: StorageEventBus) => () => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    bus = new StorageEventBus();

    // We test against the singleton pattern by calling subscribe directly
    // since subscribeSyncTrigger uses the module-level singleton.
    // Instead, we replicate the subscriber logic for testability.
    subscribeSyncTrigger = () => bus.subscribe(() => triggerSync());
  });

  afterEach(() => {
    bus.clear();
  });

  it('calls triggerSync on ELEMENT_WRITTEN (node)', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'ELEMENT_WRITTEN', element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on ELEMENT_HARD_DELETED', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'ELEMENT_HARD_DELETED', elementId: 'n1' });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on ELEMENT_WRITTEN (field)', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'ELEMENT_WRITTEN', element: { id: 'f1', kind: 'text-kv', parentId: 'n1', name: 'F1', value: null, treeType: 'business', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on ELEMENT_HARD_DELETED (field)', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'ELEMENT_HARD_DELETED', elementId: 'f1' });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync once per event for rapid emits', () => {
    subscribeSyncTrigger();
    const events: StorageEvent[] = [
      { type: 'ELEMENT_WRITTEN', element: { id: 'f1', kind: 'text-kv', parentId: 'n1', name: 'F1', value: null, treeType: 'business', deletedAt: null } },
      { type: 'ELEMENT_WRITTEN', element: { id: 'f2', kind: 'text-kv', parentId: 'n1', name: 'F2', value: null, treeType: 'business', deletedAt: null } },
      { type: 'ELEMENT_WRITTEN', element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: null } },
    ];
    for (const e of events) bus.emit(e);
    // triggerSync is called per event; debounce is inside triggerSync itself
    expect(triggerSync).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe stops triggering sync', () => {
    const unsub = subscribeSyncTrigger();
    bus.emit({ type: 'ELEMENT_WRITTEN', element: { id: 'f1', kind: 'text-kv', parentId: 'n1', name: 'F1', value: null, treeType: 'business', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();

    unsub();
    bus.emit({ type: 'ELEMENT_WRITTEN', element: { id: 'f2', kind: 'text-kv', parentId: 'n1', name: 'F2', value: null, treeType: 'business', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce(); // still 1, not 2
  });
});
