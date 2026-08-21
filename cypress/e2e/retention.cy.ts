/**
 * Behavior contract #4 — data retention:
 * a full sync never removes a local row. Whatever the server does or does not
 * have, the client keeps what it holds; the only way a node leaves the tree is
 * a soft delete (`deletedAt`), which travels as an ordinary field update.
 *
 * This is the regression test for ISSUES Bugs #4. `FullCollectionSync` used to
 * delete any local element absent from the server pull, exempting rows still in
 * the sync queue — but a permanently-failed push drops *out* of that queue, so
 * the row least safe to lose was exactly the one that could be purged. The
 * scenario below is that shape without needing to exhaust a retry budget: a row
 * the server has never seen, met by a full sync against an emptied server.
 *
 * Uses `window.__sync()` / `__syncStatus()` (dev-tools hooks) and the
 * emulator's REST surface, same as contract #3.
 */

const EMULATOR_HOST = 'http://localhost:8080';
const PROJECT_ID = 'treeview-blarapp';
const DOCUMENTS_URL = `${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type SyncStatus = { queueLength: number };

function syncStatus(): Cypress.Chainable<SyncStatus> {
    return cy.window().then((win) =>
        (win as unknown as { __syncStatus: () => Promise<SyncStatus> }).__syncStatus()
    );
}

function waitForQueue(predicate: (n: number) => boolean, label: string, attempts = 40): void {
    syncStatus().then((s) => {
        if (predicate(s.queueLength)) return;
        expect(attempts, `${label} (queueLength=${s.queueLength})`).to.be.greaterThan(1);
        cy.wait(250);
        waitForQueue(predicate, label, attempts - 1);
    });
}

describe('data retention', () => {
    it('a full sync against an emptied server keeps local nodes', () => {
        const name = `Compressor ${Date.now()}`;

        // Create offline, so the node exists locally and has never reached the
        // server — the ambiguous state the old purge could not read correctly.
        cy.freshVisit({ offline: true });
        cy.createNode(name);
        waitForQueue((n) => n > 0, 'expected the offline write to queue');

        // Confirm the premise: the server does not have it.
        cy.request(`${DOCUMENTS_URL}/elements`).then((res) => {
            expect(JSON.stringify(res.body)).to.not.include(name);
        });

        // Come back online but wipe the server first, so the pull returns an
        // empty (or near-empty) collection while the local row is still absent
        // from it. Sync is what used to purge here.
        cy.clearEmulator();
        cy.window().then((win) => {
            (win as unknown as { __setOnLine: (v: boolean) => void }).__setOnLine(true);
        });

        cy.window().then((win) =>
            (win as unknown as { __sync: () => Promise<string> }).__sync()
        );

        // The node is still in the tree. (It also pushes on that same cycle —
        // retention is not "the row is stranded", it is "the row is never lost".)
        cy.contains('article', name).should('be.visible');

        // A reload proves it survived in IndexedDB, not just in the live view.
        cy.reload();
        cy.contains('article', name, { timeout: 30000 }).should('be.visible');
    });

    it('the dev Library seeds survive a full sync against an empty server', () => {
        // The seeds never sync (the bootstrap runner enqueues nothing), so they were
        // the original victims of the purge — ISSUES Bugs #1, previously fixed
        // by an explicit exemption inside the strategy. Nothing exempts them
        // now; nothing purges. The construction defaults are the visible proof.
        cy.freshVisit();
        cy.clearEmulator();

        cy.window().then((win) =>
            (win as unknown as { __sync: () => Promise<string> }).__sync()
        );

        const name = `Pump ${Date.now()}`;
        cy.createNode(name);
        cy.expandCard(name);

        cy.contains('label', 'Type Of:').should('be.visible');
        cy.contains('label', 'Description:').should('be.visible');
        cy.contains('label', 'Tags:').should('be.visible');
    });
});
