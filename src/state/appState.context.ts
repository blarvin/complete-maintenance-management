/**
 * Application State Context Provider
 * 
 * This module provides the React Context for AppState and hooks for accessing it.
 */

import { createContextId, useContext, useContextProvider, useStore, $ } from '@builder.io/qwik';
import type { AppState, UnderConstructionData } from './appState.types';
import { createInitialState } from './appState.types';
import { transitions } from './appState.transitions';

export const AppStateContext = createContextId<AppState>('app.state');

export function useProvideAppState() {
    const state = useStore<AppState>(createInitialState(), { deep: true });
    useContextProvider(AppStateContext, state);
    return state;
}

export function useAppState() {
    return useContext(AppStateContext);
}

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

        toggleNodeDetailsExpanded$: $((nodeId: string) => {
            transitions.toggleNodeDetailsExpanded(state, nodeId);
        }),

        startFieldEdit$: $((fieldId: string) => {
            transitions.startFieldEdit(state, fieldId);
        }),
        
        stopFieldEdit$: $(() => {
            transitions.stopFieldEdit(state);
        }),
    };
}
