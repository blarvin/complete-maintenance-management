/**
 * Behavior contract — restoring a Field after the undo window has closed.
 *
 * Undo inside the Snackbar's window was the only way back; past it the field was
 * invisible with no affordance, even though `RESTORE_ELEMENT` has been the
 * command that Undo itself runs all along. The restore list lives in the node's
 * details panel, and renders only when the node has deleted fields.
 *
 * The test deliberately lets the toast expire rather than pressing Undo — that
 * *is* the case, and the delete-history row lands on the same expiry.
 *
 * Runs offline; selectors are aria-labels and visible text only.
 */

describe('restoring a deleted field', () => {
    it('lists it in the node details and brings it back with its value', () => {
        const name = `Pump ${Date.now()}`;

        cy.freshVisit({ offline: true });
        cy.createNode(name);
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.expandCard(name);

        // Give it a value first, so the restore has something to prove.
        cy.contains('label', 'Description:').parent().find('div[role="button"]').type('{enter}');
        cy.focused().type('Worth keeping', { delay: 60 });
        cy.focused().should('have.value', 'Worth keeping').type('{enter}');
        cy.contains('div[role="button"]', 'Worth keeping').should('be.visible');

        cy.contains('label', 'Description:').parent()
            .find('[aria-label="Expand field details"]').click();
        cy.contains('button', 'Tools').click();
        cy.get('[aria-label="Delete this field"]').click();
        cy.contains('label', 'Description:').should('not.exist');

        // Wait the window out instead of taking the Undo. Longer than the 5s
        // success duration, because that is the thing being tested.
        cy.contains('[role="status"]', 'Field deleted', { timeout: 12000 })
            .should('not.exist');

        // Enter on the ellipsis opens the details panel single-press.
        cy.contains('article', name).find('[aria-label="Expand node details"]')
            .focus().trigger('keydown', { key: 'Enter' });
        cy.contains('Deleted fields').should('be.visible');

        cy.get('[aria-label="Restore Description"]').click();
        cy.contains('[role="status"]', 'Field restored').should('be.visible');
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('div[role="button"]', 'Worth keeping').should('be.visible');

        // The list empties with it — nothing is deleted any more.
        cy.contains('Deleted fields').should('not.exist');
    });
});
