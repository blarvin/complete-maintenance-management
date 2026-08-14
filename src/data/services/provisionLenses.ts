/**
 * Lens provisioning — the reconciler behind `ProvisionSpec`.
 *
 * Spec-driven throughout: both functions loop `PROVISIONED_LENSES` (derived from
 * every kind's `provision` capability), so a new lens kind joins with no edit here.
 * Each lens id is deterministic (`${parentId}::${suffix}`), which is what makes the
 * whole thing idempotent — reconciling twice, or from two clients at once,
 * converges on one lens rather than minting duplicates.
 *
 * Two entry points for the same reconcile, differing only in when they run:
 *   - `ensureProvisionedLenses` — at create time, from the `CREATE_ELEMENT` handler.
 *   - `backfillProvisionedLenses` — at startup, over what is already stored.
 */

import type { StorageAdapter } from '../storage/storageAdapter';
import type { Element } from '../models';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { isProvisionedLens, PROVISIONED_LENSES } from '../../kinds/provisionPolicy';

/**
 * Provision each declared lens child on one container re-root node.
 *
 * Skipped for the lens kinds themselves (no lens-on-lens) and for lens-surfaced
 * kinds (a `job`/`log-entry` is itself rolled up by a lens, so it must not nest its
 * own containers). Each lens gathers its owning node's target-kind descendants at
 * view time — no upward ancestor walk.
 *
 * Created via the adapter directly (not the command bus), so it does not re-enter
 * `CREATE_ELEMENT`. Returns how many lenses it actually created (0 = already
 * reconciled), which is what makes the backfill able to report itself.
 */
export async function ensureProvisionedLenses(adapter: StorageAdapter, parent: Element): Promise<number> {
  if (!isReRoot(parent.kind) || isProvisionedLens(parent.kind) || isLensSurfaced(parent.kind)) return 0;
  let created = 0;
  for (const lens of PROVISIONED_LENSES) {
    const lensId = `${parent.id}::${lens.suffix}`;
    const existing = await adapter.getElement(lensId);
    if (existing.data) continue;
    // Stamp the lens's default policy Definition if-resolvable: createElement
    // validates any non-null definitionId against the library and throws
    // not-found, so an unseeded DB (tests, pre-seed creates) must mint with
    // null and lean on the consumers' pickerLabel fallback.
    let definitionId: string | null = null;
    if (lens.definitionId) {
      const def = await adapter.getDefinition(lens.definitionId);
      definitionId = def.data ? lens.definitionId : null;
    }
    await adapter.createElement({ id: lensId, kind: lens.kind, parentId: parent.id, name: lens.name, definitionId });
    created += 1;
  }
  return created;
}

/**
 * Reconcile lenses onto nodes that already exist — the backfill half of Provision.
 *
 * Provisioning used to be create-time only, so a node minted before a lens kind
 * existed never grew one. That is not hypothetical: `logbook` landed after `jobs`,
 * leaving every node created in between with a Jobs box and no Logbook, and it will
 * recur with the next lens kind.
 *
 * Deleted rows are skipped (a soft-deleted node should not sprout fresh children),
 * and so is everything outside the business tree — a `library` row can be a re-root
 * kind (the `logbook` policy Definition) and must not accrue lenses of its own, the
 * same guard the node index uses.
 *
 * Idempotent and cheap on the common path: `ensureProvisionedLenses` rejects
 * non-container kinds before touching storage, so a steady-state startup reads two
 * ids per plain node and writes nothing.
 */
export async function backfillProvisionedLenses(
  elements: Element[],
  adapter: StorageAdapter,
): Promise<number> {
  let created = 0;
  for (const el of elements) {
    if (el.deletedAt !== null || el.treeType !== 'business') continue;
    created += await ensureProvisionedLenses(adapter, el);
  }
  return created;
}
