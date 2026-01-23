/**
 * LWWResolver - Last-Write-Wins conflict resolution.
 *
 * Handles conflict resolution between local and remote entities
 * using timestamp-based LWW strategy.
 */

import type { SyncableStorageAdapter } from '../storage/storageAdapter';
import type { TreeNode, DataField } from '../models';

export type LWWResult = 'applied' | 'skipped';

export class LWWResolver {
  constructor(private local: SyncableStorageAdapter) {}

  /**
   * Resolve a remote node against local state using LWW.
   * Returns 'applied' if remote was written, 'skipped' if local wins.
   */
  async resolveNode(remote: TreeNode): Promise<LWWResult> {
    const localResult = await this.local.getNode(remote.id);
    const local = localResult.data;

    if (!local) {
      // New node from remote, apply it
      await this.local.applyRemoteUpdate('node', remote);
      console.log('[LWWResolver] Applied new remote node', remote.id);
      return 'applied';
    }

    // LWW: compare timestamps
    if (remote.updatedAt > local.updatedAt) {
      // Remote wins
      await this.local.applyRemoteUpdate('node', remote);
      console.log('[LWWResolver] Remote node wins', remote.id);
      return 'applied';
    } else {
      // Local wins (or tie) - local is newer, it will be pushed in next sync
      console.log('[LWWResolver] Local node wins', remote.id);
      return 'skipped';
    }
  }

  /**
   * Resolve a remote field against local state using LWW.
   * Returns 'applied' if remote was written, 'skipped' if local wins.
   */
  async resolveField(remote: DataField): Promise<LWWResult> {
    const localFieldsResult = await this.local.listFields(remote.parentNodeId);
    const local = localFieldsResult.data.find(f => f.id === remote.id);

    if (!local) {
      // New field from remote, apply it
      await this.local.applyRemoteUpdate('field', remote);
      console.log('[LWWResolver] Applied new remote field', remote.id);
      return 'applied';
    }

    // LWW: compare timestamps
    if (remote.updatedAt > local.updatedAt) {
      // Remote wins
      await this.local.applyRemoteUpdate('field', remote);
      console.log('[LWWResolver] Remote field wins', remote.id);
      return 'applied';
    } else {
      // Local wins (or tie)
      console.log('[LWWResolver] Local field wins', remote.id);
      return 'skipped';
    }
  }
}
