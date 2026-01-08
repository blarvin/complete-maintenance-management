/**
 * Cypress E2E support file.
 * Runs before each spec file.
 */
import './commands';

// Seed the Golden Tree before each test file runs
before(() => {
    // Seed data for both emulator and production (tests require seeded data)
    // Note: This will modify production Firestore if USE_EMULATOR=false
    cy.task('seedGoldenTree');
});

// Clean local state before each individual test
beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearIndexedDB();
    
    // Explicitly set emulator flag based on environment
    // Handle both boolean true and string "true" (Cypress may pass as string)
    const useEmulator = Cypress.env('USE_EMULATOR') === true || Cypress.env('USE_EMULATOR') === 'true';
    if (useEmulator) {
        cy.window().then((win) => {
            win.localStorage.setItem('USE_FIRESTORE_EMULATOR', 'true');
        });
    } else {
        cy.window().then((win) => {
            win.localStorage.removeItem('USE_FIRESTORE_EMULATOR');
        });
    }
    
    // Clean up orphaned nodes (runs for both emulator and production)
    cy.task('cleanupOrphanedNodes');
});

// Override cy.visit to always include emulator param when USE_EMULATOR is true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Cypress.Commands.overwrite('visit', (originalFn: any, url: string, options?: any) => {
    // Handle both boolean true and string "true"
    const useEmulator = Cypress.env('USE_EMULATOR') === true || Cypress.env('USE_EMULATOR') === 'true';
    if (useEmulator) {
        // Add emulator=true query param
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}emulator=true`;
    }
    return originalFn(url, options);
});
