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
import type { TreeNode } from '../data/models';
import { useStorageChangeListener } from './useStorageChangeListener';
import { useAsyncOperation, runAsync } from './useAsyncOperation';

export function useRootViewData() {
    const nodes = useSignal<TreeNode[]>([]);
    const op = useAsyncOperation();

    const load$ = $(async () => {
        console.log('[useRootViewData] load$ called');
        await runAsync(op, async () => {
            const fetchedNodes = await getNodeQueries().getRootNodes();
            console.log('[useRootViewData] Fetched', fetchedNodes.length, 'root nodes');
            nodes.value = fetchedNodes;
            console.log('[useRootViewData] nodes.value set to', nodes.value.length, 'nodes');
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
