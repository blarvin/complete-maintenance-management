/**
 * Application State Context — Solid store + context.
 *
 * `createAppState()` builds the store and its bound actions; the provider JSX
 * lives in App.tsx (this file stays `.ts` so the test-reachable spine is
 * JSX-free — Vitest has no Solid transform).
 *
 * Each action wraps its transition in `setState(produce(...))` so multi-field
 * FSM writes stay atomic (never observable mid-transition) and all writes stay
 * funneled through the actions. The transitions mutate a draft `AppState`
 * directly and ship unchanged from the Qwik version — the Set-bearing toggles
 * already reassign fresh `Set` instances, which is exactly what Solid's
 * property-level tracking needs (Sets are never proxied).
 */

import { createContext, useContext } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import type { AppState, UnderConstructionData } from './appState.types';
import { createInitialState } from './appState.types';
import { transitions } from './appState.transitions';

export type AppActions = {
    navigateToNode: (elementId: string) => void;
    navigateUp: (parentId: string | null) => void;
    navigateToRoot: () => void;
    startConstruction: (data: NonNullable<UnderConstructionData>) => void;
    cancelConstruction: () => void;
    completeConstruction: () => void;
    toggleCardExpanded: (nodeId: string) => void;
    toggleFieldDetailsExpanded: (fieldId: string) => void;
    toggleNodeDetailsExpanded: (nodeId: string) => void;
    startFieldEdit: (fieldId: string) => void;
    stopFieldEdit: () => void;
};

export type AppStateContextValue = {
    state: AppState;
    actions: AppActions;
};

export function createAppState(): AppStateContextValue {
    const [state, setState] = createStore<AppState>(createInitialState());

    const actions: AppActions = {
        navigateToNode: (elementId) =>
            setState(produce((s) => transitions.navigateToNode(s, elementId))),
        navigateUp: (parentId) =>
            setState(produce((s) => transitions.navigateUp(s, parentId))),
        navigateToRoot: () =>
            setState(produce((s) => transitions.navigateToRoot(s))),
        startConstruction: (data) =>
            setState(produce((s) => transitions.startConstruction(s, data))),
        cancelConstruction: () =>
            setState(produce((s) => transitions.cancelConstruction(s))),
        completeConstruction: () =>
            setState(produce((s) => transitions.completeConstruction(s))),
        toggleCardExpanded: (nodeId) =>
            setState(produce((s) => transitions.toggleCardExpanded(s, nodeId))),
        toggleFieldDetailsExpanded: (fieldId) =>
            setState(produce((s) => transitions.toggleFieldDetailsExpanded(s, fieldId))),
        toggleNodeDetailsExpanded: (nodeId) =>
            setState(produce((s) => transitions.toggleNodeDetailsExpanded(s, nodeId))),
        startFieldEdit: (fieldId) =>
            setState(produce((s) => transitions.startFieldEdit(s, fieldId))),
        stopFieldEdit: () =>
            setState(produce((s) => transitions.stopFieldEdit(s))),
    };

    return { state, actions };
}

export const AppStateContext = createContext<AppStateContextValue>();

export function useAppState(): AppState {
    const ctx = useContext(AppStateContext);
    if (!ctx) {
        throw new Error('useAppState called outside <AppStateContext.Provider> — wrap the tree in App.tsx');
    }
    return ctx.state;
}

/**
 * Hook that provides the bound transition actions.
 */
export function useAppTransitions(): AppActions {
    const ctx = useContext(AppStateContext);
    if (!ctx) {
        throw new Error('useAppTransitions called outside <AppStateContext.Provider> — wrap the tree in App.tsx');
    }
    return ctx.actions;
}
