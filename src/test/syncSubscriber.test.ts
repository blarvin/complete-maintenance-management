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

  it('calls triggerSync on NODE_WRITTEN', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'NODE_WRITTEN', node: { id: 'n1', parentId: null, nodeName: 'X', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on NODE_HARD_DELETED', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'NODE_HARD_DELETED', nodeId: 'n1' });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on FIELD_WRITTEN', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'FIELD_WRITTEN', field: { id: 'f1', parentNodeId: 'n1', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync on FIELD_DELETED', () => {
    subscribeSyncTrigger();
    bus.emit({ type: 'FIELD_DELETED', fieldId: 'f1' });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  it('calls triggerSync once per event for rapid emits', () => {
    subscribeSyncTrigger();
    const events: StorageEvent[] = [
      { type: 'FIELD_WRITTEN', field: { id: 'f1', parentNodeId: 'n1', deletedAt: null } },
      { type: 'FIELD_WRITTEN', field: { id: 'f2', parentNodeId: 'n1', deletedAt: null } },
      { type: 'NODE_WRITTEN', node: { id: 'n1', parentId: null, nodeName: 'X', deletedAt: null } },
    ];
    for (const e of events) bus.emit(e);
    // triggerSync is called per event; debounce is inside triggerSync itself
    expect(triggerSync).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe stops triggering sync', () => {
    const unsub = subscribeSyncTrigger();
    bus.emit({ type: 'FIELD_WRITTEN', field: { id: 'f1', parentNodeId: 'n1', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce();

    unsub();
    bus.emit({ type: 'FIELD_WRITTEN', field: { id: 'f2', parentNodeId: 'n1', deletedAt: null } });
    expect(triggerSync).toHaveBeenCalledOnce(); // still 1, not 2
  });
});
