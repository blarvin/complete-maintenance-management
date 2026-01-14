/**
 * Vitest setup file - runs before each test file
 * Configures fake-indexeddb for browser API mocking in Node.js
 */

import 'fake-indexeddb/auto';

// Mock navigator for Node.js environment
if (typeof navigator === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.navigator = {
    onLine: true,
  } as any;
}
