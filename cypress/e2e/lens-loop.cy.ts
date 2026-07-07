/**
 * Behavior contract #2 — the lens loop:
 * provisioned lens containers arrive with a new node; in-lens creation mints
 * an entry under the OWNER; the rollup re-gathers (count + navigable row +
 * policy entry label); the row name re-roots; Up returns to the owner.
 */

describe('lens loop', () => {
    it('creates a logbook entry in-lens and sees it rolled up', () => {
        const name = `Truck ${Date.now()}`;

        cy.freshVisit({ offline: true });
        cy.createNode(name);

        cy.get(`[aria-label="Open ${name}"]`).click();

        // Both provisioned lens containers arrive with the node.
        cy.contains('article', 'Jobs').should('be.visible');
        cy.contains('article', 'Logbook').should('be.visible');

        // Expand the Logbook card: the bound policy Definition supplies the
        // "Entry" label; the rollup starts empty.
        cy.expandCard('Logbook');
        cy.contains('Entry (0)').should('be.visible');
        // `exist`, not `be.visible`: the animated DataCard wrapper trips
        // Cypress's visibility calculation for this div even when rendered.
        cy.contains('none yet').should('exist');

        // In-lens creation: name-only input, Enter commits to the owner.
        cy.contains('button', `Create New Entry on ${name}`).click();
        cy.get('input[aria-label="New Entry name"]').type('Oil change{enter}');

        // The rollup re-gathers: count 1, the entry as a navigable row, and a
        // fresh entry is not stale.
        cy.contains('Entry (1)').should('be.visible');
        cy.contains('[role="button"]', 'Oil change').should('be.visible');
        cy.contains('stale').should('not.exist');

        // The row name re-roots into the entry; Up returns to the owner, whose
        // Logbook card is still expanded (uiPrefs persistence).
        cy.contains('[role="button"]', 'Oil change').click();
        cy.contains('article', 'Oil change')
            .find('[aria-label="Go to parent"]').should('exist').click();
        cy.contains('article', name).should('be.visible');
        cy.contains('Entry (1)').should('be.visible');
    });
});
