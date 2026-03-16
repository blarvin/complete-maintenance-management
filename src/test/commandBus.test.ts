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
    bus.register('DELETE_NODE', async (cmd) => {
      received = cmd;
    });

    await bus.execute({ type: 'DELETE_NODE', payload: { id: 'n1' } });
    expect(received).toEqual({ type: 'DELETE_NODE', payload: { id: 'n1' } });
  });

  it('throws for unregistered command type', async () => {
    await expect(
      bus.execute({ type: 'DELETE_NODE', payload: { id: 'n1' } })
    ).rejects.toThrow('No handler registered for command: DELETE_NODE');
  });

  it('returns the handler result', async () => {
    bus.register('CREATE_EMPTY_NODE', async () => {
      return { id: 'n1', nodeName: '', nodeSubtitle: '', parentId: null, updatedBy: 'u', updatedAt: 0, deletedAt: null };
    });

    const result = await bus.execute({ type: 'CREATE_EMPTY_NODE', payload: { id: 'n1', parentId: null } });
    expect(result.id).toBe('n1');
  });

  it('handler receives correct payload', async () => {
    let capturedPayload: any = null;
    bus.register('UPDATE_FIELD_VALUE', async (cmd) => {
      capturedPayload = cmd.payload;
    });

    await bus.execute({ type: 'UPDATE_FIELD_VALUE', payload: { fieldId: 'f1', newValue: 'hello' } });
    expect(capturedPayload).toEqual({ fieldId: 'f1', newValue: 'hello' });
  });
});
