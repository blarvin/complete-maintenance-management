import type { CommandBus } from './commandBus';
import type { StorageAdapter } from '../storage/storageAdapter';
import { generateId } from '../../utils/id';

export function registerAllHandlers(bus: CommandBus, adapter: StorageAdapter): void {
  bus.register('CREATE_FIELD_DEFINITION', async (cmd) => {
    const { id, kind, label, config } = cmd.payload;
    const result = await adapter.createFieldDefinition({ id, kind, label, config });
    return result.data;
  });

  bus.register('CREATE_ELEMENT', async (cmd) => {
    const { id, kind, parentId, name, subtitle, fieldDefinitionId, value, siblingOrder } = cmd.payload;
    const result = await adapter.createElement({
      id: id ?? generateId(),
      kind,
      parentId,
      name,
      subtitle: subtitle ?? null,
      fieldDefinitionId: fieldDefinitionId ?? null,
      value: value ?? null,
      siblingOrder,
    });
    return result.data;
  });

  bus.register('CREATE_ELEMENT_FROM_DEFINITION', async (cmd) => {
    const { id, parentId, fieldDefinitionId, initialValue, siblingOrder } = cmd.payload;
    const defRes = await adapter.getFieldDefinition(fieldDefinitionId);
    const def = defRes.data;
    if (!def) {
      throw new Error(`FieldDefinition not found: ${fieldDefinitionId}`);
    }
    const result = await adapter.createElement({
      id: id ?? generateId(),
      kind: def.kind,
      parentId,
      name: def.label, // snapshot at creation
      fieldDefinitionId: def.id,
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
