/**
 * Retry action for the exhausted-retries toast (audit §4.3).
 *
 * Lives in its own module so syncManager.ts can wrap it with the runtime
 * `qrl()` API via a lazy import. A module-level `$()` is not an option:
 * Vitest runs without the Qwik optimizer, so any test importing syncManager
 * would crash at module init ("Optimizer should replace all usages of $()").
 */

import { getSyncManager } from './syncManager';

export const retryFailedSync = async (): Promise<void> => {
  await getSyncManager().retryFailed();
};
