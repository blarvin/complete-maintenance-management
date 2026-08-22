/**
 * Lens provisioning — the reconciler behind `ProvisionSpec`.
 *
 * Spec-driven throughout: both functions loop `getProvisionedLenses()` (derived from
 * every kind's `provision` capability, named and bound by the active pack), so a new
 * lens kind joins with no edit here.
 * Each lens id is deterministic (`${parentId}::${suffix}`), which is what makes the
 * whole thing idempotent — reconciling twice, or from two clients at once,
 * converges on one lens rather than minting duplicates.
 *
 * Two entry points for the same reconcile, differing only in when they run:
 *   - `ensureProvisionedLenses` — at create time, from the `CREATE_ELEMENT` handler.
 *   - `backfillProvisionedLenses` — at startup, over what is already stored.
 *
 * A third, `restampUnboundLenses`, repairs the *binding* rather than the container.
 */

import { db } from '../storage/db';
import type { StorageAdapter } from '../storage/storageAdapter';
import type { Element, Kind } from '../models';
import { AUTHOR_ID_APP_DEVELOPER } from '../../constants';
import { now } from '../../utils/time';
import { isDefinitionRow } from '../libraryChrome';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { isProvisionedLens, getProvisionedLenses } from '../../kinds/provisionPolicy';

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
  for (const lens of getProvisionedLenses()) {
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

/**
 * Re-stamp lenses that minted unbound — the binding half of the backfill.
 *
 * `ensureProvisionedLenses` stamps a lens's policy Definition only if it resolves
 * (an unseeded DB must mint with null rather than throw), and both entry points
 * skip a lens that already exists. So a lens minted in that window — a pre-seed
 * create, or the gap `__wipeDefinitions()` opens — kept `definitionId: null`
 * permanently and lived out its life on the `pickerLabel` fallback. Stamp-if-
 * resolvable was degrading permanently where it should degrade transiently.
 *
 * Resolvability is read off the same snapshot rather than re-queried per lens:
 * a policy Definition is a live Definition row, which is precisely what the
 * mint's `getDefinition` check answers.
 *
 * **Writes `db.elements` directly, not through the adapter**, for two reasons.
 * `StorageElementUpdate` deliberately carries no `definitionId` — a binding is
 * fixed at mint for user-facing edits, and this is not a user-facing edit. And
 * the stamp is deterministic per client: every client resolves the same id from
 * the same pack, so enqueueing it would be N identical sync ops for N clients —
 * the same reasoning the bootstrap runner writes under. The remote mirror
 * catches up as each client boots.
 *
 * Startup-only by design: keeping it out of `ensureProvisionedLenses` is what
 * leaves the `CREATE_ELEMENT` path adapter-only.
 */
export async function restampUnboundLenses(elements: Element[]): Promise<number> {
  const policyByKind = new Map<Kind, string>();
  for (const lens of getProvisionedLenses()) {
    if (lens.definitionId) policyByKind.set(lens.kind, lens.definitionId);
  }
  if (policyByKind.size === 0) return 0;

  const resolvable = new Set(
    elements.filter(el => el.deletedAt === null && isDefinitionRow(el)).map(el => el.id),
  );

  const timestamp = now();
  let stamped = 0;
  for (const el of elements) {
    // `treeType` is load-bearing, not defensive: a policy Definition is itself a
    // row of a lens kind (`fd_logbook_policy` is kind `logbook`), so without the
    // business-tree guard it would qualify and be stamped with its own id.
    if (el.treeType !== 'business' || el.deletedAt !== null) continue;
    if (el.definitionId !== null || !isProvisionedLens(el.kind)) continue;
    const definitionId = policyByKind.get(el.kind);
    if (!definitionId || !resolvable.has(definitionId)) continue;
    await db.elements.update(el.id, {
      definitionId,
      updatedBy: AUTHOR_ID_APP_DEVELOPER,
      updatedAt: timestamp,
    });
    stamped += 1;
  }
  return stamped;
}
