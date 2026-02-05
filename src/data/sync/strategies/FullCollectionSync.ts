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
    const nodesApplied = await this.syncNodes();
    const fieldsApplied = await this.syncFields();
    const historyApplied = await this.syncHistory();

    return { nodesApplied, fieldsApplied, historyApplied };
  }

  private async syncNodes(): Promise<number> {
    const remoteNodes = await this.remote.pullAllNodes();
    const remoteIds = new Set(remoteNodes.map(n => n.id));

    const localNodes = await this.local.getAllNodes();
    const pendingQueue = await this.syncQueue.getSyncQueue();
    const pendingIds = new Set(
      pendingQueue
        .filter(item => item.entityType === 'node')
        .map(item => item.entityId)
    );

    // Delete local nodes not in remote (unless pending push)
    for (const localNode of localNodes) {
      if (!remoteIds.has(localNode.id) && !pendingIds.has(localNode.id)) {
        await this.local.deleteNodeLocal(localNode.id);
        console.log('[FullCollectionSync] Deleted local node (removed remotely):', localNode.id);
      }
    }

    // Apply remote nodes (server authority)
    let applied = 0;
    for (const remoteNode of remoteNodes) {
      const result = await this.resolver.resolveNode(remoteNode);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncFields(): Promise<number> {
    const remoteFields = await this.remote.pullAllFields();
    const remoteIds = new Set(remoteFields.map(f => f.id));

    const localFields = await this.local.getAllFields();
    const pendingQueue = await this.syncQueue.getSyncQueue();
    const pendingIds = new Set(
      pendingQueue
        .filter(item => item.entityType === 'field')
        .map(item => item.entityId)
    );

    // Delete local fields not in remote (unless pending push)
    for (const localField of localFields) {
      if (!remoteIds.has(localField.id) && !pendingIds.has(localField.id)) {
        await this.local.deleteFieldLocal(localField.id);
        console.log('[FullCollectionSync] Deleted local field (removed remotely):', localField.id);
      }
    }

    // Apply remote fields (server authority)
    let applied = 0;
    for (const remoteField of remoteFields) {
      const result = await this.resolver.resolveField(remoteField);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncHistory(): Promise<number> {
    const remoteHistory = await this.remote.pullAllHistory();

    // Upsert all remote history entries (no deletion detection)
    // Orphaned history entries are intentional - they will be handled by soft delete
    for (const hist of remoteHistory) {
      await this.local.applyRemoteHistory(hist);
    }

    console.log('[FullCollectionSync] Synced', remoteHistory.length, 'history entries');
    return remoteHistory.length;
  }
}
