/**
 * Per-tree policy — the single source of truth for how each `treeType` routes
 * sync and history. Mirrors SPEC → Data Model → *Populations are typed trees*
 * (the per-tree table) and Storage → Sync → *Routed by `treeType`*.
 *
 * | treeType     | history  | sync                |
 * | ------------ | -------- | ------------------- |
 * | business     | business | shared (LWW)        |
 * | library      | library  | shared (LWW)        |
 * | config       | overlay  | shared or per-user  |
 * | view-state   | none     | never synced        |
 *
 * Phase 1 has no producers for `config` / `view-state` elements, so the guards in
 * IDBAdapter that consult these are inert for today's business/library content —
 * they encode the policy so a future view-state/config write routes correctly
 * without touching the write methods again.
 */

import type { TreeType } from './models';

/** How a tree's elements sync. `none` = device-local, never pushed/pulled. */
export type TreeSyncMode = 'shared' | 'per-user' | 'none';

/** Which audit log a tree's changes file under. `none` = not tracked. */
export type TreeHistoryMode = 'business' | 'library' | 'overlay' | 'none';

export function treeSyncMode(treeType: TreeType): TreeSyncMode {
  switch (treeType) {
    case 'business':
    case 'library':
      return 'shared';
    case 'config':
      // SPEC: "shared or per-user" — Phase 1 picks shared-per-user as the seam;
      // the binary `shouldSyncTreeType` only needs "does it sync at all" (yes).
      return 'per-user';
    case 'view-state':
      return 'none';
  }
}

export function treeHistoryMode(treeType: TreeType): TreeHistoryMode {
  switch (treeType) {
    case 'business':
      return 'business';
    case 'library':
      return 'library';
    case 'config':
      return 'overlay';
    case 'view-state':
      return 'none';
  }
}

/** True when a tree's elements/history should be enqueued for sync at all. */
export function shouldSyncTreeType(treeType: TreeType): boolean {
  return treeSyncMode(treeType) !== 'none';
}

/** True when a tree's changes should be written to an audit log. */
export function shouldLogHistory(treeType: TreeType): boolean {
  return treeHistoryMode(treeType) !== 'none';
}
