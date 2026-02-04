import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Run tests sequentially to avoid Firestore conflicts
        fileParallelism: false,
        // Increase timeout for real DB operations
        testTimeout: 15000,
        // Global setup/teardown
        globalSetup: './src/test/globalSetup.ts',
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
