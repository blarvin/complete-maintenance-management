/**
 * Custom Cypress commands for E2E testing.
 * 
 * Uses single-load IDB seeding pattern to eliminate race conditions.
 */
import { seedGoldenTree, seedMinimalTree, clearIDB, GOLDEN_IDS, MINIMAL_IDS } from './seedHelpers';

export { GOLDEN_IDS, MINIMAL_IDS };

/**
 * Seed Golden Tree and visit the app.
 * Sets __CYPRESS_SEED_MODE__ flag so app skips Firestore migration.
 */
Cypress.Commands.add('seedAndVisit', (url = '/') => {
  // First, clear IDB and seed BEFORE visiting
  // This runs in the test context, not the app context
  cy.wrap(null).then(async () => {
    await seedGoldenTree();
  });

  // Now visit with the seed mode flag
  cy.visit(url, {
    onBeforeLoad: (win) => {
      // Flag tells app to skip Firestore migration - IDB already has data
      (win as any).__CYPRESS_SEED_MODE__ = true;
    },
  });

  // Wait for app to be ready (main element exists)
  cy.get('main', { timeout: 10000 }).should('exist');
});

/**
 * Seed Minimal Tree (1 node, 2 fields) and visit the app.
 * Use for creation and layout tests where Golden Tree is overkill.
 */
Cypress.Commands.add('seedMinimal', (url = '/') => {
  cy.wrap(null).then(async () => {
    await seedMinimalTree();
  });

  cy.visit(url, {
    onBeforeLoad: (win) => {
      (win as any).__CYPRESS_SEED_MODE__ = true;
    },
  });

  cy.get('main', { timeout: 10000 }).should('exist');
});

/**
 * Clear IndexedDB databases.
 * Ensures each test starts with fresh local state.
 */
Cypress.Commands.add('clearIndexedDB', () => {
  return cy.wrap(clearIDB());
});

/**
 * Get a TreeNode article element by its node ID.
 * More reliable than text-based selection.
 */
Cypress.Commands.add('getNodeById', (nodeId: string) => {
  return cy.get(`article[data-node-id="${nodeId}"]`);
});

/**
 * Navigate into a node (click to enter BRANCH view).
 */
Cypress.Commands.add('navigateIntoNode', (nodeId: string) => {
  return cy.getNodeById(nodeId).find('[role="button"]').click();
});

/**
 * Expand a node's DataCard.
 */
Cypress.Commands.add('expandDataCard', (nodeId: string) => {
  return cy.getNodeById(nodeId)
    .find('button[aria-label="Expand details"]')
    .click();
});

/**
 * Collapse a node's DataCard.
 */
Cypress.Commands.add('collapseDataCard', (nodeId: string) => {
  return cy.getNodeById(nodeId)
    .find('button[aria-label="Collapse details"]')
    .click();
});

// TypeScript declarations
declare global {
  namespace Cypress {
    interface Chainable {
      seedAndVisit(url?: string): Chainable<void>;
      seedMinimal(url?: string): Chainable<void>;
      clearIndexedDB(): Chainable<void>;
      getNodeById(nodeId: string): Chainable<JQuery<HTMLElement>>;
      navigateIntoNode(nodeId: string): Chainable<JQuery<HTMLElement>>;
      expandDataCard(nodeId: string): Chainable<JQuery<HTMLElement>>;
      collapseDataCard(nodeId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}
