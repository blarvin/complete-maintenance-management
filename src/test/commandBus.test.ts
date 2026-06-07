import { describe, it, expect, beforeEach } from 'vitest';
import { CommandBus } from '../data/commands/commandBus';
import type { Command } from '../data/commands/types';

describe('CommandBus', () => {
  let bus: CommandBus;

  beforeEach(() => {
    bus = new CommandBus();
  });

  it('routes execute() to the registered handler', async () => {
    let received: Command | null = null;
    bus.register('DELETE_ELEMENT', async (cmd) => {
      received = cmd;
    });

    await bus.execute({ type: 'DELETE_ELEMENT', payload: { id: 'e1' } });
    expect(received).toEqual({ type: 'DELETE_ELEMENT', payload: { id: 'e1' } });
  });

  it('throws for unregistered command type', async () => {
    await expect(
      bus.execute({ type: 'DELETE_ELEMENT', payload: { id: 'e1' } })
    ).rejects.toThrow('No handler registered for command: DELETE_ELEMENT');
  });

  it('returns the handler result', async () => {
    bus.register('CREATE_ELEMENT', async () => {
      return {
        id: 'e1',
        kind: 'node' as const,
        name: '',
        subtitle: null,
        value: null,
        parentId: null,
        siblingOrder: 0,
        fieldDefinitionId: null,
        updatedBy: 'u',
        updatedAt: 0,
        deletedAt: null,
      };
    });

    const result = await bus.execute({
      type: 'CREATE_ELEMENT',
      payload: { id: 'e1', kind: 'node', parentId: null, name: '' },
    });
    expect(result.id).toBe('e1');
  });

  it('handler receives correct payload', async () => {
    let capturedPayload: unknown = null;
    bus.register('UPDATE_ELEMENT_VALUE', async (cmd) => {
      capturedPayload = cmd.payload;
    });

    await bus.execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: 'e1', value: 'hello' } });
    expect(capturedPayload).toEqual({ id: 'e1', value: 'hello' });
  });
});
