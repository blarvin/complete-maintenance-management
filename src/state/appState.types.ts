/**
 * Application State Type Definitions
 * 
 * This module defines all types and interfaces for the application state.
 */

import { loadUIPrefs } from './uiPrefs';

// Re-export TreeNode state types from the canonical source
export type { TreeNodeState, DisplayNodeState } from '../components/TreeNode/types';

/**
 * View States - Which view is currently active
 */
export type ViewState = 
    | { state: 'ROOT' }
    | { state: 'BRANCH'; nodeId: string };

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
    expandedNodeDetails: Set<string>;  // nodeId -> node details panel is expanded
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

/**
 * Create the initial application state
 */
export function createInitialState(): AppState {
    const prefs = loadUIPrefs();
    return {
        view: { state: 'ROOT' },
        history: [],
        underConstruction: null,
        ui: {
            expandedCards: prefs.expandedCards,
            expandedFieldDetails: prefs.expandedFieldDetails,
            expandedNodeDetails: prefs.expandedNodeDetails,
        },
        editingFieldId: null,
    };
}
