import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Run tests sequentially to avoid Firestore conflicts
        fileParallelism: false,
        // Increase timeout for real DB operations
        testTimeout: 15000,
        // Global setup/teardown
        globalSetup: './src/test/globalSetup.ts',
        // Include test files
        include: ['src/**/*.test.ts'],
        // Environment
        environment: 'node',
    },
    resolve: {
        alias: {
            '~': '/src',
        },
    },
});
