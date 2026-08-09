/**
 * Retry action for the exhausted-retries toast (audit §4.3).
 *
 * Lives in its own module so syncManager.ts can lazy-import it: a static
 * import back into syncManager would create a module cycle (this file
 * imports getSyncManager from there).
 */

import { getSyncManager } from './syncManager';

export const retryFailedSync = async (): Promise<void> => {
  await getSyncManager().retryFailed();
};
