/**
 * Application State Transitions
 * 
 * This module defines all state transition functions following the FSM pattern.
 * Transitions are guarded and ensure invalid states are impossible.
 */

import type { AppState, UnderConstructionData } from './appState.types';
import { saveUIPrefs } from './uiPrefs';

/**
 * Navigation Transitions
 * 
 * Valid transitions:
 *   ROOT → BRANCH(nodeId)     [navigateToNode]
 *   BRANCH → BRANCH(childId)  [navigateToNode]
 *   BRANCH → BRANCH(parentId) [navigateUp]
 *   BRANCH → ROOT             [navigateUp when at root-level node]
 *   * → ROOT                  [navigateToRoot]
 */
export const transitions = {
    /**
     * Navigate into a node (ROOT→BRANCH or BRANCH→BRANCH)
     */
    navigateToNode: (state: AppState, nodeId: string): void => {
        // Guard: can't navigate while under construction
        if (state.underConstruction) return;
        
        // Push current to history if in BRANCH view
        if (state.view.state === 'BRANCH') {
            state.history = [...state.history, state.view.nodeId];
        }
        
        // Transition to BRANCH view
        state.view = { state: 'BRANCH', nodeId };
        
        // Clear any editing state
        state.editingFieldId = null;
    },

    /**
     * Navigate up (BRANCH→BRANCH or BRANCH→ROOT)
     */
    navigateUp: (state: AppState, parentId: string | null): void => {
        // Guard: only valid from BRANCH view
        if (state.view.state !== 'BRANCH') return;
        
        // Guard: can't navigate while under construction
        if (state.underConstruction) return;
        
        if (parentId === null) {
            // Transition to ROOT
            state.view = { state: 'ROOT' };
            state.history = [];
        } else {
            // Transition to parent's BRANCH
            state.view = { state: 'BRANCH', nodeId: parentId };
            // Pop history
            state.history = state.history.slice(0, -1);
        }
        
        // Clear any editing state
        state.editingFieldId = null;
    },

    /**
     * Navigate directly to ROOT view
     */
    navigateToRoot: (state: AppState): void => {
        // Guard: can't navigate while under construction
        if (state.underConstruction) return;
        
        state.view = { state: 'ROOT' };
        state.history = [];
        state.editingFieldId = null;
    },

    /**
     * Start creating a new node
     */
    startConstruction: (state: AppState, data: NonNullable<UnderConstructionData>): void => {
        // Guard: can't start if already constructing
        if (state.underConstruction) return;
        
        state.underConstruction = data;
    },

    /**
     * Cancel node construction
     */
    cancelConstruction: (state: AppState): void => {
        state.underConstruction = null;
    },

    /**
     * Complete node construction (called after save)
     */
    completeConstruction: (state: AppState): void => {
        state.underConstruction = null;
    },

    /**
     * Toggle card expansion (DataCard: COLLAPSED ↔ EXPANDED)
     */
    toggleCardExpanded: (state: AppState, nodeId: string): void => {
        const newSet = new Set(state.ui.expandedCards);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        state.ui.expandedCards = newSet;
        
        // Persist
        saveUIPrefs({
            expandedCards: state.ui.expandedCards,
            expandedFieldDetails: state.ui.expandedFieldDetails,
        });
    },

    /**
     * Toggle field details expansion (DataFieldDetails: COLLAPSED ↔ EXPANDED)
     */
    toggleFieldDetailsExpanded: (state: AppState, fieldId: string): void => {
        const newSet = new Set(state.ui.expandedFieldDetails);
        if (newSet.has(fieldId)) {
            newSet.delete(fieldId);
        } else {
            newSet.add(fieldId);
        }
        state.ui.expandedFieldDetails = newSet;
        
        // Persist
        saveUIPrefs({
            expandedCards: state.ui.expandedCards,
            expandedFieldDetails: state.ui.expandedFieldDetails,
        });
    },

    /**
     * Start editing a field (DataField: DISPLAY → EDITING)
     */
    startFieldEdit: (state: AppState, fieldId: string): void => {
        // Per SPEC: "If another DataField is already editing, it is cancelled"
        state.editingFieldId = fieldId;
    },

    /**
     * Stop editing a field (DataField: EDITING → DISPLAY)
     */
    stopFieldEdit: (state: AppState): void => {
        state.editingFieldId = null;
    },
};
