import type { CommandBus } from './commandBus';
import type { StorageAdapter } from '../storage/storageAdapter';
import { generateId } from '../../utils/id';

export function registerAllHandlers(bus: CommandBus, adapter: StorageAdapter): void {
  bus.register('CREATE_NODE_WITH_FIELDS', async (cmd) => {
    const { id, parentId, nodeName, nodeSubtitle, defaults } = cmd.payload;
    await adapter.createNode({ id, parentId, nodeName, nodeSubtitle });
    // Sequential with explicit cardOrder by index: defaults arrive in user-intended order.
    for (let i = 0; i < defaults.length; i++) {
      const d = defaults[i];
      await adapter.createField({
        id: generateId(),
        parentNodeId: id,
        templateId: d.templateId,
        cardOrder: i,
      });
    }
  });

  bus.register('CREATE_EMPTY_NODE', async (cmd) => {
    const result = await adapter.createNode({
      id: cmd.payload.id,
      parentId: cmd.payload.parentId,
      nodeName: '',
      nodeSubtitle: '',
    });
    return result.data;
  });

  bus.register('UPDATE_NODE', async (cmd) => {
    await adapter.updateNode(cmd.payload.id, cmd.payload.updates);
  });

  bus.register('DELETE_NODE', async (cmd) => {
    await adapter.deleteNode(cmd.payload.id);
  });

  bus.register('ADD_FIELD_FROM_TEMPLATE', async (cmd) => {
    const { nodeId, templateId, cardOrder } = cmd.payload;
    const result = await adapter.createField({
      id: generateId(),
      parentNodeId: nodeId,
      templateId,
      cardOrder,
    });
    return result.data;
  });

  bus.register('UPDATE_FIELD_VALUE', async (cmd) => {
    await adapter.updateFieldValue(cmd.payload.fieldId, { value: cmd.payload.newValue });
  });

  bus.register('DELETE_FIELD', async (cmd) => {
    await adapter.deleteField(cmd.payload.fieldId);
  });

  bus.register('RESTORE_FIELD', async (cmd) => {
    await adapter.restoreField(cmd.payload.fieldId);
  });

  bus.register('RESTORE_NODE', async (cmd) => {
    await adapter.restoreNode(cmd.payload.id);
  });
}
