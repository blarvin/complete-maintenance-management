/**
 * Application State - FSM-patterned centralized state management
 * 
 * This module defines the application state as a finite state machine.
 * States are explicit, transitions are guarded, and invalid states are impossible.
 */

import { createContextId, useContext, useContextProvider, useStore, $ } from '@builder.io/qwik';
import { loadUIPrefs, saveUIPrefs } from './uiPrefs';

// ============================================================================
// STATE DEFINITIONS
// ============================================================================

/**
 * View States - Which view is currently active
 */
export type ViewState = 
    | { state: 'ROOT' }
    | { state: 'BRANCH'; nodeId: string };

/**
 * TreeNode States - Per SPEC state machine
 * Note: These are computed from ViewState + node position, not stored directly
 */
export type TreeNodeState = 
    | 'ROOT'              // Top-level node in ROOT view
    | 'PARENT'            // Current node at top of BRANCH view
    | 'CHILD'             // Child node in BRANCH view
    | 'UNDER_CONSTRUCTION'; // New node being created

/**
 * DataCard States
 */
export type DataCardState = 
    | 'COLLAPSED'
    | 'EXPANDED'
    | 'UNDER_CONSTRUCTION';

/**
 * DataField States
 */
export type DataFieldState = 
    | 'DISPLAY'
    | 'EDITING';

/**
 * DataFieldDetails States (metadata section)
 */
export type DataFieldDetailsState = 
    | 'COLLAPSED'
    | 'EXPANDED';

/**
 * Under-construction node data
 */
export type UnderConstructionData = {
    id: string;
    parentId: string | null;
    nodeName: string;
    nodeSubtitle: string;
    defaultFields: { fieldName: string; fieldValue: string | null }[];
} | null;

/**
 * UI State - Persisted preferences
 */
export type UIState = {
    expandedCards: Set<string>;        // nodeId -> card is expanded
    expandedFieldDetails: Set<string>; // fieldId -> details are expanded
};

/**
 * Root Application State
 */
export type AppState = {
    // Current view (FSM state)
    view: ViewState;
    
    // Navigation history for back navigation
    history: string[];
    
    // Under-construction state (when creating a new node)
    underConstruction: UnderConstructionData;
    
    // UI preferences (persisted)
    ui: UIState;
    
    // Currently editing field (only one at a time per SPEC)
    editingFieldId: string | null;
};

// ============================================================================
// INITIAL STATE
// ============================================================================

function createInitialState(): AppState {
    const prefs = loadUIPrefs();
    return {
        view: { state: 'ROOT' },
        history: [],
        underConstruction: null,
        ui: {
            expandedCards: prefs.expandedCards,
            expandedFieldDetails: prefs.expandedFieldDetails,
        },
        editingFieldId: null,
    };
}

// ============================================================================
// STATE TRANSITIONS (FSM Pattern)
// ============================================================================

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

// ============================================================================
// STATE SELECTORS (Derived State)
// ============================================================================

export const selectors = {
    /**
     * Get the TreeNode state for a given node
     */
    getTreeNodeState: (
        appState: AppState,
        nodeId: string,
        nodeParentId: string | null
    ): TreeNodeState => {
        // Under construction check
        if (appState.underConstruction?.id === nodeId) {
            return 'UNDER_CONSTRUCTION';
        }
        
        // In ROOT view, all nodes are ROOT state
        if (appState.view.state === 'ROOT') {
            return 'ROOT';
        }
        
        // In BRANCH view
        if (appState.view.nodeId === nodeId) {
            return 'PARENT';
        }
        
        return 'CHILD';
    },

    /**
     * Get the DataCard state for a given node
     */
    getDataCardState: (appState: AppState, nodeId: string): DataCardState => {
        if (appState.underConstruction?.id === nodeId) {
            return 'UNDER_CONSTRUCTION';
        }
        return appState.ui.expandedCards.has(nodeId) ? 'EXPANDED' : 'COLLAPSED';
    },

    /**
     * Get the DataField state for a given field
     */
    getDataFieldState: (appState: AppState, fieldId: string): DataFieldState => {
        return appState.editingFieldId === fieldId ? 'EDITING' : 'DISPLAY';
    },

    /**
     * Get the DataFieldDetails state for a given field
     */
    getDataFieldDetailsState: (appState: AppState, fieldId: string): DataFieldDetailsState => {
        return appState.ui.expandedFieldDetails.has(fieldId) ? 'EXPANDED' : 'COLLAPSED';
    },

    /**
     * Check if we're in ROOT view
     */
    isRootView: (appState: AppState): boolean => {
        return appState.view.state === 'ROOT';
    },

    /**
     * Get current node ID (null if ROOT view)
     */
    getCurrentNodeId: (appState: AppState): string | null => {
        return appState.view.state === 'BRANCH' ? appState.view.nodeId : null;
    },

    /**
     * Check if a node is under construction
     */
    isUnderConstruction: (appState: AppState, nodeId: string): boolean => {
        return appState.underConstruction?.id === nodeId;
    },
};

// ============================================================================
// CONTEXT PROVIDER
// ============================================================================

export const AppStateContext = createContextId<AppState>('app.state');

export function useProvideAppState() {
    const state = useStore<AppState>(createInitialState(), { deep: true });
    useContextProvider(AppStateContext, state);
    return state;
}

export function useAppState() {
    return useContext(AppStateContext);
}

// ============================================================================
// TRANSITION HOOKS (For use in components)
// ============================================================================

/**
 * Hook that provides bound transition functions
 */
export function useAppTransitions() {
    const state = useAppState();
    
    return {
        navigateToNode$: $((nodeId: string) => {
            transitions.navigateToNode(state, nodeId);
        }),
        
        navigateUp$: $((parentId: string | null) => {
            transitions.navigateUp(state, parentId);
        }),
        
        navigateToRoot$: $(() => {
            transitions.navigateToRoot(state);
        }),
        
        startConstruction$: $((data: NonNullable<UnderConstructionData>) => {
            transitions.startConstruction(state, data);
        }),
        
        cancelConstruction$: $(() => {
            transitions.cancelConstruction(state);
        }),
        
        completeConstruction$: $(() => {
            transitions.completeConstruction(state);
        }),
        
        toggleCardExpanded$: $((nodeId: string) => {
            transitions.toggleCardExpanded(state, nodeId);
        }),
        
        toggleFieldDetailsExpanded$: $((fieldId: string) => {
            transitions.toggleFieldDetailsExpanded(state, fieldId);
        }),
        
        startFieldEdit$: $((fieldId: string) => {
            transitions.startFieldEdit(state, fieldId);
        }),
        
        stopFieldEdit$: $(() => {
            transitions.stopFieldEdit(state);
        }),
    };
}

