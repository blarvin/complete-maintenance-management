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
});

// Override cy.visit to always include emulator param when USE_EMULATOR is true
Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
    if (Cypress.env('USE_EMULATOR')) {
        // Add emulator=true query param
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}emulator=true`;
    }
    return originalFn(url, options);
});
