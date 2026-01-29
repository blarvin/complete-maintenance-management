/**
 * Tests for FSM-patterned application state.
 * Tests transitions, guards, and selectors as pure functions.
 */

import { describe, it, expect, vi } from 'vitest';
import { transitions, selectors, type AppState } from '../state/appState';

// Mock uiPrefs to avoid localStorage in tests
vi.mock('../state/uiPrefs', () => ({
    loadUIPrefs: () => ({ expandedCards: new Set(), expandedFieldDetails: new Set() }),
    saveUIPrefs: vi.fn(),
}));

/**
 * Create a fresh initial state for testing
 */
function createTestState(overrides?: Partial<AppState>): AppState {
    return {
        view: { state: 'ROOT' },
        history: [],
        underConstruction: null,
        ui: {
            expandedCards: new Set<string>(),
            expandedFieldDetails: new Set<string>(),
            expandedNodeDetails: new Set<string>(),
        },
        editingFieldId: null,
        ...overrides,
    };
}

describe('State Transitions', () => {
    describe('navigateToNode', () => {
        it('transitions from ROOT to BRANCH', () => {
            const state = createTestState();
            transitions.navigateToNode(state, 'node-1');
            
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
        });

        it('transitions from BRANCH to deeper BRANCH', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'parent-1' },
            });
            transitions.navigateToNode(state, 'child-1');
            
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'child-1' });
        });

        it('pushes current nodeId to history when navigating deeper', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'parent-1' },
                history: [],
            });
            transitions.navigateToNode(state, 'child-1');
            
            expect(state.history).toEqual(['parent-1']);
        });

        it('builds up history with multiple navigations', () => {
            const state = createTestState();
            
            transitions.navigateToNode(state, 'level-1');
            transitions.navigateToNode(state, 'level-2');
            transitions.navigateToNode(state, 'level-3');
            
            expect(state.history).toEqual(['level-1', 'level-2']);
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'level-3' });
        });

        it('clears editingFieldId on navigation', () => {
            const state = createTestState({ editingFieldId: 'field-1' });
            transitions.navigateToNode(state, 'node-1');
            
            expect(state.editingFieldId).toBeNull();
        });

        it('GUARD: blocks navigation while under construction', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            transitions.navigateToNode(state, 'node-1');
            
            // Should not have changed
            expect(state.view).toEqual({ state: 'ROOT' });
        });
    });

    describe('navigateUp', () => {
        it('transitions from BRANCH to ROOT when parentId is null', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
            });
            transitions.navigateUp(state, null);
            
            expect(state.view).toEqual({ state: 'ROOT' });
        });

        it('transitions from BRANCH to parent BRANCH', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'child-1' },
                history: ['parent-1'],
            });
            transitions.navigateUp(state, 'parent-1');
            
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'parent-1' });
        });

        it('pops history when navigating up', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'level-3' },
                history: ['level-1', 'level-2'],
            });
            transitions.navigateUp(state, 'level-2');
            
            expect(state.history).toEqual(['level-1']);
        });

        it('clears history when navigating to ROOT', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
                history: ['a', 'b', 'c'],
            });
            transitions.navigateUp(state, null);
            
            expect(state.history).toEqual([]);
        });

        it('clears editingFieldId on navigation', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
                editingFieldId: 'field-1',
            });
            transitions.navigateUp(state, null);
            
            expect(state.editingFieldId).toBeNull();
        });

        it('GUARD: does nothing when already at ROOT', () => {
            const state = createTestState({ view: { state: 'ROOT' } });
            const originalView = state.view;
            
            transitions.navigateUp(state, null);
            
            expect(state.view).toBe(originalView);
        });

        it('GUARD: blocks navigation while under construction', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
                underConstruction: {
                    id: 'new-node',
                    parentId: 'node-1',
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            transitions.navigateUp(state, null);
            
            // Should not have changed
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
        });
    });

    describe('navigateToRoot', () => {
        it('transitions from BRANCH to ROOT', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'deep-node' },
                history: ['a', 'b', 'c'],
            });
            transitions.navigateToRoot(state);
            
            expect(state.view).toEqual({ state: 'ROOT' });
            expect(state.history).toEqual([]);
        });

        it('does nothing when already at ROOT', () => {
            const state = createTestState();
            transitions.navigateToRoot(state);
            
            expect(state.view).toEqual({ state: 'ROOT' });
        });

        it('clears editingFieldId', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
                editingFieldId: 'field-1',
            });
            transitions.navigateToRoot(state);
            
            expect(state.editingFieldId).toBeNull();
        });

        it('GUARD: blocks while under construction', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            transitions.navigateToRoot(state);
            
            expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
        });
    });

    describe('startConstruction', () => {
        it('sets underConstruction data', () => {
            const state = createTestState();
            const ucData = {
                id: 'new-node',
                parentId: null,
                nodeName: '',
                nodeSubtitle: '',
                defaultFields: [{ fieldName: 'Type Of', fieldValue: null }],
            };
            
            transitions.startConstruction(state, ucData);
            
            expect(state.underConstruction).toEqual(ucData);
        });

        it('GUARD: does nothing if already constructing', () => {
            const existingUC = {
                id: 'existing',
                parentId: null,
                nodeName: 'Existing',
                nodeSubtitle: '',
                defaultFields: [],
            };
            const state = createTestState({ underConstruction: existingUC });
            
            transitions.startConstruction(state, {
                id: 'new',
                parentId: null,
                nodeName: '',
                nodeSubtitle: '',
                defaultFields: [],
            });
            
            // Should still be the existing one
            expect(state.underConstruction).toEqual(existingUC);
        });
    });

    describe('cancelConstruction', () => {
        it('clears underConstruction', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            transitions.cancelConstruction(state);
            
            expect(state.underConstruction).toBeNull();
        });

        it('does nothing if not constructing', () => {
            const state = createTestState();
            transitions.cancelConstruction(state);
            expect(state.underConstruction).toBeNull();
        });
    });

    describe('completeConstruction', () => {
        it('clears underConstruction', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: 'New Node',
                    nodeSubtitle: 'Subtitle',
                    defaultFields: [],
                },
            });
            
            transitions.completeConstruction(state);
            
            expect(state.underConstruction).toBeNull();
        });
    });

    describe('toggleCardExpanded', () => {
        it('adds nodeId to expandedCards when not present', () => {
            const state = createTestState();
            transitions.toggleCardExpanded(state, 'node-1');
            
            expect(state.ui.expandedCards.has('node-1')).toBe(true);
        });

        it('removes nodeId from expandedCards when present', () => {
            const state = createTestState({
                ui: {
                    expandedCards: new Set(['node-1']),
                    expandedFieldDetails: new Set(),
                    expandedNodeDetails: new Set(),
                },
            });
            transitions.toggleCardExpanded(state, 'node-1');
            
            expect(state.ui.expandedCards.has('node-1')).toBe(false);
        });

        it('preserves other expanded cards', () => {
            const state = createTestState({
                ui: {
                    expandedCards: new Set(['node-1', 'node-2']),
                    expandedFieldDetails: new Set(),
                    expandedNodeDetails: new Set(),
                },
            });
            transitions.toggleCardExpanded(state, 'node-1');
            
            expect(state.ui.expandedCards.has('node-1')).toBe(false);
            expect(state.ui.expandedCards.has('node-2')).toBe(true);
        });
    });

    describe('toggleFieldDetailsExpanded', () => {
        it('adds fieldId to expandedFieldDetails when not present', () => {
            const state = createTestState();
            transitions.toggleFieldDetailsExpanded(state, 'field-1');
            
            expect(state.ui.expandedFieldDetails.has('field-1')).toBe(true);
        });

        it('removes fieldId from expandedFieldDetails when present', () => {
            const state = createTestState({
                ui: {
                    expandedCards: new Set(),
                    expandedFieldDetails: new Set(['field-1']),
                    expandedNodeDetails: new Set(),
                },
            });
            transitions.toggleFieldDetailsExpanded(state, 'field-1');
            
            expect(state.ui.expandedFieldDetails.has('field-1')).toBe(false);
        });
    });

    describe('startFieldEdit', () => {
        it('sets editingFieldId', () => {
            const state = createTestState();
            transitions.startFieldEdit(state, 'field-1');
            
            expect(state.editingFieldId).toBe('field-1');
        });

        it('replaces existing editingFieldId (single-field edit guarantee)', () => {
            const state = createTestState({ editingFieldId: 'field-1' });
            transitions.startFieldEdit(state, 'field-2');
            
            expect(state.editingFieldId).toBe('field-2');
        });
    });

    describe('stopFieldEdit', () => {
        it('clears editingFieldId', () => {
            const state = createTestState({ editingFieldId: 'field-1' });
            transitions.stopFieldEdit(state);
            
            expect(state.editingFieldId).toBeNull();
        });
    });
});

describe('State Selectors', () => {
    describe('getTreeNodeState', () => {
        it('returns UNDER_CONSTRUCTION for node being constructed', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            const result = selectors.getTreeNodeState(state, 'new-node', null);
            expect(result).toBe('UNDER_CONSTRUCTION');
        });

        it('returns ROOT for nodes in ROOT view', () => {
            const state = createTestState({ view: { state: 'ROOT' } });
            
            const result = selectors.getTreeNodeState(state, 'any-node', null);
            expect(result).toBe('ROOT');
        });

        it('returns PARENT for current node in BRANCH view', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'parent-node' },
            });
            
            const result = selectors.getTreeNodeState(state, 'parent-node', null);
            expect(result).toBe('PARENT');
        });

        it('returns CHILD for other nodes in BRANCH view', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'parent-node' },
            });
            
            const result = selectors.getTreeNodeState(state, 'child-node', 'parent-node');
            expect(result).toBe('CHILD');
        });
    });

    describe('getDataCardState', () => {
        it('returns UNDER_CONSTRUCTION for node being constructed', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            
            const result = selectors.getDataCardState(state, 'new-node');
            expect(result).toBe('UNDER_CONSTRUCTION');
        });

        it('returns EXPANDED when nodeId is in expandedCards', () => {
            const state = createTestState({
                ui: {
                    expandedCards: new Set(['node-1']),
                    expandedFieldDetails: new Set(),
                    expandedNodeDetails: new Set(),
                },
            });
            
            const result = selectors.getDataCardState(state, 'node-1');
            expect(result).toBe('EXPANDED');
        });

        it('returns COLLAPSED when nodeId is not in expandedCards', () => {
            const state = createTestState();
            
            const result = selectors.getDataCardState(state, 'node-1');
            expect(result).toBe('COLLAPSED');
        });
    });

    describe('getDataFieldState', () => {
        it('returns EDITING when field is being edited', () => {
            const state = createTestState({ editingFieldId: 'field-1' });
            
            const result = selectors.getDataFieldState(state, 'field-1');
            expect(result).toBe('EDITING');
        });

        it('returns DISPLAY when field is not being edited', () => {
            const state = createTestState({ editingFieldId: 'field-1' });
            
            const result = selectors.getDataFieldState(state, 'field-2');
            expect(result).toBe('DISPLAY');
        });

        it('returns DISPLAY when no field is being edited', () => {
            const state = createTestState();
            
            const result = selectors.getDataFieldState(state, 'field-1');
            expect(result).toBe('DISPLAY');
        });
    });

    describe('getDataFieldDetailsState', () => {
        it('returns EXPANDED when fieldId is in expandedFieldDetails', () => {
            const state = createTestState({
                ui: {
                    expandedCards: new Set(),
                    expandedFieldDetails: new Set(['field-1']),
                    expandedNodeDetails: new Set(),
                },
            });
            
            const result = selectors.getDataFieldDetailsState(state, 'field-1');
            expect(result).toBe('EXPANDED');
        });

        it('returns COLLAPSED when fieldId is not in expandedFieldDetails', () => {
            const state = createTestState();
            
            const result = selectors.getDataFieldDetailsState(state, 'field-1');
            expect(result).toBe('COLLAPSED');
        });
    });

    describe('isRootView', () => {
        it('returns true for ROOT view', () => {
            const state = createTestState({ view: { state: 'ROOT' } });
            expect(selectors.isRootView(state)).toBe(true);
        });

        it('returns false for BRANCH view', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
            });
            expect(selectors.isRootView(state)).toBe(false);
        });
    });

    describe('getCurrentNodeId', () => {
        it('returns null for ROOT view', () => {
            const state = createTestState({ view: { state: 'ROOT' } });
            expect(selectors.getCurrentNodeId(state)).toBeNull();
        });

        it('returns nodeId for BRANCH view', () => {
            const state = createTestState({
                view: { state: 'BRANCH', nodeId: 'node-1' },
            });
            expect(selectors.getCurrentNodeId(state)).toBe('node-1');
        });
    });

    describe('isUnderConstruction', () => {
        it('returns true when nodeId matches underConstruction', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            expect(selectors.isUnderConstruction(state, 'new-node')).toBe(true);
        });

        it('returns false when nodeId does not match', () => {
            const state = createTestState({
                underConstruction: {
                    id: 'new-node',
                    parentId: null,
                    nodeName: '',
                    nodeSubtitle: '',
                    defaultFields: [],
                },
            });
            expect(selectors.isUnderConstruction(state, 'other-node')).toBe(false);
        });

        it('returns false when not constructing', () => {
            const state = createTestState();
            expect(selectors.isUnderConstruction(state, 'any-node')).toBe(false);
        });
    });
});

describe('State Invariants', () => {
    it('only one field can be editing at a time', () => {
        const state = createTestState();
        
        transitions.startFieldEdit(state, 'field-1');
        expect(state.editingFieldId).toBe('field-1');
        
        transitions.startFieldEdit(state, 'field-2');
        expect(state.editingFieldId).toBe('field-2');
        
        // field-1 is no longer editing
        expect(selectors.getDataFieldState(state, 'field-1')).toBe('DISPLAY');
        expect(selectors.getDataFieldState(state, 'field-2')).toBe('EDITING');
    });

    it('navigation clears editing state', () => {
        const state = createTestState({ editingFieldId: 'field-1' });
        
        transitions.navigateToNode(state, 'node-1');
        expect(state.editingFieldId).toBeNull();
    });

    it('cannot start multiple constructions', () => {
        const state = createTestState();
        
        transitions.startConstruction(state, {
            id: 'first',
            parentId: null,
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: [],
        });
        
        transitions.startConstruction(state, {
            id: 'second',
            parentId: null,
            nodeName: '',
            nodeSubtitle: '',
            defaultFields: [],
        });
        
        expect(state.underConstruction?.id).toBe('first');
    });

    it('construction blocks all navigation', () => {
        const state = createTestState({
            view: { state: 'BRANCH', nodeId: 'node-1' },
            underConstruction: {
                id: 'new-node',
                parentId: 'node-1',
                nodeName: '',
                nodeSubtitle: '',
                defaultFields: [],
            },
        });
        
        // Try all navigation methods
        transitions.navigateToNode(state, 'other-node');
        expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
        
        transitions.navigateUp(state, null);
        expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
        
        transitions.navigateToRoot(state);
        expect(state.view).toEqual({ state: 'BRANCH', nodeId: 'node-1' });
    });
});

