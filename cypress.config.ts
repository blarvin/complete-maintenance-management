import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: '5v76sx',
    e2e: {
        baseUrl: 'http://localhost:5173',
        supportFile: 'cypress/support/e2e.ts',
        specPattern: 'cypress/e2e/**/*.cy.ts',
        // Mobile-first viewport per SPEC
        viewportWidth: 375,
        viewportHeight: 667,
        video: false,
        screenshotOnRunFailure: true,
        // Seeding is done in-browser by the commands in cypress/support/e2e.ts —
        // clearEmulator, freshVisit, createNode, expandCard. No Firestore tasks needed.
    },
});
