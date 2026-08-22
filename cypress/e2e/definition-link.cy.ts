/**
 * Behavior contract — a Field points back at its Definition.
 *
 * The Config band's provenance line (*from Description*) is the affordance: it
 * already names the Definition, so it doubles as the way there rather than the
 * band growing a row. Travel is a **reveal**, not a re-root to the Library — the
 * same transition `internal-link`'s `→` uses — so it lands in the Definitions
 * lens with the Definition's own card on screen.
 *
 * Runs offline; selectors are aria-labels and visible text only.
 */

describe('a Field points back at its Definition', () => {
    it('travels from the Config band to the Definition in the Library lens', () => {
        const name = `Pump ${Date.now()}`;

        cy.freshVisit({ offline: true });
        cy.createNode(name);
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.expandCard(name);

        // Description is a construction default, minted from the seeded
        // `fd_description` Definition — so the band has a real provenance.
        cy.contains('label', 'Description:').parent()
            .find('[aria-label="Expand field details"]').click();
        cy.contains('button', 'Config').click();
        cy.contains('from Description').should('be.visible');

        cy.get('[aria-label="Show Description in the Field Library"]').click();

        // Landed in the Definitions lens — the Library's index, not the Library
        // root — with the Definition that was pointed at drawn as its own card.
        // (The card, not the breadcrumb: at 375px the breadcrumb trail collapses
        // and its label is in the DOM but not visible.)
        cy.contains('article', 'Field Definitions').should('be.visible');
        cy.contains('article', 'fd_description').should('be.visible');

        // A reveal, not a re-root to the Definition: the lens is the branch, and
        // Up from it leads back out of the Library.
        cy.contains('article', 'Field Definitions')
            .find('[aria-label="Go to parent"]').should('exist');
    });
});
