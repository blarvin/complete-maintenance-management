/**
 * Behavior contract — a Field points back at its Definition.
 *
 * The Config band's provenance line (*from Text / Description*) is the
 * affordance: it already names the Kind and the Definition, so it doubles as the
 * way to each rather than the band growing a row. Travel is a **reveal**, not a
 * re-root to the Library — the same transition `internal-link`'s `→` uses — so
 * it lands in the Definitions lens with the Definition's own card on screen.
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
        cy.contains('label', 'Description:').parent()
            .contains('button', 'Config').click();

        // The line names both halves — *from Text / Description* — and both are
        // links (#54/#55). Asserted as one string because the prose is the
        // point: the separators are what make it read as provenance rather than
        // two bare buttons, and they are explicit text expressions in
        // `ConfigSummary` precisely so they survive JSX whitespace trimming.
        cy.contains('from Text / Description').should('be.visible');
        // The Kind half travels too, and nothing else exercises it.
        cy.get('[aria-label="Show the Text kind in the Field Library"]')
            .should('be.visible');

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
