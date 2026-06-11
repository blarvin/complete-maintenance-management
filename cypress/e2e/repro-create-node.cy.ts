/**
 * Repro: root-node creation leaves construction card mounted.
 * Captures every console call + uncaught error/rejection to cypress/console-capture.json.
 */

const logs: string[] = [];

function fmt(args: unknown[]): string {
    return args
        .map((a) => {
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch { return String(a); }
        })
        .join(' ');
}

function visitCapturing() {
    cy.on('uncaught:exception', (err) => {
        logs.push(`[UNCAUGHT] ${err.message}\n${err.stack ?? ''}`);
        return false;
    });
    cy.visit('/', {
        onBeforeLoad(win) {
            for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
                const orig = win.console[level].bind(win.console);
                win.console[level] = (...args: unknown[]) => {
                    logs.push(`[${level}] ${fmt(args)}`);
                    orig(...args);
                };
            }
            win.addEventListener('unhandledrejection', (e) => {
                const r = (e as PromiseRejectionEvent).reason;
                logs.push(`[UNHANDLED REJECTION] ${r?.message ?? String(r)}\n${r?.stack ?? ''}`);
            });
        },
    });
    cy.wait(3000);
}

describe('node creation', () => {
    it('root: unmounts the construction card after Create', () => {
        visitCapturing();
        cy.contains('button', 'Create New Asset').click();
        cy.get('input[aria-label="Node name"]').should('exist').type('ProbeParent');
        cy.get('input[aria-label="Node subtitle"]').type('probe');
        cy.wait(300);
        cy.contains('button', /^Create$/).click();
        cy.wait(3000);
        cy.then(() => { cy.writeFile('cypress/console-capture.json', logs.join('\n')); });
        cy.get('input[aria-label="Node name"]').should('not.exist');
        cy.contains('ProbeParent').should('exist');
    });

    it('branch: unmounts the child construction card after Create', () => {
        visitCapturing();
        // Navigate into the parent created by the previous test.
        cy.get('[aria-label="Open ProbeParent"]').first().click();
        cy.wait(1500);
        cy.contains('button', '+ Add Sub-Asset').click();
        cy.get('input[aria-label="Node name"]').should('exist').type('ProbeChild');
        cy.wait(300);
        cy.contains('button', /^Create$/).click();
        cy.wait(3000);
        cy.then(() => { cy.writeFile('cypress/console-capture-branch.json', logs.join('\n')); });
        cy.get('input[aria-label="Node name"]').should('not.exist');
        cy.contains('ProbeChild').should('exist');
    });
});
