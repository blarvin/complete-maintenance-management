import type { CommandBus } from './commandBus';
import type { StorageAdapter } from '../storage/storageAdapter';
import { generateId } from '../../utils/id';

export function registerAllHandlers(bus: CommandBus, adapter: StorageAdapter): void {
  bus.register('CREATE_NODE_WITH_FIELDS', async (cmd) => {
    const { id, parentId, nodeName, nodeSubtitle, defaults } = cmd.payload;
    await adapter.createNode({ id, parentId, nodeName, nodeSubtitle });
    await Promise.all(
      defaults.map(f => adapter.createField({
        id: generateId(),
        parentNodeId: id,
        fieldName: f.fieldName,
        fieldValue: f.fieldValue,
      }))
    );
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

  bus.register('ADD_FIELD', async (cmd) => {
    const { nodeId, fieldName, fieldValue, cardOrder } = cmd.payload;
    const result = await adapter.createField({
      id: generateId(),
      parentNodeId: nodeId,
      fieldName,
      fieldValue,
      cardOrder,
    });
    return result.data;
  });

  bus.register('UPDATE_FIELD_VALUE', async (cmd) => {
    await adapter.updateFieldValue(cmd.payload.fieldId, { fieldValue: cmd.payload.newValue });
  });

  bus.register('DELETE_FIELD', async (cmd) => {
    await adapter.deleteField(cmd.payload.fieldId);
  });
}
