/**
 * syncSubscriber — which storage events schedule a sync.
 *
 * Drives the real `handleStorageEvent` (imported, not re-implemented): the earlier
 * version of this file rebuilt the subscriber inline, so it would have passed
 * whatever the shipped subscriber did — including the remote-echo bug below.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageEventBus } from '../data/storageEventBus';
import type { StorageEvent } from '../data/storageEventBus';

// Mock triggerSync before importing the subscriber
vi.mock('../hooks/useSyncTrigger', () => ({
  triggerSync: vi.fn(),
}));

import { triggerSync } from '../hooks/useSyncTrigger';
import { handleStorageEvent } from '../data/syncSubscriber';

const elementWritten = (id: string, origin: 'local' | 'remote'): StorageEvent => ({
  type: 'ELEMENT_WRITTEN',
  origin,
  element: { id, kind: 'text-kv', parentId: 'n1', name: id, value: null, treeType: 'business', deletedAt: null },
});

describe('syncSubscriber', () => {
  let bus: StorageEventBus;
  let subscribe: () => () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new StorageEventBus();
    // The singleton subscribes `handleStorageEvent`; here it rides a local bus.
    subscribe = () => bus.subscribe(handleStorageEvent);
  });

  afterEach(() => {
    bus.clear();
  });

  describe('local writes schedule a sync', () => {
    it('ELEMENT_WRITTEN (node)', () => {
      subscribe();
      bus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'local',
        element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: null },
      });
      expect(triggerSync).toHaveBeenCalledOnce();
    });

    it('ELEMENT_WRITTEN (field)', () => {
      subscribe();
      bus.emit(elementWritten('f1', 'local'));
      expect(triggerSync).toHaveBeenCalledOnce();
    });

    it('DEFINITION_WRITTEN', () => {
      subscribe();
      bus.emit({ type: 'DEFINITION_WRITTEN', origin: 'local', definition: { id: 'fd-1', deletedAt: null } });
      expect(triggerSync).toHaveBeenCalledOnce();
    });

    it('ELEMENT_HARD_DELETED — origin decides, not event type', () => {
      // No local hard delete exists today (only FullCollectionSync purges), but the
      // rule is about origin, so a future local purge would still push.
      subscribe();
      bus.emit({ type: 'ELEMENT_HARD_DELETED', origin: 'local', elementId: 'n1' });
      expect(triggerSync).toHaveBeenCalledOnce();
    });

    it('once per event — the debounce lives inside triggerSync', () => {
      subscribe();
      for (const e of [elementWritten('f1', 'local'), elementWritten('f2', 'local'), elementWritten('f3', 'local')]) {
        bus.emit(e);
      }
      expect(triggerSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('remote applies do NOT schedule a sync (the echo fix)', () => {
    // A pull emits the same events a local edit does, so the UI repaints either
    // way. Without the origin check each non-empty pull scheduled another pull.
    it('ELEMENT_WRITTEN applied from a pull', () => {
      subscribe();
      bus.emit(elementWritten('f1', 'remote'));
      expect(triggerSync).not.toHaveBeenCalled();
    });

    it('DEFINITION_WRITTEN applied from a pull', () => {
      subscribe();
      bus.emit({ type: 'DEFINITION_WRITTEN', origin: 'remote', definition: { id: 'fd-1', deletedAt: null } });
      expect(triggerSync).not.toHaveBeenCalled();
    });

    it('ELEMENT_HARD_DELETED from a full-sync purge', () => {
      subscribe();
      bus.emit({ type: 'ELEMENT_HARD_DELETED', origin: 'remote', elementId: 'n1' });
      expect(triggerSync).not.toHaveBeenCalled();
    });

    it('a whole pull of many rows schedules nothing', () => {
      subscribe();
      for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) bus.emit(elementWritten(id, 'remote'));
      expect(triggerSync).not.toHaveBeenCalled();
    });

    it('a local edit in the same batch still gets through', () => {
      subscribe();
      bus.emit(elementWritten('remote-1', 'remote'));
      bus.emit(elementWritten('local-1', 'local'));
      bus.emit(elementWritten('remote-2', 'remote'));
      expect(triggerSync).toHaveBeenCalledOnce();
    });
  });

  it('unsubscribe stops triggering sync', () => {
    const unsub = subscribe();
    bus.emit(elementWritten('f1', 'local'));
    expect(triggerSync).toHaveBeenCalledOnce();

    unsub();
    bus.emit(elementWritten('f2', 'local'));
    expect(triggerSync).toHaveBeenCalledOnce(); // still 1, not 2
  });
});
