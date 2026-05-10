/**
 * useRootViewData - Hook for loading root nodes data.
 * 
 * Extracts root nodes loading logic from RootView to eliminate duplication
 * and enable reuse. Provides loading state and reload functionality.
 * 
 * Usage:
 * ```tsx
 * const { nodes, isLoading, reload$ } = useRootViewData();
 * ```
 */

import { useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { getNodeQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import type { TreeNode } from '../data/models';
import { useStorageChangeListener } from './useStorageChangeListener';
import { useAsyncOperation, runAsync } from './useAsyncOperation';

export function useRootViewData() {
    const nodes = useSignal<TreeNode[]>([]);
    const op = useAsyncOperation();

    const load$ = $(async () => {
        // Awaiting init here closes the race where this hook's task fires
        // before initializeQueries() has run; without it, getNodeQueries()
        // throws, runAsync swallows it, and the UI sits empty until the next
        // storage-change event (which on cold reload only arrives after the
        // first Firestore pull — multiple seconds on slow mobile networks).
        await initializeStorage();
        await runAsync(op, async () => {
            const fetchedNodes = await getNodeQueries().getRootNodes();
            nodes.value = fetchedNodes;
        });
    });

    useVisibleTask$(async () => {
        await load$();
    });

    useStorageChangeListener($(() => {
        console.log('[useRootViewData] Storage change detected, reloading...');
        load$();
    }));

    return { nodes, isLoading: op.isLoading, reload$: load$ };
}
