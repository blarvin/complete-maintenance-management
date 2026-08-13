/**
 * SyncStrategy - Common interface for pull sync strategies.
 *
 * Implementations:
 * - FullCollectionSync: Pull all entities from remote
 * - ScopedSync (future): Pull specific node subtree
 * - DeltaSync (future): Pull only changes since last sync
 */

export type SyncResult = {
  elementsApplied: number;
  elementHistoryApplied: number;
  /**
   * Highest `updatedAt` among the rows this pull actually received, across both
   * lanes — `null` when it received none. The sync cursor is set from this, not
   * from the local clock: rows are stamped with `serverTimestamp()`, so a
   * client running ahead of the server used to write a cursor past rows it had
   * never pulled (ISSUES Bugs #3). Elements and history share the one cursor,
   * hence one mark spanning both.
   */
  highWaterMark: number | null;
};

/**
 * Highest finite stamp, or null if there are none. Takes an array rather than
 * rest args — a full sync folds every pulled row through here, and spreading a
 * large collection into an argument list is a stack-limit waiting to happen.
 *
 * Non-finite entries are skipped rather than propagating: a row whose
 * `serverTimestamp()` had not resolved yet arrives with a null `updatedAt`, and
 * one of those must not poison the cursor.
 */
export function highestStamp(stamps: readonly (number | null | undefined)[]): number | null {
  let mark: number | null = null;
  for (const stamp of stamps) {
    if (typeof stamp !== 'number' || !Number.isFinite(stamp)) continue;
    if (mark === null || stamp > mark) mark = stamp;
  }
  return mark;
}

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
