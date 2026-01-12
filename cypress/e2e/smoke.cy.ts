/**
 * Smoke Tests - Persistence Verification
 * 
 * These tests verify that data ACTUALLY persists across page reloads.
 * This is the critical functionality that Vitest cannot test (no real browser storage).
 * 
 * Tests:
 * 1. Created nodes persist across reload
 * 2. Field edits persist across reload
 */
import { GOLDEN_IDS } from '../support/commands';

describe('Smoke Tests - Persistence', () => {
  /**
   * CRITICAL TEST: Verifies node creation persists to IDB.
   * This would FAIL if persistence was broken (e.g., in-memory only).
   */
  it('persists created node across page reload', () => {
    // Start with minimal tree (just one root node)
    cy.seedMinimal();

    const testNodeName = `Smoke Test Node ${Date.now()}`;

    // Create a new root node
    cy.get('button').contains('Create New Asset').click();

    // Fill in the name - input starts empty, no clear needed
    // Use focused() since Qwik autofocuses the name input on mount
    cy.focused()
      .should('have.attr', 'placeholder', 'Name')
      .type(testNodeName, { delay: 10 })
      .should('have.value', testNodeName);

    // Fill in subtitle - higher delay for Qwik reactivity
    cy.get('input[placeholder="Subtitle / Location / Short description"]')
      .focus()
      .should('be.focused')
      .type('Persistence verification', { delay: 50 })
      .should('have.value', 'Persistence verification')
      .blur(); // Blur to ensure Qwik processes the input before we click Create

    // Submit
    cy.get('button').contains('Create').should('be.visible').click();

    // Wait for creation to complete (input disappears)
    cy.get('input[placeholder="Name"]').should('not.exist', { timeout: 5000 });

    // RELOAD the page - this is the critical test for PERSISTENCE
    // Skip immediate UI verification - Cypress synthetic events + Qwik reactivity = flaky
    // The reload will fetch fresh data from IDB, which is what we're really testing
    cy.reload();

    // Wait for app to be ready after reload
    cy.get('main', { timeout: 10000 }).should('exist');

    // App reloads, IDB already has data so no Firestore migration
    // Our created node should still be there
    cy.contains(testNodeName, { timeout: 10000 }).should('be.visible');
    cy.contains('Persistence verification').should('be.visible');
  });

  /**
   * CRITICAL TEST: Verifies field edits persist to IDB.
   * Tests the edit → save → reload cycle.
   */
  it('persists field edits across page reload', () => {
    // Start with golden tree (has editable fields)
    cy.seedAndVisit();

    const uniqueValue = `Edited Value ${Date.now()}`;

    // Expand the HVAC System DataCard
    cy.expandDataCard(GOLDEN_IDS.root);

    // Find and double-click the Status field to edit it
    cy.contains('[role="button"]', 'In Service').dblclick();

    // Wait for input to appear and be focused, then edit
    cy.focused()
      .should('match', 'input')
      .clear()
      .type(`${uniqueValue}{enter}`);

    // Verify immediate update in UI
    cy.contains(uniqueValue).should('be.visible');

    // RELOAD - verify persistence
    cy.reload();

    // Wait for app to be ready after reload
    cy.get('main', { timeout: 10000 }).should('exist');

    // Re-expand the DataCard (UI state doesn't persist, but data does)
    cy.expandDataCard(GOLDEN_IDS.root);

    // Edited value should still be there
    cy.contains(uniqueValue, { timeout: 10000 }).should('be.visible');
  });
});
