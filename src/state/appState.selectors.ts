/**
 * Application State Selectors
 *
 * This module defines derived state selectors that compute values from AppState.
 */

import type { AppState, DataCardState, DataFieldState, DataFieldDetailsState } from './appState.types';
import type { TreeNodeState, DisplayNodeState } from './appState.types';

/**
 * TreeNodeDetails States
 */
export type TreeNodeDetailsState =
    | 'COLLAPSED'
    | 'EXPANDED';

export const selectors = {
    /**
     * Get the TreeNode state for a given node (includes UNDER_CONSTRUCTION)
     */
    getTreeNodeState: (
        appState: AppState,
        nodeId: string,
        _nodeParentId: string | null
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
     * Get the display state for a persisted node (never UNDER_CONSTRUCTION)
     * Use this for nodes from the data layer that can't be under construction.
     */
    getDisplayNodeState: (
        appState: AppState,
        nodeId: string,
    ): DisplayNodeState => {
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
     * Get the TreeNodeDetails state for a given node
     */
    getNodeDetailsState: (appState: AppState, nodeId: string): TreeNodeDetailsState => {
        return appState.ui.expandedNodeDetails.has(nodeId) ? 'EXPANDED' : 'COLLAPSED';
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
