/**
 * App — root Solid component.
 *
 * Provides the appState store/actions via context, initializes IDB storage and
 * the SyncManager on mount (the old useInitStorage body), and hosts the global
 * snackbar. The view shell is a Phase I placeholder proving the store spine —
 * RootView/BranchView land in Phase II.
 */

import { onMount, Show } from 'solid-js';
import { createAppState, AppStateContext, selectors } from './state/appState';
import { initializeStorage } from './data/storage/initStorage';
import { SnackbarHost } from './components/Snackbar/SnackbarHost';

export const App = () => {
    const appState = createAppState();

    onMount(async () => {
        // Initialize storage
        await initializeStorage();

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
                fallback={<p>BRANCH view placeholder — {selectors.getCurrentNodeId(appState.state)} (Phase II)</p>}
            >
                <p>ROOT view placeholder (Phase II)</p>
            </Show>
            <SnackbarHost />
        </AppStateContext.Provider>
    );
};
