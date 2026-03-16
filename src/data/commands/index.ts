import type { StorageAdapter } from '../storage/storageAdapter';
import { CommandBus } from './commandBus';
import { registerAllHandlers } from './handlers';

export type { Command, CommandResultMap, CreateNodeInput } from './types';
export { CommandBus } from './commandBus';

let activeBus: CommandBus | null = null;

export function getCommandBus(): CommandBus {
  if (!activeBus) throw new Error('CommandBus not initialized. Call initializeCommandBus() first.');
  return activeBus;
}

export function initializeCommandBus(adapter: StorageAdapter): CommandBus {
  const bus = new CommandBus();
  registerAllHandlers(bus, adapter);
  activeBus = bus;
  return bus;
}

export function setCommandBus(bus: CommandBus): void {
  activeBus = bus;
}

export function resetCommandBus(): void {
  activeBus = null;
}
