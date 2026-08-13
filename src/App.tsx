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
import { SyncTargetBadge } from './components/SyncTargetBadge/SyncTargetBadge';
import { RootView } from './components/views/RootView';
import { BranchView } from './components/views/BranchView';
import { devLog } from './utils/devMode';

export const App = () => {
    const appState = createAppState();

    onMount(async () => {
        // Initialize storage
        await initializeStorage();

        // Log service worker registration status. Not awaited: `ready` only
        // resolves once a SW activates, and dev never registers one (the SW is
        // PROD-gated in entry.client.tsx) — an inline await would block.
        //
        // This is the one trace worth keeping here: the SW is the app's update
        // mechanism, and `preview:pwa` is the only place it runs. Network-state
        // logging used to live alongside it as two listeners with console.log
        // bodies; SyncLifecycle already logs the `online` transition it acts on,
        // which is the one that has consequences.
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(
                (registration) => devLog('[App] ServiceWorker registered:', registration.scope),
                (err) => console.error('[App] ServiceWorker registration check failed:', err),
            );
        } else {
            console.warn('[App] ServiceWorker not supported in this browser');
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
            {/* Before SnackbarHost on purpose — equal z-index, so the later
                element paints on top and a toast is never hidden. */}
            <SyncTargetBadge />
            <SnackbarHost />
        </AppStateContext.Provider>
    );
};
