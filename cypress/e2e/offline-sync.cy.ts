/**
 * Behavior contract #3 — offline-first sync:
 * writes made while offline persist locally and queue in syncQueue (sync is
 * skipped); the `online` event drains the queue to the Firestore emulator.
 *
 * Uses the app's dev-tools hook (`window.__syncStatus()`) to observe the
 * queue, and the emulator's REST surface to assert server state.
 */

const DOCUMENTS_URL =
    'http://localhost:8080/v1/projects/treeview-blarapp/databases/(default)/documents';

type SyncStatus = { queueLength: number };

function syncStatus(): Cypress.Chainable<SyncStatus> {
    return cy.window().then((win) =>
        (win as unknown as { __syncStatus: () => Promise<SyncStatus> }).__syncStatus()
    );
}

/** Bounded poll of the sync queue — assertion-based, no blind sleeps. */
function waitForQueue(predicate: (n: number) => boolean, label: string, attempts = 40): void {
    syncStatus().then((s) => {
        if (predicate(s.queueLength)) return;
        expect(attempts, `${label} (queueLength=${s.queueLength})`).to.be.greaterThan(1);
        cy.wait(250);
        waitForQueue(predicate, label, attempts - 1);
    });
}

describe('offline-first sync', () => {
    it('queues writes offline and drains to the emulator on reconnect', () => {
        const name = `Generator ${Date.now()}`;

        cy.freshVisit({ offline: true });
        cy.createNode(name);

        // The write persisted locally and queued for sync (push skipped offline).
        waitForQueue((n) => n > 0, 'expected queued items while offline');

        // Nothing reached the emulator.
        cy.request(`${DOCUMENTS_URL}/elements`).then((res) => {
            expect(JSON.stringify(res.body)).to.not.include(name);
        });

        // Reconnect: flip the stub, then fire the online event SyncLifecycle
        // listens for.
        cy.window().then((win) => {
            (win as unknown as { __setOnLine: (v: boolean) => void }).__setOnLine(true);
            win.dispatchEvent(new Event('online'));
        });

        // The queue drains…
        waitForQueue((n) => n === 0, 'expected queue to drain after reconnect');

        // …and the node document is on the server.
        cy.request(`${DOCUMENTS_URL}/elements`).then((res) => {
            expect(JSON.stringify(res.body)).to.include(name);
        });
    });
});
