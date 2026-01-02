/**
 * Application State - Main Entry Point
 * 
 * Re-exports all public APIs from the split modules.
 */

// Re-export types
export type {
    ViewState,
    DataCardState,
    DataFieldState,
    DataFieldDetailsState,
    UnderConstructionData,
    UIState,
    AppState,
    TreeNodeState,
    DisplayNodeState,
} from './appState.types';

// Re-export transitions
export { transitions } from './appState.transitions';

// Re-export selectors
export { selectors } from './appState.selectors';

// Re-export context and hooks
export {
    AppStateContext,
    useProvideAppState,
    useAppState,
    useAppTransitions,
} from './appState.context';
