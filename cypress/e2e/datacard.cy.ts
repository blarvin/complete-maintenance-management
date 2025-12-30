/**
 * DataCard tests - expansion, DataField display, and editing.
 * Uses the Golden Tree's HVAC System with pre-seeded fields.
 */
import { GOLDEN_IDS } from '../support/commands';

describe('DataCard', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    describe('expansion toggle', () => {
        it('DataCard is collapsed by default on ROOT view', () => {
            cy.getNodeById(GOLDEN_IDS.root)
                .find('button[aria-label="Expand details"]')
                .should('exist');
        });

        it('expands when chevron is clicked', () => {
            cy.expandDataCard(GOLDEN_IDS.root);

            // Should now show collapse button
            cy.getNodeById(GOLDEN_IDS.root)
                .find('button[aria-label="Collapse details"]')
                .should('exist');

            // DataCard content should be visible
            cy.contains('+ Add Field').should('be.visible');
        });

        it('collapses when chevron is clicked again', () => {
            cy.expandDataCard(GOLDEN_IDS.root);
            cy.contains('+ Add Field').should('be.visible');

            cy.collapseDataCard(GOLDEN_IDS.root);

            cy.getNodeById(GOLDEN_IDS.root)
                .find('button[aria-label="Expand details"]')
                .should('exist');
        });

        it('remembers expansion state after navigation', () => {
            // Expand HVAC System card
            cy.expandDataCard(GOLDEN_IDS.root);
            cy.contains('+ Add Field').should('be.visible');

            // Navigate in and out
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');
            cy.get('button[aria-label="Go to root"]').click();
            cy.get('main.view-root').should('exist');

            // Card should still be expanded
            cy.getNodeById(GOLDEN_IDS.root)
                .find('button[aria-label="Collapse details"]')
                .should('exist');
        });
    });

    describe('DataField display', () => {
        beforeEach(() => {
            cy.expandDataCard(GOLDEN_IDS.root);
        });

        it('shows seeded DataFields for HVAC System', () => {
            // Fields seeded in Golden Tree
            cy.contains('Type Of').should('be.visible');
            cy.contains('HVAC System').should('be.visible');
            cy.contains('Description').should('be.visible');
            cy.contains('Primary cooling and heating').should('be.visible');
            cy.contains('Tags').should('be.visible');
            cy.contains('Status').should('be.visible');
            cy.contains('In Service').should('be.visible');
        });

        it('shows + Add Field button', () => {
            cy.contains('+ Add Field').should('be.visible');
        });
    });

    describe('DataField editing (double-tap)', () => {
        beforeEach(() => {
            cy.expandDataCard(GOLDEN_IDS.root);
        });

        it('double-click on DataField value enables editing', () => {
            // Find the Status field value (div with role="button") and double-click
            cy.contains('[role="button"]', 'In Service').dblclick();

            // Input should now be focused (replaces the div)
            cy.focused().should('match', 'input');
        });

        it('can save edited value with Enter', () => {
            cy.contains('[role="button"]', 'In Service').dblclick();

            // Input is focused, type new value and save with Enter
            cy.focused()
                .should('match', 'input')
                .clear()
                .type('Under Maintenance{enter}');

            // Value should be updated
            cy.contains('Under Maintenance').should('be.visible');
        });

        it('can cancel editing with Escape', () => {
            // Use Tags field (not modified by previous test)
            cy.contains('[role="button"]', 'critical, hvac, rooftop').dblclick();

            // Input is focused, type then cancel with Escape
            cy.focused()
                .should('match', 'input')
                .type('Should Not Save{esc}');

            // Original value should be restored
            cy.contains('critical, hvac, rooftop').should('be.visible');
            cy.contains('Should Not Save').should('not.exist');
        });
    });

    describe('DataCard in BRANCH view', () => {
        beforeEach(() => {
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');
        });

        it('parent node (HVAC System) has expandable DataCard', () => {
            cy.get('.branch-parent-node')
                .find('button[aria-label="Expand details"]')
                .click();

            cy.contains('Type Of').should('be.visible');
        });

        it('child node (Compressor Unit) has expandable DataCard', () => {
            cy.expandDataCard(GOLDEN_IDS.compressor);

            // Compressor fields
            cy.contains('Serial Number').should('be.visible');
            cy.contains('CMP-2023-001').should('be.visible');
        });
    });
});
