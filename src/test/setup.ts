/**
 * Vitest setup file - runs before each test file
 * Configures fake-indexeddb for browser API mocking in Node.js
 */

import 'fake-indexeddb/auto';

// Mock navigator for Node.js environment. Only `onLine` is read (the sync
// layer's online checks), so the cast is through `unknown` rather than
// pretending to implement Navigator.
if (typeof navigator === 'undefined') {
  global.navigator = { onLine: true } as unknown as Navigator;
}
