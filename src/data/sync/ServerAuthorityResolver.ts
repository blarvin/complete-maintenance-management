/**
 * ServerAuthorityResolver - Server is the source of truth.
 *
 * Applies remote data unconditionally unless the entity has pending
 * local changes in the sync queue. This implements "last to sync wins"
 * semantics where whoever successfully pushed to the server last is the winner.
 */

import type { SyncableStorageAdapter } from '../storage/storageAdapter';
import type { Element } from '../models';
import type { SyncQueueManager } from './SyncQueueManager';
import { devLog } from '../../utils/devMode';

export type ResolveResult = 'applied' | 'skipped';

export class ServerAuthorityResolver {
  constructor(
    private local: SyncableStorageAdapter,
    private syncQueue: SyncQueueManager
  ) {}

  /** Load all pending entity IDs from the sync queue as a Set for O(1) lookup. */
  async loadPendingSet(): Promise<Set<string>> {
    const queue = await this.syncQueue.getSyncQueue();
    return new Set(queue.map(item => item.entityId));
  }

  async resolveElement(remote: Element, pendingSet?: Set<string>): Promise<ResolveResult> {
    const set = pendingSet ?? await this.loadPendingSet();
    if (set.has(remote.id)) {
      devLog('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }
    await this.local.applyRemoteElement(remote);
    devLog('[Resolver] Applied server element', remote.id);
    return 'applied';
  }
}
