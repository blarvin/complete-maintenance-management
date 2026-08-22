/**
 * Behavior contract — the Add Surface (SPEC → The Add Surface).
 *
 * The first coverage this surface has ever had: everything before it was
 * hand-tested only, and `core-loop.cy.ts` runs on construction defaults so it
 * never touches an add affordance at all.
 *
 * Click-path only. The keyboard model is deliberately out of scope — there is
 * no keyboard model in the surface yet to test (SPEC → Keyboard &
 * Accessibility), so this is a decision, not a gap.
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

/** The draft row itself — the name input's own wrapper, which is also the row
 *  the value slot renders into. Scoping through it keeps the value-slot
 *  assertions off the persisted fields in the same card. */
const draftRow = () => cy.get(NAME).first().parent();

/** The nth `Options` row's text entry in the Config band. `ListRows` gives the
 *  row a plain `<span>` label rather than a `<label for>`, so the row is reached
 *  through the one thing on it that carries an aria-label: its remove button. */
const optionEntry = (n: number) =>
    cy.get(`[aria-label="Remove option ${n}"]:visible`).parent().find('input[type="text"]');

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

    it('keeps the whole draft across a reload', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Survives Reload');
        // Change the kind and set a knob, so this covers the config too — the
        // part actually worth losing sleep over is an authored config set knob
        // by knob, not a half-typed name.
        clickButton(/^Number$/);
        // `.blur()` because a Config band `LeafRow` commits on native `change`,
        // not per keystroke — typing alone never reaches the draft.
        cy.contains('label', 'Units symbol').parent().find('input').type('bar').blur();

        // A reload that keeps storage — not `freshVisit`, which deletes the app
        // databases before the app boots. Offline is re-stubbed because a fresh
        // document loses the stub, and going online here is not neutral: the
        // sync channel opens, the card re-renders, and the open/closed state of
        // the surface (component-local, not persisted) is lost with it.
        cy.window().then((win) => {
            (win as unknown as Record<string, unknown>).__reloadMarker = true;
        });
        cy.visit('/?emulator=true', {
            onBeforeLoad(win) {
                Object.defineProperty(win.navigator, 'onLine', {
                    configurable: true,
                    get: () => false,
                });
            },
        });
        // The marker is the proof the document was actually replaced, so a
        // no-op visit cannot pass this test by leaving the page as it was.
        cy.window({ timeout: 30000 }).should('not.have.property', '__reloadMarker');
        cy.contains('button', 'Create New Asset', { timeout: 30000 }).should('be.visible');
        cy.get(`[aria-label="Open ${name}"]`).click();
        cy.expandCard(name);

        // The collapsed row already shows the name, exactly as after a collapse.
        cy.get(NAME).first().should('have.value', 'Survives Reload');

        cy.get(EXPAND).first().click();
        cy.contains('Creating a Number field').should('be.visible');
        cy.contains('label', 'Units symbol').parent().find('input').should('have.value', 'bar');
    });

    it('discards the draft on Cancel', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Scratch');

        clickButton(/^Cancel$/);

        // Cancel closes the row *and* empties it — the opposite of a collapse,
        // which keeps everything (see the spec above).
        cy.get(EXPAND).should('exist');
        cy.get(NAME).first().should('have.value', '');
        cy.contains('label', 'Scratch:').should('not.exist');
        cy.contains('[role="status"]', 'Field added').should('not.exist');
    });

    it('carries typed enum options into the value slot', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Condition');
        clickButton(/^Enum$/);

        // The draft opens with two blank option rows — an enum needs two to be a
        // choice at all — so filling them in is the whole authoring act.
        optionEntry(1).type('Good');
        optionEntry(2).type('Bad');

        // The value slot is the real EnumKvField in pendingMode, so it offers
        // what the Config band says right now, with nothing persisted anywhere.
        draftRow().find('[aria-haspopup="listbox"]').click();
        draftRow().contains('[role="option"]', 'Good').click();
        draftRow().find('[aria-haspopup="listbox"]').should('contain.text', 'Good');

        // The `default` knob and the slot are two views of one thing while
        // authoring: choosing in the slot sets the default.
        cy.contains('label', 'Default').parent().find('select').should('have.value', 'Good');

        clickButton(/^Create$/);
        cy.contains('[role="status"]', 'Field added').should('be.visible');
        cy.contains('label', 'Condition:').parent().contains('Good').should('be.visible');
    });

    it('swaps the config and the value slot when the kind changes mid-draft', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Reading');
        // The draft starts as text-kv, so its knobs are on screen before the swap.
        cy.contains('label', 'Multiline').should('be.visible');

        clickButton(/^Number$/);

        // The name is the user's; the config is the kind's, and is replaced whole.
        cy.get(NAME).first().should('have.value', 'Reading');
        cy.contains('Creating a Number field').should('be.visible');
        cy.contains('label', 'Units symbol').should('be.visible');
        cy.contains('label', 'Multiline').should('not.exist');

        clickButton(/^Create$/);
        cy.contains('[role="status"]', 'Field added').should('be.visible');
        cy.contains('label', 'Reading:').should('be.visible');
    });

    it('undoes the mint from the Field added toast', () => {
        cy.get(EXPAND).first().click();
        cy.get(NAME).first().type('Fleeting');
        clickButton(/^Create$/);

        cy.contains('label', 'Fleeting:').should('be.visible');
        cy.get('[role="status"]').contains('button', 'Undo').click();

        cy.contains('label', 'Fleeting:').should('not.exist');
    });
});
