/**
 * FullCollectionSync - Isolated full collection sync strategy.
 *
 * Handles safe full collection sync with deletion detection protection.
 * This strategy can be easily replaced with different sync strategies in the future.
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../storage/storageAdapter';
import type { TreeNode, DataField } from '../models';

export class FullCollectionSync {
  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private applyRemoteNode: (node: TreeNode) => Promise<void>,
    private applyRemoteField: (field: DataField) => Promise<void>
  ) {}

  async sync(): Promise<void> {
    await this.syncNodes();
    await this.syncFields();
    await this.syncHistory();
  }

  private async syncNodes(): Promise<void> {
    const remoteNodes = await this.remote.pullAllNodes();
    const remoteIds = new Set(remoteNodes.map(n => n.id));

    const localNodes = await this.local.getAllNodes();
    const pendingQueue = await this.local.getSyncQueue();
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

    // Apply remote nodes (LWW)
    for (const remoteNode of remoteNodes) {
      await this.applyRemoteNode(remoteNode);
    }
  }

  private async syncFields(): Promise<void> {
    const remoteFields = await this.remote.pullAllFields();
    const remoteIds = new Set(remoteFields.map(f => f.id));

    const localFields = await this.local.getAllFields();
    const pendingQueue = await this.local.getSyncQueue();
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

    // Apply remote fields (LWW)
    for (const remoteField of remoteFields) {
      await this.applyRemoteField(remoteField);
    }
  }

  private async syncHistory(): Promise<void> {
    const remoteHistory = await this.remote.pullAllHistory();

    // Upsert all remote history entries (no deletion detection)
    // Orphaned history entries are intentional - they will be handled by soft delete
    for (const hist of remoteHistory) {
      await this.local.applyRemoteHistory(hist);
    }

    console.log('[FullCollectionSync] Synced', remoteHistory.length, 'history entries');
  }
}
