/**
 * Behavior contract #1 — the core loop:
 * create node (construction defaults arrive) → edit a field value → add a
 * field via the display composer → revert from history → delete field + Undo
 * → delete node + Undo.
 *
 * Runs offline: local-first UI behavior is the subject here; sync is contract
 * #3. (Online, a fresh emulator's startup full-sync wipes the un-pushed
 * Library seeds — a data-layer issue outside this contract.)
 *
 * Selectors are aria-labels and visible text only; the SolidJS port must keep
 * these passing unchanged.
 */

describe('core loop', () => {
    it('creates a node, edits fields, reverts, deletes and undoes', () => {
        const name = `Pump ${Date.now()}`;

        cy.freshVisit({ offline: true });
        cy.createNode(name, 'workshop');

        // Re-root into the node; the Up button marks the PARENT card.
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.contains('article', name).find('[aria-label="Go to root"]').should('exist');

        // The construction defaults were committed with the node.
        cy.expandCard(name);
        cy.contains('label', 'Type Of:').should('be.visible');
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('label', 'Tags:').should('be.visible');

        // Edit Description via keyboard (Enter opens the editor; multiline
        // text-kv → textarea; Enter saves). Twice, so history has an old value.
        // Typing is deliberately slow with a value check before commit: the
        // controlled input re-renders per keystroke and can drop fast keys.
        cy.contains('label', 'Description:').parent()
            .find('div[role="button"]').type('{enter}');
        cy.focused().should('have.prop', 'tagName', 'TEXTAREA');
        cy.focused().type('First value', { delay: 60 });
        cy.focused().should('have.value', 'First value').type('{enter}');
        cy.contains('[role="status"]', 'Field updated').should('be.visible');
        cy.contains('div[role="button"]', 'First value').type('{enter}');
        cy.focused().should('have.prop', 'tagName', 'TEXTAREA');
        cy.focused().clear().type('Second value', { delay: 60 });
        cy.focused().should('have.value', 'Second value').type('{enter}');
        cy.contains('div[role="button"]', 'Second value').should('be.visible');

        // Add a field via the display composer: check "Weight"; its editor
        // auto-opens focused; Enter commits the pending value; Save persists.
        cy.contains('button', '+ Add Fields').click();
        cy.contains('label', 'Weight:').prev('input[type="checkbox"]').check();
        // Wait for the auto-focused value editor (NOT the checkbox just ticked).
        cy.focused().should('match', 'input:not([type="checkbox"]), textarea');
        cy.focused().clear().type('80', { delay: 60 });
        cy.focused().should('have.value', '80').type('{enter}');
        cy.contains('button', /^Save$/).click();
        cy.contains('button', '+ Add Fields').should('be.visible'); // composer closed
        cy.contains('label', 'Weight:').should('be.visible');
        cy.contains('div[role="button"]', '80').should('be.visible');

        // History: field details → history list → select the old value → revert.
        cy.contains('label', 'Description:').parent()
            .find('[aria-label="Expand field details"]').click();
        cy.get('[aria-label="Open field history"]').click();
        cy.contains('[role="listitem"]', 'First value').click();
        cy.get('[aria-label="Revert to this value"]').click();
        cy.contains('[role="status"]', 'Field reverted').should('be.visible');
        cy.contains('div[role="button"]', 'First value').should('be.visible');

        // Delete the field; Undo restores it with its value intact.
        cy.get('[aria-label="Delete this field"]').click();
        cy.contains('label', 'Description:').should('not.exist');
        cy.contains('[role="status"]', 'Field deleted').should('be.visible');
        cy.get('[role="status"]').contains('button', 'Undo').click();
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('div[role="button"]', 'First value').should('be.visible');

        // Delete the node from its details panel (Enter on the ellipsis opens
        // it single-press); Undo restores it at ROOT.
        cy.contains('article', name).find('[aria-label="Expand node details"]')
            .focus().trigger('keydown', { key: 'Enter' });
        cy.contains('button', 'Delete Asset').click();
        cy.contains('button', 'Create New Asset').should('be.visible');
        cy.contains('article', name).should('not.exist');
        cy.contains('[role="status"]', 'Node deleted').should('be.visible');
        cy.get('[role="status"]').contains('button', 'Undo').click();
        cy.contains('article', name).should('be.visible');
    });
});
