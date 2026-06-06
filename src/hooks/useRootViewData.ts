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
import { getElementQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { elementToTreeNode, type TreeNode } from '../data/models';
import { useStorageChangeListener } from './useStorageChangeListener';
import { useAsyncOperation, runAsync } from './useAsyncOperation';

export function useRootViewData() {
    const nodes = useSignal<TreeNode[]>([]);
    const op = useAsyncOperation();

    const load$ = $(async () => {
        await initializeStorage();
        await runAsync(op, async () => {
            const roots = await getElementQueries().getRootElements();
            nodes.value = roots.filter(e => e.kind === 'node').map(elementToTreeNode);
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
