/**
 * Node creation tests - root and child nodes.
 * Tests creation flow on top of the Golden Tree.
 */
import { GOLDEN_IDS } from '../support/commands';

describe('Node Creation', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    describe('root node creation', () => {
        it('shows under-construction UI when clicking Create', () => {
            cy.get('button').contains('Create New Asset').click();

            // Should show name and subtitle inputs
            cy.get('input[placeholder="Name"]').should('be.visible');
            cy.get('input[placeholder="Subtitle / Location / Short description"]').should('be.visible');

            // Should show Create and Cancel buttons
            cy.get('button').contains('Create').should('be.visible');
            cy.get('button').contains('Cancel').should('be.visible');
        });

        it('creates a new root node', () => {
            cy.get('button').contains('Create New Asset').click();
            cy.get('input[placeholder="Name"]').type('Electrical System');
            cy.get('input[placeholder="Subtitle / Location / Short description"]').type('Main switchgear');
            cy.get('button').contains('Create').click();

            // New node should appear alongside HVAC System
            cy.contains('Electrical System').should('be.visible');
            cy.contains('Main switchgear').should('be.visible');
            cy.contains('HVAC System').should('be.visible'); // Golden tree still there
        });

        it('cancels creation without creating a node', () => {
            cy.get('button').contains('Create New Asset').click();
            cy.get('input[placeholder="Name"]').type('Should Not Exist');
            cy.get('button').contains('Cancel').click();

            cy.contains('Should Not Exist').should('not.exist');
            cy.get('button').contains('Create New Asset').should('be.visible');
        });
    });

    describe('child node creation', () => {
        beforeEach(() => {
            // Navigate into HVAC System
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');
        });

        it('shows Add Sub-Asset button in BRANCH view', () => {
            cy.get('button').contains('Add Sub-Asset').should('be.visible');
        });

        it('creates a child node under HVAC System', () => {
            cy.get('button').contains('Add Sub-Asset').click();
            cy.get('input[placeholder="Name"]').type('Thermostat');
            cy.get('input[placeholder="Subtitle / Location / Short description"]').type('Lobby zone controller');
            cy.get('button').contains('Create').click();

            // Child should appear alongside existing children
            cy.contains('Thermostat').should('be.visible');
            cy.contains('Compressor Unit').should('be.visible'); // Existing child
        });

        it('new child node is navigable', () => {
            cy.get('button').contains('Add Sub-Asset').click();
            cy.get('input[placeholder="Name"]').type('Controls Panel');
            cy.get('button').contains('Create').click();
            cy.contains('Controls Panel').should('be.visible');

            // Navigate into new child
            cy.contains('Controls Panel').closest('article').find('[role="button"]').click();

            // Now Controls Panel is the parent
            cy.get('.branch-parent-node').contains('Controls Panel');
        });
    });
});
