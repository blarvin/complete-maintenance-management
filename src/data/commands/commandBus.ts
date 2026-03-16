import type { Command, CommandResultMap } from './types';

export type CommandHandler<T extends Command['type']> =
  (cmd: Extract<Command, { type: T }>) => Promise<CommandResultMap[T]>;

export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();

  register<T extends Command['type']>(type: T, handler: CommandHandler<T>): void {
    this.handlers.set(type, handler);
  }

  async execute<T extends Command['type']>(
    cmd: Extract<Command, { type: T }>
  ): Promise<CommandResultMap[T]> {
    const handler = this.handlers.get(cmd.type);
    if (!handler) throw new Error(`No handler registered for command: ${cmd.type}`);
    return handler(cmd);
  }
}
