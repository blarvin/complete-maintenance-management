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
 * permanently failed (ISSUES Bugs #4). Retention is now the default: deletion
 * travels one way only, as a soft delete (`deletedAt`), which syncs as an
 * ordinary field update and so arrives through the apply loop below like any
 * other change. Removing the purge also retired the seed exemption that used to
 * live here (ISSUES Bugs #1) — seeds are safe now because nothing purges.
 */

import type { SyncableStorageAdapter, RemoteSyncAdapter } from '../../storage/storageAdapter';
import type { SyncStrategy, SyncResult } from './SyncStrategy';
import type { ServerAuthorityResolver } from '../ServerAuthorityResolver';
import { devLog } from '../../../utils/devMode';

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
    const elementsApplied = await this.syncElements();
    const elementHistoryApplied = await this.syncElementHistory();

    return { elementsApplied, elementHistoryApplied };
  }

  private async syncElements(): Promise<number> {
    const remoteElements = await this.remote.pullAllElements();

    // Apply remote elements (server authority). Local-only rows are simply left
    // alone — see the no-deletion-detection note above.
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

    devLog('[FullCollectionSync] Synced', remoteHistory.length, 'element history entries');
    return remoteHistory.length;
  }
}
