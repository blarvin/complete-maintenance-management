import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Run tests sequentially to avoid Firestore conflicts
        fileParallelism: false,
        // Increase timeout for real DB operations
        testTimeout: 15000,
        // No globalSetup. It used to run `cleanupAllTestFixtures()`, which
        // imports the real Firestore `db`; in Node the emulator connect in
        // firebase.ts is gated on `isBrowser`, so that pointed at PRODUCTION —
        // every `npm run test` read all three collections and batch-deleted any
        // `TEST_`-prefixed doc. It also opened a gRPC/HTTP2 session the SDK
        // never closes, which is what hung the runner after a green suite
        // (ISSUES Tech Debt #1). Nothing mints `TEST_` fixtures any more — the
        // Element refactor replaced the live-Firestore suite with mocks — so the
        // cleanup had nothing to clean. `npm run test:cleanup` still runs it
        // deliberately if a stray fixture ever needs sweeping.
        // Setup file for fake-indexeddb
        setupFiles: ['./src/test/setup.ts'],
        // Include test files
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        // Environment
        environment: 'node',
    },
    resolve: {
        alias: {
            '~': '/src',
        },
    },
});
