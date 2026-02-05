/**
 * ServerAuthorityResolver - Server is the source of truth.
 *
 * Applies remote data unconditionally unless the entity has pending
 * local changes in the sync queue. This implements "last to sync wins"
 * semantics where whoever successfully pushed to the server last is the winner.
 */

import type { SyncableStorageAdapter } from '../storage/storageAdapter';
import type { TreeNode, DataField } from '../models';
import type { SyncQueueManager } from './SyncQueueManager';

export type ResolveResult = 'applied' | 'skipped';

export class ServerAuthorityResolver {
  constructor(
    private local: SyncableStorageAdapter,
    private syncQueue: SyncQueueManager
  ) {}

  /**
   * Resolve a remote node against local state.
   * Applies unconditionally unless entity is pending in sync queue.
   */
  async resolveNode(remote: TreeNode): Promise<ResolveResult> {
    const isPending = await this.hasPendingSync(remote.id);

    if (isPending) {
      // Local change pending push - protect it
      console.log('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }

    // Server is authority - apply unconditionally
    await this.local.applyRemoteUpdate('node', remote);
    console.log('[Resolver] Applied server node', remote.id);
    return 'applied';
  }

  /**
   * Resolve a remote field against local state.
   * Applies unconditionally unless entity is pending in sync queue.
   */
  async resolveField(remote: DataField): Promise<ResolveResult> {
    const isPending = await this.hasPendingSync(remote.id);

    if (isPending) {
      // Local change pending push - protect it
      console.log('[Resolver] Skipped (pending local)', remote.id);
      return 'skipped';
    }

    // Server is authority - apply unconditionally
    await this.local.applyRemoteUpdate('field', remote);
    console.log('[Resolver] Applied server field', remote.id);
    return 'applied';
  }

  /**
   * Check if an entity has pending changes in the sync queue.
   */
  private async hasPendingSync(entityId: string): Promise<boolean> {
    const queue = await this.syncQueue.getSyncQueue();
    return queue.some(item => item.entityId === entityId);
  }
}
