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
import { getNodeService } from '../data/services';
import type { TreeNode } from '../data/models';

export function useRootViewData() {
    const nodes = useSignal<TreeNode[]>([]);
    const isLoading = useSignal(false);

    const load$ = $(async () => {
        console.log('[useRootViewData] load$ called');
        isLoading.value = true;
        try {
            const fetchedNodes = await getNodeService().getRootNodes();
            // Log node count instead of full array to avoid console clutter
            console.log('[useRootViewData] Fetched', fetchedNodes.length, 'root nodes');
            nodes.value = fetchedNodes;
            console.log('[useRootViewData] nodes.value set to', nodes.value.length, 'nodes');
        } finally {
            isLoading.value = false;
        }
    });

    useVisibleTask$(async () => {
        await load$();
    });

    return { nodes, isLoading, reload$: load$ };
}
