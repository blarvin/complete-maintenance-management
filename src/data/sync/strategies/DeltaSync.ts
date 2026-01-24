/**
 * DeltaSync - Incremental sync strategy.
 *
 * Pulls only entities updated since the last sync timestamp.
 * Much faster than full collection sync for ongoing synchronization.
 * 
 * Relies on:
 * - Soft deletes (deletedAt field) to detect remote deletions
 * - Server timestamps for authoritative ordering
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../../storage/storageAdapter';
import type { SyncStrategy, SyncResult } from './SyncStrategy';
import type { LWWResolver } from '../LWWResolver';
import type { TreeNode, DataField } from '../../models';

export class DeltaSync implements SyncStrategy {
  readonly name = 'delta';

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private resolver: LWWResolver
  ) {}

  async sync(): Promise<SyncResult> {
    const since = await this.local.getLastSyncTimestamp();
    console.log('[DeltaSync] Pulling changes since', since);

    const nodesApplied = await this.syncNodes(since);
    const fieldsApplied = await this.syncFields(since);
    const historyApplied = await this.syncHistory(since);

    console.log('[DeltaSync] Complete:', { nodesApplied, fieldsApplied, historyApplied });
    return { nodesApplied, fieldsApplied, historyApplied };
  }

  private async syncNodes(since: number): Promise<number> {
    const nodes = await this.remote.pullEntitiesSince('node', since);
    console.log('[DeltaSync] Pulled', nodes.length, 'nodes');

    let applied = 0;
    for (const node of nodes) {
      const result = await this.resolver.resolveNode(node as TreeNode);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncFields(since: number): Promise<number> {
    const fields = await this.remote.pullEntitiesSince('field', since);
    console.log('[DeltaSync] Pulled', fields.length, 'fields');

    let applied = 0;
    for (const field of fields) {
      const result = await this.resolver.resolveField(field as DataField);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncHistory(since: number): Promise<number> {
    const history = await this.remote.pullHistorySince(since);
    console.log('[DeltaSync] Pulled', history.length, 'history entries');

    for (const h of history) {
      await this.local.applyRemoteHistory(h);
    }

    return history.length;
  }
}
