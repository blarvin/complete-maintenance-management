/**
 * E2E support — behavior-contract helpers.
 *
 * Every spec runs against the Firestore emulator (`?emulator=true`) with a
 * fresh IndexedDB per test: hermetic, and no production Firestore traffic.
 * These specs are the SolidJS-migration acceptance tests — selectors are
 * aria-labels and visible text ONLY, which the port keeps stable.
 */

// The app scopes its Dexie database by sync target (src/data/storage/db.ts).
// Specs visit `?emulator=true`, so the emulator-scoped database is the live one
// — but delete both, so a spec can never inherit state from a manual
// production-mode session on the same origin.
const DB_NAMES = [
    'complete-maintenance-management',
    'complete-maintenance-management-emulator',
];
const EMULATOR_HOST = 'http://localhost:8080';
const PROJECT_ID = 'treeview-blarapp';

export const EMULATOR_DOCUMENTS_URL =
    `${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /** Wipe all documents from the Firestore emulator. */
            clearEmulator(): Chainable<void>;
            /**
             * Visit the app hermetically: emulator wiped, IndexedDB deleted
             * before the app boots. Resolves once storage init completed
             * (dev-tools hook present) and the ROOT create surface is visible.
             *
             * `offline: true` stubs `navigator.onLine` to false; flip it back
             * with `win.__setOnLine(true)` and dispatch an `online` event.
             */
            freshVisit(options?: { offline?: boolean }): Chainable<void>;
            /** Drive the in-situ construction card to create a root node. */
            createNode(name: string, subtitle?: string): Chainable<void>;
            /** Expand a node card's DataCard, retrying through re-render churn. */
            expandCard(articleText: string): Chainable<void>;
        }
    }
}

Cypress.Commands.add('clearEmulator', () => {
    cy.request(
        'DELETE',
        `${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
    );
});

Cypress.Commands.add('freshVisit', (options: { offline?: boolean } = {}) => {
    cy.clearEmulator();
    cy.visit('/?emulator=true', {
        onBeforeLoad(win) {
            // Delete the app DBs before any app script runs. The app's own
            // open() queues behind this deletion (per-database IDB request
            // ordering), so it always boots against a fresh store.
            DB_NAMES.forEach((name) => win.indexedDB.deleteDatabase(name));
            if (options.offline) {
                let onLine = false;
                Object.defineProperty(win.navigator, 'onLine', {
                    configurable: true,
                    get: () => onLine,
                });
                (win as unknown as { __setOnLine: (v: boolean) => void }).__setOnLine =
                    (v: boolean) => { onLine = v; };
            }
        },
    });
    // Storage init is complete once the dev-tools sync hook is registered.
    cy.window({ timeout: 30000 }).should('have.property', '__syncStatus');
    cy.contains('button', 'Create New Asset', { timeout: 30000 }).should('be.visible');
});

Cypress.Commands.add('createNode', (name: string, subtitle = '') => {
    cy.contains('button', 'Create New Asset').click();
    cy.get('input[aria-label="Node name"]').type(name);
    if (subtitle) cy.get('input[aria-label="Node subtitle"]').type(subtitle);
    cy.contains('button', /^Create$/).click();
    // Construction card unmounts and the node appears in the tree. (Scoped to
    // the card header: the raw name also hides in collapsed breadcrumbs.)
    cy.get('input[aria-label="Node name"]').should('not.exist');
    cy.contains('article', name).should('be.visible');
});

Cypress.Commands.add('expandCard', (articleText: string) => {
    const tryExpand = (attempts: number): void => {
        cy.contains('article', articleText)
            .find('[aria-label="Expand details"], [aria-label="Collapse details"]')
            .first()
            .then(($btn) => {
                if ($btn.attr('aria-expanded') === 'true') return;
                expect(attempts, `card "${articleText}" did not expand`).to.be.greaterThan(0);
                cy.wrap($btn).click();
                cy.wait(200); // let the FSM flip before re-reading aria-expanded
                tryExpand(attempts - 1);
            });
    };
    tryExpand(5);
});

export {};
