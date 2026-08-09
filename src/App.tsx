/**
 * App — root Solid component.
 *
 * Provides the appState store/actions via context, initializes IDB storage and
 * the SyncManager on mount, and hosts the global snackbar. Renders
 * RootView/BranchView off the FSM view state.
 */

import { onMount, Show } from 'solid-js';
import { createAppState, AppStateContext, selectors } from './state/appState';
import { initializeStorage } from './data/storage/initStorage';
import { SnackbarHost } from './components/Snackbar/SnackbarHost';
import { RootView } from './components/views/RootView';
import { BranchView } from './components/views/BranchView';

export const App = () => {
    const appState = createAppState();

    onMount(async () => {
        // Initialize storage
        await initializeStorage();

        // Log service worker registration status. Not awaited: `ready` only
        // resolves once a SW activates, and dev never registers one (the SW is
        // PROD-gated in entry.client.tsx) — an inline await would block the
        // logs below.
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
