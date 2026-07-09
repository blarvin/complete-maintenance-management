/**
 * App — root Solid component.
 *
 * Provides the appState store/actions via context, initializes IDB storage and
 * the SyncManager on mount (the old useInitStorage body), and hosts the global
 * snackbar. Renders RootView/BranchView off the FSM view state (Phase II).
 */

import { onMount, Show } from 'solid-js';
import { createAppState, AppStateContext, selectors } from './state/appState';
import { initializeStorage } from './data/storage/initStorage';
import { getCommandBus, type Command } from './data/commands';
import { getElementQueries } from './data/queries';
import { SnackbarHost } from './components/Snackbar/SnackbarHost';
import { RootView } from './components/views/RootView';
import { BranchView } from './components/views/BranchView';

export const App = () => {
    const appState = createAppState();

    onMount(async () => {
        // Initialize storage
        await initializeStorage();

        if (import.meta.env.DEV) {
            // Phase II migration-verification tooling: creation surfaces land in Phase IV,
            // so expose the command bus for console seeding. TODO(mop-up): remove.
            (window as unknown as Record<string, unknown>).__cmm = {
                execute: (cmd: Command) => getCommandBus().execute(cmd),
                queries: () => getElementQueries(),
            };
        }

        // Log service worker registration status. Not awaited: `ready` only
        // resolves once a SW activates, and dev never registers one (the old
        // Qwik dev server did) — an inline await would block the logs below.
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(
                (registration) => console.log('[App] ServiceWorker registered:', registration.scope),
                (err) => console.error('[App] ServiceWorker registration check failed:', err),
            );
        } else {
            console.warn('[App] ServiceWorker not supported in this browser');
        }

        // Log initial network state and set up listeners
        if (typeof navigator !== 'undefined') {
            console.log('[App] Initial network state:', navigator.onLine ? 'ONLINE' : 'OFFLINE');

            window.addEventListener('online', () => {
                console.log('[App] Network: ONLINE');
            });

            window.addEventListener('offline', () => {
                console.log('[App] Network: OFFLINE');
            });
        }
    });

    return (
        <AppStateContext.Provider value={appState}>
            <Show
                when={selectors.isRootView(appState.state)}
                fallback={<BranchView parentId={selectors.getCurrentNodeId(appState.state)!} />}
            >
                <RootView />
            </Show>
            <SnackbarHost />
        </AppStateContext.Provider>
    );
};
