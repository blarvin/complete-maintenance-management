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

    it('a local soft delete — origin decides, not the deletedAt payload', () => {
      // Deletion is an ordinary write carrying `deletedAt`; it must push like any
      // other local change. (There is no hard-delete event any more —
      // IMPLEMENTATION.md → *Soft delete is the only delete*.)
      subscribe();
      bus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'local',
        element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: 5000 },
      });
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

    it('a soft delete pulled from the server', () => {
      subscribe();
      bus.emit({
        type: 'ELEMENT_WRITTEN',
        origin: 'remote',
        element: { id: 'n1', kind: 'node', parentId: null, name: 'X', value: null, treeType: 'business', deletedAt: 5000 },
      });
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
