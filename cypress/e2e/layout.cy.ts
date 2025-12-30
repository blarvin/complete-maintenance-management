/**
 * Layout tests - verifies width alignment between node states.
 * Uses the Golden Tree for consistent measurements.
 * 
 * Key layout rules:
 * - isRoot nodes: full width within view-root
 * - isParent nodes: full width within branch-parent-node
 * - isChild nodes: indented 32px from parent (--child-indent)
 * - DataCards: align with their respective nodes
 */
import { GOLDEN_IDS } from '../support/commands';

describe('Layout', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    describe('ROOT view layout', () => {
        it('root node fills available width', () => {
            cy.get('main.view-root').then(($view) => {
                const viewWidth = $view[0].getBoundingClientRect().width;

                cy.getNodeById(GOLDEN_IDS.root).then(($node) => {
                    const nodeWidth = $node[0].getBoundingClientRect().width;
                    // Node should be close to view width (minus padding)
                    expect(nodeWidth).to.be.greaterThan(viewWidth - 20);
                });
            });
        });

        it('Create New Asset button matches node width', () => {
            cy.getNodeById(GOLDEN_IDS.root).then(($node) => {
                const nodeWidth = $node[0].getBoundingClientRect().width;

                cy.get('button').contains('Create New Asset').then(($btn) => {
                    const btnWidth = $btn[0].getBoundingClientRect().width;
                    expect(Math.abs(btnWidth - nodeWidth)).to.be.lessThan(5);
                });
            });
        });
    });

    describe('BRANCH view layout', () => {
        beforeEach(() => {
            cy.navigateIntoNode(GOLDEN_IDS.root);
            cy.get('main.view-branch').should('exist');
        });

        it('parent node fills branch-parent-node container', () => {
            cy.get('.branch-parent-node').then(($container) => {
                const containerWidth = $container[0].getBoundingClientRect().width;

                cy.get('.branch-parent-node article').then(($node) => {
                    const nodeWidth = $node[0].getBoundingClientRect().width;
                    expect(nodeWidth).to.be.greaterThan(containerWidth - 10);
                });
            });
        });

        it('child node is indented 32px from parent left edge', () => {
            cy.get('.branch-parent-node article').then(($parent) => {
                const parentLeft = $parent[0].getBoundingClientRect().left;

                cy.getNodeById(GOLDEN_IDS.compressor).then(($child) => {
                    const childLeft = $child[0].getBoundingClientRect().left;
                    const indent = childLeft - parentLeft;
                    // Indent should be 32px (per CSS --child-indent)
                    expect(indent).to.be.closeTo(32, 5);
                });
            });
        });

        it('child node right edge aligns with parent right edge', () => {
            cy.get('.branch-parent-node article').then(($parent) => {
                const parentRight = $parent[0].getBoundingClientRect().right;

                cy.getNodeById(GOLDEN_IDS.compressor).then(($child) => {
                    const childRight = $child[0].getBoundingClientRect().right;
                    expect(Math.abs(parentRight - childRight)).to.be.lessThan(5);
                });
            });
        });

        it('all children have consistent left alignment', () => {
            // Get left positions of all three children
            const leftPositions: number[] = [];

            cy.getNodeById(GOLDEN_IDS.compressor).then(($n) => {
                leftPositions.push($n[0].getBoundingClientRect().left);
            });
            cy.getNodeById(GOLDEN_IDS.airHandler).then(($n) => {
                leftPositions.push($n[0].getBoundingClientRect().left);
            });
            cy.getNodeById(GOLDEN_IDS.ductwork).then(($n) => {
                leftPositions.push($n[0].getBoundingClientRect().left);
            }).then(() => {
                // All should have the same left position
                const [first, second, third] = leftPositions;
                expect(Math.abs(first - second)).to.be.lessThan(2);
                expect(Math.abs(second - third)).to.be.lessThan(2);
            });
        });
    });

    describe('DataCard alignment', () => {
        it('expanded DataCard right edge aligns with node right edge (ROOT)', () => {
            cy.expandDataCard(GOLDEN_IDS.root);
            cy.wait(200); // Animation

            cy.getNodeById(GOLDEN_IDS.root).then(($node) => {
                const nodeRight = $node[0].getBoundingClientRect().right;

                cy.getNodeById(GOLDEN_IDS.root)
                    .parent()
                    .find('[class*="datacard"]')
                    .then(($card) => {
                        if ($card.length) {
                            const cardRight = $card[0].getBoundingClientRect().right;
                            expect(Math.abs(nodeRight - cardRight)).to.be.lessThan(5);
                        }
                    });
            });
        });
    });
});
