/**
 * Navigation Guards
 *
 * Reusable predicates for transition preconditions.
 * Each guard returns `true` when the transition is allowed.
 */

import type { AppState } from './appState.types';

export const guards = {
    /** Navigation is blocked while a node is under construction. */
    notUnderConstruction: (state: AppState): boolean => !state.underConstruction,

    /** Only valid when currently in BRANCH view. */
    inBranchView: (state: AppState): boolean => state.view.state === 'BRANCH',
};
