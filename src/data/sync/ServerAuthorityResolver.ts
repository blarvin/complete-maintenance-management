/**
 * ServerAuthorityResolver - Server is the source of truth.
 *
 * Applies remote data unconditionally unless the entity has pending
 * local changes in the sync queue. This implements "last to sync wins"
 * semantics where whoever successfully pushed to the server last is the winner.
 */

import type { SyncableStorageAdapter } from '../storage/storageAdapter';
import type { TreeNode, DataField, FieldDefinition } from '../models';
import type { SyncQueueManager } from './SyncQueueManager';

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

  async resolveNode(remote: TreeNode, pendingSet?: Set<string>): Promise<ResolveResult> {
    const set = pendingSet ?? await this.loadPendingSet();
    if (set.has(remote.id)) {
      console.log('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }
    await this.local.applyRemoteUpdate('node', remote);
    console.log('[Resolver] Applied server node', remote.id);
    return 'applied';
  }

  async resolveField(remote: DataField, pendingSet?: Set<string>): Promise<ResolveResult> {
    const set = pendingSet ?? await this.loadPendingSet();
    if (set.has(remote.id)) {
      console.log('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }
    await this.local.applyRemoteUpdate('field', remote);
    console.log('[Resolver] Applied server field', remote.id);
    return 'applied';
  }

  async resolveFieldDefinition(remote: FieldDefinition, pendingSet?: Set<string>): Promise<ResolveResult> {
    const set = pendingSet ?? await this.loadPendingSet();
    if (set.has(remote.id)) {
      console.log('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }
    await this.local.applyRemoteUpdate('fieldDefinition', remote);
    console.log('[Resolver] Applied server fieldDefinition', remote.id);
    return 'applied';
  }
}
