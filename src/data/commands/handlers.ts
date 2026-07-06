import type { CommandBus } from './commandBus';
import type { StorageAdapter } from '../storage/storageAdapter';
import type { Element } from '../models';
import { generateId } from '../../utils/id';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { isProvisionedLens, PROVISIONED_LENSES } from '../../kinds/provisionPolicy';

/**
 * Provision each declared lens child on a container re-root node (code-work-map
 * §6b/§6c). Spec-driven: loops `PROVISIONED_LENSES` (derived from every kind's
 * `provision` capability), so a new lens kind (e.g. `logbook`) joins here with no
 * edit. Each lens id is deterministic (`${parentId}::${suffix}`, e.g. `${id}::jobs`,
 * `${id}::logbook`), making re-provisioning idempotent (a no-op).
 *
 * Skipped for the lens kinds themselves (no lens-on-lens) and for lens-surfaced
 * kinds (a `job`/`log-entry` is itself rolled up by a lens, so it must not nest its
 * own containers). Each lens gathers its owning node's target-kind descendants at
 * view time — no upward ancestor walk, and de-provision/GC when the last entry is
 * removed is deferred (LATER.md).
 *
 * Created via the adapter directly (not the command bus), so it does not re-enter
 * CREATE_ELEMENT.
 */
async function ensureProvisionedLenses(adapter: StorageAdapter, parent: Element): Promise<void> {
  if (!isReRoot(parent.kind) || isProvisionedLens(parent.kind) || isLensSurfaced(parent.kind)) return;
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
  }
}

export function registerAllHandlers(bus: CommandBus, adapter: StorageAdapter): void {
  bus.register('CREATE_DEFINITION', async (cmd) => {
    const { id, kind, label, config } = cmd.payload;
    const result = await adapter.createDefinition({ id, kind, label, config });
    return result.data;
  });

  bus.register('CREATE_ELEMENT', async (cmd) => {
    const { id, kind, parentId, name, subtitle, definitionId, value, siblingOrder } = cmd.payload;
    const result = await adapter.createElement({
      id: id ?? generateId(),
      kind,
      parentId,
      name,
      subtitle: subtitle ?? null,
      definitionId: definitionId ?? null,
      value: value ?? null,
      siblingOrder,
    });
    await ensureProvisionedLenses(adapter, result.data);
    return result.data;
  });

  bus.register('CREATE_ELEMENT_FROM_DEFINITION', async (cmd) => {
    const { id, parentId, definitionId, initialValue, siblingOrder } = cmd.payload;
    const defRes = await adapter.getDefinition(definitionId);
    const def = defRes.data;
    if (!def) {
      throw new Error(`Definition not found: ${definitionId}`);
    }
    const result = await adapter.createElement({
      id: id ?? generateId(),
      kind: def.kind,
      parentId,
      name: def.label, // snapshot at creation
      definitionId: def.id,
      value: initialValue ?? null,
      siblingOrder,
    });
    return result.data;
  });

  bus.register('UPDATE_ELEMENT_NAME', async (cmd) => {
    await adapter.updateElement(cmd.payload.id, { name: cmd.payload.name });
  });

  bus.register('UPDATE_ELEMENT_SUBTITLE', async (cmd) => {
    await adapter.updateElement(cmd.payload.id, { subtitle: cmd.payload.subtitle });
  });

  bus.register('UPDATE_ELEMENT_VALUE', async (cmd) => {
    await adapter.updateElement(cmd.payload.id, { value: cmd.payload.value });
  });

  bus.register('MOVE_ELEMENT', async (cmd) => {
    const updates: { parentId?: string | null; siblingOrder?: number } = {};
    if ('parentId' in cmd.payload) updates.parentId = cmd.payload.parentId ?? null;
    if ('siblingOrder' in cmd.payload && cmd.payload.siblingOrder !== undefined) {
      updates.siblingOrder = cmd.payload.siblingOrder;
    }
    await adapter.updateElement(cmd.payload.id, updates);
  });

  bus.register('DELETE_ELEMENT', async (cmd) => {
    await adapter.softDeleteElement(cmd.payload.id);
  });

  bus.register('RESTORE_ELEMENT', async (cmd) => {
    await adapter.restoreElement(cmd.payload.id);
  });
}
