/**
 * Cypress E2E support file.
 * Runs before each spec file.
 * 
 * With the new seeding pattern, each spec uses cy.seedAndVisit() or cy.seedMinimal()
 * which handles IDB seeding directly. No global Firestore seeding needed.
 */
import './commands';

// Clean browser state before each test (localStorage only - IDB is handled by seeding commands)
beforeEach(() => {
  cy.clearLocalStorage();
});
