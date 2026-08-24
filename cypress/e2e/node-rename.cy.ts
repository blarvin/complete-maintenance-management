/**
 * Behavior contract — renaming a node in place.
 *
 * Double-tap the title, exactly as a DataField value works: the accidental-brush
 * guard is the point, because a node header already carries gestures.
 *
 * It is offered on the **PARENT** card only — the node you are already inside.
 * On a child card the header *is* the navigation target, so the first tap of a
 * double-tap re-roots before the second arrives; there is no gesture left there.
 * The last case pins that, from both sides.
 *
 * This is also the first production caller of `UPDATE_ELEMENT_NAME`.
 *
 * Runs offline; selectors are aria-labels and visible text only.
 */

const TITLE_INPUT = 'input[aria-label="Rename node"]';
const SUBTITLE_INPUT = 'input[aria-label="Edit node subtitle"]';

describe('renaming a node in place', () => {
    const name = `Pump ${Date.now()}`;

    beforeEach(() => {
        cy.freshVisit({ offline: true });
        cy.createNode(name, 'workshop');
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.contains('article', name).find('[aria-label="Go to root"]').should('exist');
    });

    it('renames the title, and Undo puts the old name back', () => {
        cy.contains('article', name).find('h2').dblclick();
        cy.get(TITLE_INPUT).should('be.focused').clear().type('Renamed Pump{enter}');

        cy.contains('[role="status"]', 'Node renamed').should('be.visible');
        cy.contains('article', 'Renamed Pump').should('be.visible');
        cy.get(TITLE_INPUT).should('not.exist');

        cy.get('[role="status"]').contains('button', 'Undo').click();
        cy.contains('article', name).should('be.visible');
    });

    it('edits the subtitle the same way', () => {
        cy.contains('article', name).contains('div', 'workshop').dblclick();
        cy.get(SUBTITLE_INPUT).should('be.focused').clear().type('yard{enter}');

        cy.contains('[role="status"]', 'Subtitle updated').should('be.visible');
        cy.contains('article', name).contains('yard').should('be.visible');
    });

    it('Escape cancels without writing', () => {
        cy.contains('article', name).find('h2').dblclick();
        cy.get(TITLE_INPUT).clear().type('Never Committed{esc}');

        cy.get(TITLE_INPUT).should('not.exist');
        cy.contains('article', name).should('be.visible');
        cy.contains('Never Committed').should('not.exist');
        cy.contains('[role="status"]', 'Node renamed').should('not.exist');
    });

    it('a child card is a navigation target, not a rename target', () => {
        // Logbook is a provisioned lens container, drawn as a CHILD card here.
        // Double-tapping its title re-roots into it — no editor opens — and once
        // there it *is* the PARENT card, which is where its own rename lives.
        cy.contains('article', 'Logbook').find('h2').dblclick();

        cy.get(TITLE_INPUT).should('not.exist');
        cy.contains('article', 'Logbook').find('[aria-label="Go to parent"]').should('exist');
    });
});
