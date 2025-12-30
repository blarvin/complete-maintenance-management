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
                    await mod.seedGoldenTree();
                    return null;
                },
                async clearAllData() {
                    const mod = await import('./cypress/support/seed-data');
                    await mod.clearAllData();
                    return null;
                },
            });
            return config;
        },
    },
});
