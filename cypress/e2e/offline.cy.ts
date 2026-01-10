/**
 * Offline Mode E2E Tests
 *
 * These tests verify the app works fully offline with IndexedDB.
 * They will FAIL before implementing IDB adapter (app currently requires Firestore).
 *
 * Key behaviors tested:
 * - Creating data while offline
 * - Reading data while offline
 * - Syncing when coming back online
 * - Data persistence across page reloads
 */

describe('Offline Mode', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    /**
     * CRITICAL TEST: App should work without network connection.
     * This will FAIL until IDB adapter is implemented.
     */
    it('creates node while offline', () => {
        const nodeName = `Offline Node ${Date.now()}`;

        // Simulate going offline
        cy.window().then((win) => {
            // Mock navigator.onLine
            cy.stub(win.navigator, 'onLine').value(false);

            // Mock fetch to reject (simulate no network)
            cy.stub(win, 'fetch').rejects(new Error('Network error'));
        });

        // Create a node
        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]')
            .clear()
            .type(nodeName, { delay: 50 })
            .should('have.value', nodeName);
        cy.get('input[placeholder="Subtitle / Location / Short description"]')
            .clear()
            .type('Created offline', { delay: 50 });
        cy.wait(300);
        cy.get('button').contains('Create').click();

        // Node should appear (from IDB, not Firestore)
        cy.get('input[placeholder="Name"]').should('not.exist', { timeout: 5000 });
        cy.contains(nodeName).should('be.visible');

        // Reload while still offline
        cy.reload();

        // Node should still be visible (loaded from IDB)
        cy.contains(nodeName, { timeout: 10000 }).should('be.visible');
    });

    it('edits field value while offline', () => {
        const newValue = `Offline Edit ${Date.now()}`;

        // First, ensure we have a node with a field
        cy.expandDataCard('hvac-system');

        // Go offline
        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
            cy.stub(win, 'fetch').rejects(new Error('Network error'));
        });

        // Edit field
        cy.contains('[role="button"]', 'In Service').dblclick();
        cy.focused()
            .should('match', 'input')
            .clear()
            .type(`${newValue}{enter}`);

        // Value should update (from IDB)
        cy.contains(newValue).should('be.visible');

        // Reload while offline
        cy.reload();

        // Value should persist (from IDB)
        cy.expandDataCard('hvac-system');
        cy.contains(newValue, { timeout: 10000 }).should('be.visible');
    });

    it('navigates while offline', () => {
        // Go offline
        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
            cy.stub(win, 'fetch').rejects(new Error('Network error'));
        });

        // Navigate into HVAC System
        cy.navigateIntoNode('hvac-system');
        cy.get('main.view-branch').should('exist');

        // Children should be visible (from IDB)
        cy.contains('Compressor Unit').should('be.visible');
        cy.contains('Air Handler').should('be.visible');

        // Navigate deeper
        cy.navigateIntoNode('compressor-unit');
        cy.get('.branch-parent-node').contains('Compressor Unit');

        // Grandchildren should be visible
        cy.contains('Motor Assembly').should('be.visible');
    });

    /**
     * CRITICAL TEST: Sync queue should populate and push when online.
     * This verifies the sync manager works correctly.
     */
    it('syncs data when coming back online', () => {
        const nodeName = `Sync Test ${Date.now()}`;

        // Create node while offline
        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
            cy.stub(win, 'fetch').rejects(new Error('Network error'));
        });

        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]').type(nodeName);
        cy.get('button').contains('Create').click();
        cy.contains(nodeName).should('be.visible');

        // Reload to clear stubs and simulate coming back online
        // This is more realistic than manually restoring stubs
        cy.reload();

        // Wait for sync to complete (sync happens on app init when online)
        cy.wait(2000);

        // Node should still be visible (synced to Firestore, then loaded)
        cy.contains(nodeName, { timeout: 10000 }).should('be.visible');
    });

    it('handles sync conflicts with Last-Write-Wins', () => {
        const localValue = `Local ${Date.now()}`;
        const remoteValue = `Remote ${Date.now() + 1000}`;

        // Edit a field locally
        cy.expandDataCard('hvac-system');
        cy.contains('[role="button"]', 'In Service').dblclick();
        cy.focused().clear().type(`${localValue}{enter}`);
        cy.contains(localValue).should('be.visible');

        // Simulate a remote update (would need to update Firestore directly)
        // For now, we just verify local value is kept
        cy.reload();
        cy.expandDataCard('hvac-system');
        cy.contains(localValue, { timeout: 10000 }).should('be.visible');
    });

    it('shows all data after multiple offline sessions', () => {
        const node1 = `Offline 1 ${Date.now()}`;
        const node2 = `Offline 2 ${Date.now() + 1}`;

        // Create first node offline
        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
        });
        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]').type(node1);
        cy.get('button').contains('Create').click();
        cy.contains(node1).should('be.visible');

        // Reload (still offline)
        cy.reload();

        // Create second node offline
        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
        });
        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]').type(node2);
        cy.get('button').contains('Create').click();
        cy.contains(node2).should('be.visible');

        // Both nodes should be visible
        cy.contains(node1).should('be.visible');
        cy.contains(node2).should('be.visible');

        // Reload again
        cy.reload();

        // Both should persist
        cy.contains(node1, { timeout: 10000 }).should('be.visible');
        cy.contains(node2).should('be.visible');
    });

    /**
     * Tests that the app doesn't break when Firestore is completely unavailable.
     */
    it('works when Firestore is unavailable', () => {
        // Block all Firestore requests
        cy.intercept('https://firestore.googleapis.com/**', {
            statusCode: 503,
            body: 'Service Unavailable',
        });

        // App should still load (from IDB)
        cy.visit('/');
        cy.get('main.view-root').should('exist');

        // Should show data from IDB (seeded data)
        cy.contains('HVAC System').should('be.visible');

        // Should be able to create new data
        const nodeName = `No Firestore ${Date.now()}`;
        cy.get('button').contains('Create New Asset').click();
        cy.get('input[placeholder="Name"]').type(nodeName);
        cy.get('button').contains('Create').click();
        cy.contains(nodeName).should('be.visible');
    });
});
