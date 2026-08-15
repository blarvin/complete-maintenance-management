/**
 * Behavior contract — the Add Surface (SPEC → The Add Surface).
 *
 * The first coverage this surface has ever had (ISSUES → Tech Debt): everything
 * before it was hand-tested only, and `core-loop.cy.ts` runs on construction
 * defaults so it never touches an add affordance at all.
 *
 * Click-path only. The keyboard model is deliberately out of scope for this
 * pass, here as in the surface itself.
 *
 * Selectors are aria-labels and visible text only, per the support contract.
 * Everything is `:visible`-scoped because a re-rooted node shows three add
 * surfaces, not one: the two provisioned lens cards (Jobs, Logbook) admit field
 * kinds too, so each carries its own — collapsed, but in the DOM.
 */

const EXPAND = '[aria-label="Expand the new field row"]:visible';
const COLLAPSE = '[aria-label="Collapse the new field row"]:visible';
const NAME = 'input[aria-label="New field name"]:visible';

/** Click a visible button by its exact label. */
const clickButton = (label: string | RegExp) =>
    cy.get('button:visible').contains(label).click();

describe('the Add Surface', () => {
    const name = `Pump ${Date.now()}`;

    beforeEach(() => {
        cy.freshVisit({ offline: true });
        cy.createNode(name);
        // Re-root into the node so its card is the one under test.
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.expandCard(name);
        cy.contains('label', 'Description:').should('be.visible');
    });

    it('authors a Definition and mints its field in one motion', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Serial Number');
        clickButton(/^Create$/);

        cy.contains('[role="status"]', 'Field added').should('be.visible');
        // The shortest complete path: a name, then Create, lands an unfilled
        // text field at the bottom of the card.
        cy.contains('label', 'Serial Number:').should('be.visible');
        cy.contains('label', 'Serial Number:').parent().contains('Empty').should('be.visible');

        // ...and the Definition it coined is in the Library, under its kind.
        cy.get(EXPAND).first().click();
        cy.get('[aria-label="Show Text definitions"]:visible').first().click();
        cy.get('button:visible').contains(/^Serial Number$/).should('be.visible');
    });

    it('picks an existing Definition from the Kind band', () => {
        cy.get(EXPAND).first().click();
        clickButton(/^Number$/);
        cy.get('[aria-label="Show Number definitions"]:visible').first().click();
        // `Weight` is a seeded number-kv Definition.
        clickButton(/^Weight$/);

        // Picking loads the Definition into the row: the name fills from it.
        cy.get(NAME).first().should('have.value', 'Weight');
        clickButton(/^Create$/);

        cy.contains('[role="status"]', 'Field added').should('be.visible');
        cy.contains('label', 'Weight:').should('be.visible');
    });

    it('keeps the draft across a collapse', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Half Written');

        cy.get(COLLAPSE).first().click();
        // A collapsed row still shows what has been entered so far.
        cy.get(NAME).first().should('have.value', 'Half Written');

        cy.get(EXPAND).first().click();
        cy.get(NAME).first().should('have.value', 'Half Written');
    });
});
