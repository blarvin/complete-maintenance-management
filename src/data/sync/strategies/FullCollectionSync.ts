/**
 * FullCollectionSync - Full collection sync strategy.
 *
 * Pulls all entities from remote and applies them locally using server authority resolution.
 * Handles deletion detection: removes local entities not present in remote
 * (unless they have pending local changes).
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../../storage/storageAdapter';
import type { SyncStrategy, SyncResult } from './SyncStrategy';
import type { ServerAuthorityResolver } from '../ServerAuthorityResolver';
import type { SyncQueueManager } from '../SyncQueueManager';

export class FullCollectionSync implements SyncStrategy {
  readonly name = 'full-collection';

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private resolver: ServerAuthorityResolver,
    private syncQueue: SyncQueueManager
  ) {}

  async sync(): Promise<SyncResult> {
    // Library Definitions are `library`-tree Elements — they arrive through the
    // element lane below, no separate Definition pull.
    const elementsApplied = await this.syncElements();
    const elementHistoryApplied = await this.syncElementHistory();

    return { elementsApplied, elementHistoryApplied };
  }

  private async syncElements(): Promise<number> {
    const remoteElements = await this.remote.pullAllElements();
    const remoteIds = new Set(remoteElements.map(e => e.id));

    const localElements = await this.local.getAllElements();
    const pendingQueue = await this.syncQueue.getSyncQueue();
    const pendingIds = new Set(
      pendingQueue
        .filter(item => item.entityType === 'element')
        .map(item => item.entityId)
    );

    // Delete local elements not in remote (unless pending push)
    for (const localElement of localElements) {
      if (!remoteIds.has(localElement.id) && !pendingIds.has(localElement.id)) {
        await this.local.deleteElementLocal(localElement.id);
        console.log('[FullCollectionSync] Deleted local element (removed remotely):', localElement.id);
      }
    }

    // Apply remote elements (server authority)
    let applied = 0;
    for (const remoteElement of remoteElements) {
      const result = await this.resolver.resolveElement(remoteElement);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncElementHistory(): Promise<number> {
    const remoteHistory = await this.remote.pullAllElementHistory();

    // Upsert all remote history entries (no deletion detection)
    // Orphaned history entries are intentional - they will be handled by soft delete
    for (const hist of remoteHistory) {
      await this.local.applyRemoteElementHistory(hist);
    }

    console.log('[FullCollectionSync] Synced', remoteHistory.length, 'element history entries');
    return remoteHistory.length;
  }
}
