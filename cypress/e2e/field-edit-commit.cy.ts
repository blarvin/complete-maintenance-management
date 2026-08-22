/**
 * Behavior contract — what commits a field edit, and what cancels one.
 *
 * The regression spec for the mobile-cannot-persist bug: `inputBlur` used to
 * branch, saving a `pendingMode` row and *discarding* a persisted one. On a
 * desktop the only way to blur is to click away, so discarding read as "cancel";
 * on a phone the on-screen keyboard's action key **is** a blur, so there was no
 * reachable way to commit at all.
 *
 * The five cases below are the diagnosis, rebuilt. Two of them (B, C) were red
 * before the fix; the other three pin what the fix must not disturb — the two
 * gestures that still mean cancel, and the draft-row arm that already saved.
 *
 * Case C fires an OSK-shaped keydown (`key: 'Unidentified'`, `keyCode: 229`)
 * before the blur. It is here to stay *green for the boring reason*: B is red
 * without any keydown at all, so key-code handling was never the hole. If C
 * ever fails alone, that is new information — but don't start from `keyCode 229`
 * or `compositionend`.
 *
 * Runs offline; selectors are aria-labels and visible text only, per the
 * support contract.
 */

const EXPAND = '[aria-label="Expand the new field row"]:visible';
const NAME = 'input[aria-label="New field name"]:visible';

/** The Description field's display element (a `role="button"` labelled by its
 *  `<label>`). `{enter}` opens the editor — the double-tap path needs real
 *  pointer timing, and the keyboard path exercises the same `beginEdit`. */
const description = () =>
    cy.contains('label', 'Description:').parent().find('div[role="button"]');

/** Open the Description editor and type `text` into it. Typing is deliberately
 *  slow: the input is controlled and re-renders per keystroke. */
const typeIntoDescription = (text: string) => {
    description().type('{enter}');
    cy.focused().should('have.prop', 'tagName', 'TEXTAREA');
    cy.focused().type(text, { delay: 60 });
    cy.focused().should('have.value', text);
};

describe('committing a field edit', () => {
    const name = `Pump ${Date.now()}`;

    beforeEach(() => {
        cy.freshVisit({ offline: true });
        cy.createNode(name);
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.expandCard(name);
        cy.contains('label', 'Description:').should('be.visible');
    });

    it('A — Enter commits', () => {
        typeIntoDescription('Committed by Enter');
        cy.focused().type('{enter}');

        cy.contains('[role="status"]', 'Field updated').should('be.visible');
        cy.contains('div[role="button"]', 'Committed by Enter').should('be.visible');
    });

    it('B — blur alone commits (the phone case; this was the bug)', () => {
        typeIntoDescription('Committed by blur');
        cy.focused().blur();

        cy.contains('[role="status"]', 'Field updated').should('be.visible');
        cy.contains('div[role="button"]', 'Committed by blur').should('be.visible');
    });

    it('C — an OSK-shaped keydown then blur commits', () => {
        typeIntoDescription('Committed by OSK');
        cy.focused().trigger('keydown', { key: 'Unidentified', keyCode: 229, which: 229 });
        cy.focused().blur();

        cy.contains('[role="status"]', 'Field updated').should('be.visible');
        cy.contains('div[role="button"]', 'Committed by OSK').should('be.visible');
    });

    it('D — the same blur on a draft row keeps the value', () => {
        // The other arm of the branch, and the one that was always right: a
        // `pendingMode` row buffers into the draft rather than committing.
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Draft Field');

        // A `pendingMode` row opens on a *single* tap — there is no persisted
        // value to protect, so the double-tap guard is skipped (useFieldEdit →
        // valuePointerDown).
        const slot = () => cy.get(NAME).first().parent().find('div[role="button"]').first();
        slot().click();
        cy.focused().should('have.prop', 'tagName', 'INPUT');
        cy.focused().type('Buffered', { delay: 60 });
        cy.focused().should('have.value', 'Buffered').blur();

        slot().should('contain.text', 'Buffered');
        // Nothing was persisted — the draft is still a draft.
        cy.contains('[role="status"]', 'Field updated').should('not.exist');
    });

    it('E — tapping outside the row still cancels', () => {
        typeIntoDescription('Thrown away');
        // `pointerdown` outside the row: the document listener closes the FSM
        // *before* blur runs, so blur's own guard fails and never saves. That
        // ordering is the whole mechanism.
        cy.get('body').trigger('pointerdown');

        cy.contains('div[role="button"]', 'Thrown away').should('not.exist');
        cy.contains('[role="status"]', 'Field updated').should('not.exist');
        cy.contains('label', 'Description:').parent().contains('Empty').should('be.visible');
    });

    it('Escape cancels', () => {
        // Now the only *keyboard* cancel, so it is worth pinning beside E.
        typeIntoDescription('Also thrown away');
        cy.focused().type('{esc}');

        cy.contains('div[role="button"]', 'Also thrown away').should('not.exist');
        cy.contains('[role="status"]', 'Field updated').should('not.exist');
        cy.contains('label', 'Description:').parent().contains('Empty').should('be.visible');
    });
});
