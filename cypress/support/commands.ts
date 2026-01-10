/**
 * Custom Cypress commands for E2E testing.
 */
export {};

// Fixed IDs matching seed-data.ts for easy reference in tests
export const GOLDEN_IDS = {
    root: 'hvac-system',
    compressor: 'compressor-unit',
    motorAssembly: 'motor-assembly',
    refrigerantLines: 'refrigerant-lines',
    airHandler: 'air-handler',
    blowerMotor: 'blower-motor',
    ductwork: 'ductwork',
};

/**
 * Clear IndexedDB databases (Firestore offline cache).
 * Ensures each test starts with fresh local state.
 */
Cypress.Commands.add('clearIndexedDB', () => {
    return cy.window().then((win) => {
        return new Cypress.Promise<void>((resolve) => {
            if (win.indexedDB && win.indexedDB.databases) {
                win.indexedDB.databases().then((databases: IDBDatabaseInfo[]) => {
                    const deletePromises = databases.map((db: IDBDatabaseInfo) => {
                        return new Promise<void>((res) => {
                            const request = win.indexedDB.deleteDatabase(db.name!);
                            request.onsuccess = () => res();
                            request.onerror = () => res();
                            request.onblocked = () => res();
                        });
                    });
                    Promise.all(deletePromises).then(() => resolve());
                });
            } else {
                resolve();
            }
        });
    }) as Cypress.Chainable<void>;
});

/**
 * Get a TreeNode article element by its node ID.
 * More reliable than text-based selection.
 */
Cypress.Commands.add('getNodeById', (nodeId: string) => {
    return cy.get(`article[data-node-id="${nodeId}"]`);
});

/**
 * Navigate into a node (click to enter BRANCH view).
 */
Cypress.Commands.add('navigateIntoNode', (nodeId: string) => {
    return cy.getNodeById(nodeId).find('[role="button"]').click();
});

/**
 * Expand a node's DataCard.
 */
Cypress.Commands.add('expandDataCard', (nodeId: string) => {
    return cy.getNodeById(nodeId)
        .find('button[aria-label="Expand details"]')
        .click();
});

/**
 * Collapse a node's DataCard.
 */
Cypress.Commands.add('collapseDataCard', (nodeId: string) => {
    return cy.getNodeById(nodeId)
        .find('button[aria-label="Collapse details"]')
        .click();
});

// TypeScript declarations
declare global {
    namespace Cypress {
        interface Chainable {
            clearIndexedDB(): Chainable<void>;
            getNodeById(nodeId: string): Chainable<JQuery<HTMLElement>>;
            navigateIntoNode(nodeId: string): Chainable<JQuery<HTMLElement>>;
            expandDataCard(nodeId: string): Chainable<JQuery<HTMLElement>>;
            collapseDataCard(nodeId: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}
