import { defineConfig } from 'cypress';

export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:5173',
        supportFile: 'cypress/support/e2e.ts',
        specPattern: 'cypress/e2e/**/*.cy.ts',
        // Mobile-first viewport per SPEC
        viewportWidth: 375,
        viewportHeight: 667,
        video: false,
        screenshotOnRunFailure: true,
        // Environment defaults
        env: {
            USE_EMULATOR: true,
        },
        setupNodeEvents(on, config) {
            // Register tasks for seeding/clearing test data
            // Dynamic import with .ts extension - tsx handles the compilation
            on('task', {
                async seedGoldenTree() {
                    const mod = await import('./cypress/support/seed-data');
                    // Handle both boolean false and string "false"
                    const useEmulator = config.env.USE_EMULATOR !== false && config.env.USE_EMULATOR !== 'false';
                    await mod.seedGoldenTree(useEmulator);
                    return null;
                },
                async clearAllData() {
                    const mod = await import('./cypress/support/seed-data');
                    const useEmulator = config.env.USE_EMULATOR !== false && config.env.USE_EMULATOR !== 'false';
                    await mod.clearAllData(useEmulator);
                    return null;
                },
                async cleanupOrphanedNodes() {
                    const mod = await import('./cypress/support/seed-data');
                    const useEmulator = config.env.USE_EMULATOR !== false && config.env.USE_EMULATOR !== 'false';
                    await mod.cleanupOrphanedNodes(useEmulator);
                    return null;
                },
            });
            return config;
        },
    },
});
