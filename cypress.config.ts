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
        // Seeding is now done in-browser via cy.seedAndVisit() / cy.seedMinimal()
        // No Firestore tasks needed
    },
});
