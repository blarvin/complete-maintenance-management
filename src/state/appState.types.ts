/**
 * Application State Type Definitions
 * 
 * This module defines all types and interfaces for the application state.
 */

import { loadUIPrefs } from './uiPrefs';
import type { Kind } from '../data/models';

// Re-export TreeNode state types from the canonical source
export type { TreeNodeState, DisplayNodeState } from '../components/TreeNode/types';

/**
 * View States - Which view is currently active
 */
export type ViewState =
    | { state: 'ROOT' }
    | { state: 'BRANCH'; elementId: string };

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
 * Under-construction element data. Phase 1: only `kind: "node"` reaches this
 * state; value-bearing kinds are minted via CREATE_ELEMENT_FROM_DEFINITION
 * with no construction step.
 */
export type UnderConstructionData = {
    id: string;
    parentId: string | null;
    kind: Kind;
    name: string;
    subtitle: string;
} | null;

/**
 * UI State - Persisted preferences. All sets are keyed by elementId.
 */
export type UIState = {
    expandedCards: Set<string>;        // container elementId -> card is expanded
    expandedFieldDetails: Set<string>; // field elementId -> details are expanded
    expandedNodeDetails: Set<string>;  // container elementId -> node details panel is expanded
    /**
     * `${persistKey}:${bandId}` -> this band's open state is flipped from its
     * working default. Not keyed by elementId alone: one host row has several
     * bands, and the Add Surface's key is per-node rather than per-element
     * because its draft row has no persistent identity (see DetailBands).
     */
    toggledBands: Set<string>;
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
    
    // Currently editing element (only one at a time per SPEC)
    editingElementId: string | null;
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
            toggledBands: prefs.toggledBands,
        },
        editingElementId: null,
    };
}
