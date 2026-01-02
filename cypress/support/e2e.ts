/**
 * Cypress E2E support file.
 * Runs before each spec file.
 */
import './commands';

// Seed the Golden Tree before each test file runs
before(() => {
    // Seed test data in emulator
    cy.task('seedGoldenTree');
});

// Clean local state before each individual test
beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearIndexedDB();
    // Clean up orphaned nodes (nodes with empty names from canceled creations)
    cy.task('cleanupOrphanedNodes');
});

// Override cy.visit to always include emulator param when USE_EMULATOR is true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.overwrite('visit', (originalFn: any, url: string, options?: any) => {
    if (Cypress.env('USE_EMULATOR')) {
        // Add emulator=true query param
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}emulator=true`;
    }
    return originalFn(url, options);
});
