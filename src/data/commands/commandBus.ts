import type { Command, CommandResultMap } from './types';

export type CommandHandler<T extends Command['type']> =
  (cmd: Extract<Command, { type: T }>) => Promise<CommandResultMap[T]>;

export class CommandBus {
  /**
   * Stored type-erased. The map is heterogeneous — one entry per command type,
   * each with its own cmd/result pair — so no single parameterization is
   * assignable for every handler: parameters are contravariant and results
   * covariant, and the two pull opposite ways. `unknown` rather than `any`
   * keeps the erasure honest; `register` is the typed gate on the way in, and
   * `execute` restores the type on the way out via the one cast below.
   */
  private handlers = new Map<string, unknown>();

  register<T extends Command['type']>(type: T, handler: CommandHandler<T>): void {
    this.handlers.set(type, handler);
  }

  async execute<T extends Command['type']>(
    cmd: Extract<Command, { type: T }>
  ): Promise<CommandResultMap[T]> {
    const handler = this.handlers.get(cmd.type) as CommandHandler<T> | undefined;
    if (!handler) throw new Error(`No handler registered for command: ${cmd.type}`);
    return handler(cmd);
  }
}
