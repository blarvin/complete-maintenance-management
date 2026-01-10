/**
 * Smoke test - verifies the app loads and data actually persists.
 * These tests verify that persistence works, not just that UI renders.
 */
describe('Smoke Test', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('loads the ROOT view successfully', () => {
        cy.get('main.view-root').should('exist');
    });

    it('displays the seeded HVAC System root node', () => {
        cy.contains('HVAC System').should('be.visible');
        cy.contains('Building A Rooftop Unit').should('be.visible');
    });

    it('shows the "Create New Asset" button', () => {
        cy.get('button')
            .contains('Create New Asset')
            .should('be.visible')
            .and('have.attr', 'aria-label', 'Create New Asset');
    });

    /**
     * CRITICAL TEST: Verifies data actually persists to storage.
     * This would FAIL if persistence was broken (e.g., in-memory only).
     */
    it('persists created node across page reload', () => {
        const testNodeName = `Smoke Test Node ${Date.now()}`;

        // Create a node
        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]')
            .clear()
            .type(testNodeName, { delay: 50 })
            .should('have.value', testNodeName);
        cy.get('input[placeholder="Subtitle / Location / Short description"]')
            .clear()
            .type('Persistence verification', { delay: 50 });
        cy.wait(300);
        cy.get('button').contains('Create').click();

        // Wait for creation to complete
        cy.get('input[placeholder="Name"]').should('not.exist', { timeout: 5000 });
        cy.contains(testNodeName).should('be.visible');

        // RELOAD the page - this is the key test
        cy.reload();

        // Node should still exist (loaded from persistent storage)
        cy.contains(testNodeName, { timeout: 10000 }).should('be.visible');
        cy.contains('Persistence verification').should('be.visible');
    });

    /**
     * CRITICAL TEST: Verifies field edits persist across page reload.
     */
    it('persists field edits across page reload', () => {
        const uniqueValue = `Test Value ${Date.now()}`;

        // Navigate to seeded HVAC node and expand card
        cy.expandDataCard('hvac-system');

        // Edit a field (Status)
        cy.contains('[role="button"]', 'In Service').dblclick();
        cy.focused()
            .should('match', 'input')
            .clear()
            .type(`${uniqueValue}{enter}`);

        // Verify immediate update
        cy.contains(uniqueValue).should('be.visible');

        // RELOAD - verify persistence
        cy.reload();
        cy.expandDataCard('hvac-system');
        cy.contains(uniqueValue, { timeout: 10000 }).should('be.visible');
    });
});
