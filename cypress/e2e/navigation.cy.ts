/**
 * Navigation tests - ROOT ↔ BRANCH flow using the Golden Tree.
 * 
 * Golden Tree structure:
 * HVAC System (root)
 * ├── Compressor Unit
 * │   ├── Motor Assembly
 * │   └── Refrigerant Lines
 * ├── Air Handler
 * │   └── Blower Motor
 * └── Ductwork
 */
import { GOLDEN_IDS } from '../support/commands';

describe('Navigation', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('starts on ROOT view showing HVAC System', () => {
        cy.get('main.view-root').should('exist');
        cy.get('main.view-branch').should('not.exist');
        cy.contains('HVAC System').should('be.visible');
    });

    describe('navigating into nodes', () => {
        it('navigates from ROOT to BRANCH when clicking HVAC System', () => {
            cy.navigateIntoNode(GOLDEN_IDS.root);

            // Should now be in BRANCH view
            cy.get('main.view-branch').should('exist');
            cy.get('main.view-root').should('not.exist');

            // Parent node shows HVAC System
            cy.get('.branch-parent-node').contains('HVAC System');

            // Children are visible
            cy.contains('Compressor Unit').should('be.visible');
            cy.contains('Air Handler').should('be.visible');
            cy.contains('Ductwork').should('be.visible');
        });

        it('navigates deeper into Compressor Unit showing grandchildren', () => {
            // Navigate: ROOT → HVAC System → Compressor Unit
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');
            
            cy.navigateIntoNode(GOLDEN_IDS.compressor);

            // Compressor Unit is now the parent
            cy.get('.branch-parent-node').contains('Compressor Unit');
            cy.get('.branch-parent-node').contains('Carrier 38AKS016');

            // Grandchildren are visible
            cy.contains('Motor Assembly').should('be.visible');
            cy.contains('Refrigerant Lines').should('be.visible');
        });
    });

    describe('navigating up', () => {
        it('navigates back to ROOT view via Up button', () => {
            // Navigate into HVAC System
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');

            // Click Up button (should go to ROOT since HVAC has no parent)
            cy.get('button[aria-label="Go to root"]').click();

            // Should be back on ROOT view
            cy.get('main.view-root').should('exist');
            cy.contains('HVAC System').should('be.visible');
        });

        it('navigates up one level from deep navigation', () => {
            // Navigate: ROOT → HVAC System → Compressor Unit
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.navigateIntoNode(GOLDEN_IDS.compressor);
            cy.get('.branch-parent-node').contains('Compressor Unit');

            // Navigate up to HVAC System
            cy.get('button[aria-label="Go to parent"]').click();

            // Now HVAC System is the parent
            cy.get('.branch-parent-node').contains('HVAC System');
            cy.contains('Compressor Unit').should('be.visible');
        });

        it('completes full round-trip navigation', () => {
            // ROOT → HVAC → Compressor → Motor Assembly
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.navigateIntoNode(GOLDEN_IDS.compressor);
            cy.navigateIntoNode(GOLDEN_IDS.motorAssembly);
            cy.get('.branch-parent-node').contains('Motor Assembly');

            // Navigate all the way back to ROOT
            cy.get('button[aria-label="Go to parent"]').click();
            cy.get('.branch-parent-node').contains('Compressor Unit');

            cy.get('button[aria-label="Go to parent"]').click();
            cy.get('.branch-parent-node').contains('HVAC System');

            cy.get('button[aria-label="Go to root"]').click();
            cy.get('main.view-root').should('exist');
        });
    });
});
