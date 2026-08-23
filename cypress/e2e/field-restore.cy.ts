/**
 * Behavior contract — restoring a Field after the undo window has closed.
 *
 * Undo inside the Snackbar's window was the only way back; past it the field was
 * invisible with no affordance, even though `RESTORE_ELEMENT` has been the
 * command that Undo itself runs all along. The restore list is a band inside the
 * node panel's Node Tools band, and is absent entirely unless the node has
 * deleted fields.
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
        // Scoped to the field row: `cy.contains` matches substrings, so a bare
        // 'Tools' also matches the node panel's 'Node Tools' band.
        cy.contains('label', 'Description:').parent()
            .contains('button', 'Tools').click();
        cy.get('[aria-label="Delete this field"]').click();
        cy.contains('label', 'Description:').should('not.exist');

        // Wait the window out instead of taking the Undo. Longer than the 5s
        // success duration, because that is the thing being tested.
        cy.contains('[role="status"]', 'Field deleted', { timeout: 12000 })
            .should('not.exist');

        // Enter on the ellipsis opens the details panel single-press. The list is
        // a band inside the Node Tools band, which is closed by default.
        //
        // Scoped to this node's wrapper (the article's parent). Every node on
        // screen carries a panel, and a *closed* one is not hidden — it sits at
        // translateY(100%) behind its own node header, so it has real size and
        // passes jQuery `:visible` while being unclickable. Identity is the only
        // sound filter here; visibility is not.
        cy.contains('article', name).find('[aria-label="Expand node details"]')
            .focus().trigger('keydown', { key: 'Enter' });
        cy.contains('article', name).parent()
            .contains('button', 'Node Tools').click();
        cy.contains('article', name).parent()
            .contains('button', 'Deleted Fields').should('be.visible');

        // Select the row, then restore — the same two-step DataFieldHistory
        // uses, and the reason the action is not on every row at rest. Scoped to
        // the list itself: `[role="listitem"]` is also what history entries are.
        cy.get('[aria-label="Deleted fields"]')
            .contains('[role="listitem"]', 'Description').click();
        cy.get('[aria-label="Restore Description"]').click();
        cy.contains('[role="status"]', 'Field restored').should('be.visible');
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('div[role="button"]', 'Worth keeping').should('be.visible');

        // The band goes with the last tombstone — nothing is deleted any more.
        cy.contains('article', name).parent()
            .contains('button', 'Deleted Fields').should('not.exist');
    });
});
