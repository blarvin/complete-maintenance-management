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
import { highestStamp } from './SyncStrategy';
import type { ServerAuthorityResolver } from '../ServerAuthorityResolver';
import { devLog } from '../../../utils/devMode';

/** One lane's outcome: how many rows applied, and the newest stamp it saw. */
type LaneResult = { count: number; mark: number | null };

export class DeltaSync implements SyncStrategy {
  readonly name = 'delta';

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private resolver: ServerAuthorityResolver
  ) {}

  async sync(): Promise<SyncResult> {
    const since = await this.local.getLastSyncTimestamp();
    devLog('[DeltaSync] Pulling changes since', since);

    // Load pending IDs once — avoids N queue fetches across all entities.
    const pendingSet = await this.resolver.loadPendingSet();

    // Library Definitions are `library`-tree Elements — they arrive through the
    // element lane, no separate Definition pull.
    const elements = await this.syncElements(since, pendingSet);
    const history = await this.syncElementHistory(since);

    // The two lanes share one cursor, so the mark is the max across both. Note
    // it is the newest row *received*, not the newest applied: a row the
    // resolver skipped (pending local edit wins) still arrived, and re-pulling
    // it forever would be the same staleness bug wearing a different hat.
    const highWaterMark = highestStamp([elements.mark, history.mark]);

    devLog('[DeltaSync] Complete:', {
      elementsApplied: elements.count,
      elementHistoryApplied: history.count,
      highWaterMark,
    });
    return {
      elementsApplied: elements.count,
      elementHistoryApplied: history.count,
      highWaterMark,
    };
  }

  private async syncElements(since: number, pendingSet: Set<string>): Promise<LaneResult> {
    const elements = await this.remote.pullElementsSince(since);
    devLog('[DeltaSync] Pulled', elements.length, 'elements');

    let applied = 0;
    for (const element of elements) {
      const result = await this.resolver.resolveElement(element, pendingSet);
      if (result === 'applied') applied++;
    }

    return { count: applied, mark: highestStamp(elements.map(e => e.updatedAt)) };
  }

  private async syncElementHistory(since: number): Promise<LaneResult> {
    const history = await this.remote.pullElementHistorySince(since);
    devLog('[DeltaSync] Pulled', history.length, 'element history entries');

    for (const h of history) {
      await this.local.applyRemoteElementHistory(h);
    }

    return { count: history.length, mark: highestStamp(history.map(h => h.updatedAt)) };
  }
}
