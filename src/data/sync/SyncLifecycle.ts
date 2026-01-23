/**
 * SyncLifecycle - Timer and event management for sync.
 *
 * Handles:
 * - Periodic sync timer
 * - Online event listener
 * - Start/stop lifecycle
 */

export class SyncLifecycle {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private onTick: () => Promise<void>,
    private pollIntervalMs: number = 600000 // 10 minutes default
  ) {}

  /**
   * Start the lifecycle.
   * Sets up periodic timer and online event listener.
   */
  start(): void {
    if (this.intervalId) return; // Already running

    // Start periodic timer
    this.intervalId = setInterval(() => {
      this.onTick().catch(err => {
        console.error('[SyncLifecycle] Periodic tick failed:', err);
      });
    }, this.pollIntervalMs);

    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }

    console.log('[SyncLifecycle] Started with poll interval:', this.pollIntervalMs, 'ms');
  }

  /**
   * Stop the lifecycle.
   * Clears the timer and removes event listeners.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }

    console.log('[SyncLifecycle] Stopped');
  }

  /**
   * Check if the lifecycle is currently running.
   */
  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  private handleOnline = (): void => {
    console.log('[SyncLifecycle] Network online - triggering tick');
    this.onTick().catch(err => {
      console.error('[SyncLifecycle] Online tick failed:', err);
    });
  };
}
