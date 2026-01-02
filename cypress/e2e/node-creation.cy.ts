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
            // Verify HVAC System exists (from seed data)
            cy.contains('HVAC System').should('be.visible');
            
            // Get initial count of root nodes (may be more than 1 if previous tests created nodes)
            cy.get('main.view-root').find('article[data-node-id]').then(($nodes) => {
                const initialCount = $nodes.length;
                
                cy.get('button').contains('Create New Asset').click();
                
                // Type and verify the values are set (wait for Qwik signals to update)
                cy.get('input[placeholder="Name"]')
                    .clear()
                    .type('Electrical System', { delay: 50 })
                    .should('have.value', 'Electrical System');
                
                cy.get('input[placeholder="Subtitle / Location / Short description"]')
                    .clear()
                    .type('Main switchgear', { delay: 50 })
                    .should('have.value', 'Main switchgear');
                
                // Wait to ensure Qwik has processed all input events and updated signals
                cy.wait(300);
                
                // Double-check the values are still in the inputs before clicking Create
                cy.get('input[placeholder="Name"]').should('have.value', 'Electrical System');
                cy.get('input[placeholder="Subtitle / Location / Short description"]').should('have.value', 'Main switchgear');
                
                cy.get('button').contains('Create').click();

                // Wait for construction to complete (form disappears, Create button reappears)
                cy.get('input[placeholder="Name"]').should('not.exist', { timeout: 5000 });
                cy.get('button').contains('Create New Asset').should('be.visible', { timeout: 5000 });
                
                // Wait for the node count to increase (indicates nodes list has reloaded)
                cy.get('main.view-root')
                    .find('article[data-node-id]')
                    .should('have.length.at.least', initialCount + 1, { timeout: 10000 });
            });
            
            // Now verify the specific node text exists in one of the articles
            cy.get('main.view-root')
                .find('article[data-node-id]')
                .then(($articles) => {
                    // Check that at least one article contains "Electrical System"
                    const hasElectricalSystem = Array.from($articles).some(article => 
                        article.textContent?.includes('Electrical System')
                    );
                    expect(hasElectricalSystem).to.be.true;
                });
            
            // Verify subtitle
            cy.get('main.view-root').contains('Main switchgear').should('be.visible');
            
            // Verify HVAC System is still there
            cy.contains('HVAC System').should('be.visible');
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
