/**
 * FullCollectionSync - Full collection sync strategy.
 *
 * Pulls all entities from remote and applies them locally using server authority
 * resolution. Purely additive: it never removes a local row.
 *
 * **No deletion detection, by design.** This strategy used to delete any local
 * element absent from the server pull. Server absence turned out to be
 * irreducibly ambiguous — never-pushed, push-failed, admin-deleted, or
 * never-pushed *by design* (the dev seeds) all look identical from here — so the
 * purge could drop the one row you least want to lose, the one whose push
 * permanently failed (IMPLEMENTATION.md → *Retention over reconciliation*,
 * 2026-08-13). Retention is now the default: deletion
 * travels one way only, as a soft delete (`deletedAt`), which syncs as an
 * ordinary field update and so arrives through the apply loop below like any
 * other change. Removing the purge also retired the seed exemption that used to
 * live here — seeds are safe now because nothing purges.
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../../storage/storageAdapter';
import type { SyncStrategy, SyncResult } from './SyncStrategy';
import { highestStamp } from './SyncStrategy';
import type { ServerAuthorityResolver } from '../ServerAuthorityResolver';
import { devLog } from '../../../utils/devMode';

/** One lane's outcome: how many rows applied, and the newest stamp it saw. */
type LaneResult = { count: number; mark: number | null };

export class FullCollectionSync implements SyncStrategy {
  readonly name = 'full-collection';

  constructor(
    private local: SyncableStorageAdapter,
    private remote: RemoteSyncAdapter,
    private resolver: ServerAuthorityResolver
  ) {}

  async sync(): Promise<SyncResult> {
    // Library Definitions are `library`-tree Elements — they arrive through the
    // element lane below, no separate Definition pull.
    const elements = await this.syncElements();
    const history = await this.syncElementHistory();

    // A full pull sees everything, so this mark is simply the newest row on the
    // server. It is also the repair path for a cursor left in the future by the
    // old clock-stamped code: the next full sync writes the real value, which
    // may move the cursor *backwards*, and should — the window it re-opens is
    // exactly the one that was being skipped (IMPLEMENTATION.md → *The delta
    // cursor is a high-water mark, not the clock*).
    const highWaterMark = highestStamp([elements.mark, history.mark]);

    return {
      elementsApplied: elements.count,
      elementHistoryApplied: history.count,
      highWaterMark,
    };
  }

  private async syncElements(): Promise<LaneResult> {
    const remoteElements = await this.remote.pullAllElements();

    // Apply remote elements (server authority). Local-only rows are simply left
    // alone — see the no-deletion-detection note above.
    let applied = 0;
    for (const remoteElement of remoteElements) {
      const result = await this.resolver.resolveElement(remoteElement);
      if (result === 'applied') applied++;
    }

    return { count: applied, mark: highestStamp(remoteElements.map(e => e.updatedAt)) };
  }

  private async syncElementHistory(): Promise<LaneResult> {
    const remoteHistory = await this.remote.pullAllElementHistory();

    // Upsert all remote history entries (no deletion detection)
    // Orphaned history entries are intentional - they will be handled by soft delete
    for (const hist of remoteHistory) {
      await this.local.applyRemoteElementHistory(hist);
    }

    devLog('[FullCollectionSync] Synced', remoteHistory.length, 'element history entries');
    return { count: remoteHistory.length, mark: highestStamp(remoteHistory.map(h => h.updatedAt)) };
  }
}
