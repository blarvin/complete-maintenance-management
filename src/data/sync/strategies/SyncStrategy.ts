/**
 * SyncStrategy - Common interface for pull sync strategies.
 *
 * Implementations:
 * - FullCollectionSync: Pull all entities from remote
 * - ScopedSync (future): Pull specific node subtree
 * - DeltaSync (future): Pull only changes since last sync
 */

export type SyncResult = {
  nodesApplied: number;
  fieldsApplied: number;
  historyApplied: number;
};

export interface SyncStrategy {
  /**
   * Human-readable name for logging/debugging.
   */
  readonly name: string;

  /**
   * Execute the sync strategy.
   * Pulls remote changes and applies them locally using LWW resolution.
   */
  sync(): Promise<SyncResult>;
}
