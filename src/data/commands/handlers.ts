import type { CommandBus } from './commandBus';
import type { StorageAdapter } from '../storage/storageAdapter';
import { generateId } from '../../utils/id';
import { ensureProvisionedLenses } from '../services/provisionLenses';

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
    // The Definition's `default` config sub-field is what a new instance starts
    // with (ELEMENT-MODEL → enum-kv: *Pre-selected on new instance*). Read
    // kind-agnostically: only `enum-kv` declares one today, and a kind that adds
    // the key later means the same thing by it.
    //
    // An explicit `initialValue` wins — the create surface's value slot is the
    // more specific statement, made about this instance rather than about every
    // instance of the Definition.
    const standingDefault = (def.config as Record<string, unknown> | undefined)?.default;
    const result = await adapter.createElement({
      id: id ?? generateId(),
      kind: def.kind,
      parentId,
      name: def.label, // snapshot at creation
      definitionId: def.id,
      value: initialValue ?? (standingDefault as typeof initialValue) ?? null,
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
