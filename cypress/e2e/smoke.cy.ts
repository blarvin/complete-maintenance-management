/**
 * Smoke test - verifies the app loads and basic UI is present.
 * Quick sanity check for regression prevention.
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
});
