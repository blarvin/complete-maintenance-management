/**
 * Behavior contract #1 — the core loop:
 * create node (construction defaults arrive) → edit a field value → revert
 * from history → delete field + Undo → delete node + Undo.
 *
 * Runs offline: local-first UI behavior is the subject here; sync is contract
 * #3 and retention is #4. (It ran offline originally because a startup full
 * sync against a fresh emulator wiped the un-pushed Library seeds. That purge
 * is gone (IMPLEMENTATION.md → *Retention over reconciliation*), so offline is
 * now just scope discipline, not a
 * workaround.)
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

        // (The add-a-field-to-an-existing-node leg is gone from this contract.
        // The tree-native Add Surface it comes back against is covered by
        // add-surface.cy.ts; this spec stays on the create → edit → revert loop.)

        // History: field details → select the old value → revert. History is an
        // always-open band with no chevron of its own, so the entries are there
        // as soon as the details expand.
        cy.contains('label', 'Description:').parent()
            .find('[aria-label="Expand field details"]').click();
        // The entries themselves, not their container: `.historyList` is a
        // subgrid pass-through with no box of its own, so it measures 0×0.
        cy.contains('[role="listitem"]', 'First value').should('be.visible').click();
        cy.get('[aria-label="Revert to this value"]').click();
        cy.contains('[role="status"]', 'Field reverted').should('be.visible');
        cy.contains('div[role="button"]', 'First value').should('be.visible');

        // Delete the field; Undo restores it with its value intact. Delete lives
        // in the Tools band, which is collapsible and closed by default. Scoped
        // to the field row: `cy.contains` matches substrings, so a bare 'Tools'
        // also matches the node panel's 'Node Tools' band — and that panel comes
        // first in DOM order.
        cy.contains('label', 'Description:').parent()
            .contains('button', 'Tools').click();
        cy.get('[aria-label="Delete this field"]').click();
        cy.contains('label', 'Description:').should('not.exist');
        cy.contains('[role="status"]', 'Field deleted').should('be.visible');
        cy.get('[role="status"]').contains('button', 'Undo').click();
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('div[role="button"]', 'First value').should('be.visible');

        // Delete the node from its details panel (Enter on the ellipsis opens
        // it single-press); Undo restores it at ROOT. Delete lives in the Node
        // Tools band, closed by default.
        //
        // Everything here is scoped to this node's wrapper (the article's
        // parent, which holds the panel, the header and the card). Every node on
        // screen carries a panel, and a *closed* one is not hidden — it sits at
        // translateY(100%) behind its own node header, so it has real size and
        // passes jQuery `:visible` while being unclickable. Identity is the only
        // sound filter here; visibility is not.
        cy.contains('article', name).find('[aria-label="Expand node details"]')
            .focus().trigger('keydown', { key: 'Enter' });
        cy.contains('article', name).parent()
            .contains('button', 'Node Tools').click();
        cy.contains('article', name).parent()
            .contains('button', 'Delete Asset').click();
        cy.contains('button', 'Create New Asset').should('be.visible');
        cy.contains('article', name).should('not.exist');
        cy.contains('[role="status"]', 'Node deleted').should('be.visible');
        cy.get('[role="status"]').contains('button', 'Undo').click();
        cy.contains('article', name).should('be.visible');
    });
});
