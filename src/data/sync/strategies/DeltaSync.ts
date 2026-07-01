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
import type { ServerAuthorityResolver } from '../ServerAuthorityResolver';

export class DeltaSync implements SyncStrategy {
  readonly name = 'delta';

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private resolver: ServerAuthorityResolver
  ) {}

  async sync(): Promise<SyncResult> {
    const since = await this.local.getLastSyncTimestamp();
    console.log('[DeltaSync] Pulling changes since', since);

    // Load pending IDs once — avoids N queue fetches across all entities.
    const pendingSet = await this.resolver.loadPendingSet();

    // Library Definitions are `library`-tree Elements — they arrive through the
    // element lane, no separate Definition pull.
    const elementsApplied = await this.syncElements(since, pendingSet);
    const elementHistoryApplied = await this.syncElementHistory(since);

    console.log('[DeltaSync] Complete:', { elementsApplied, elementHistoryApplied });
    return { elementsApplied, elementHistoryApplied };
  }

  private async syncElements(since: number, pendingSet: Set<string>): Promise<number> {
    const elements = await this.remote.pullElementsSince(since);
    console.log('[DeltaSync] Pulled', elements.length, 'elements');

    let applied = 0;
    for (const element of elements) {
      const result = await this.resolver.resolveElement(element, pendingSet);
      if (result === 'applied') applied++;
    }

    return applied;
  }

  private async syncElementHistory(since: number): Promise<number> {
    const history = await this.remote.pullElementHistorySince(since);
    console.log('[DeltaSync] Pulled', history.length, 'element history entries');

    for (const h of history) {
      await this.local.applyRemoteElementHistory(h);
    }

    return history.length;
  }
}
