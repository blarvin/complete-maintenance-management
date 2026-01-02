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
        isLoading.value = true;
        try {
            nodes.value = await getNodeService().getRootNodes();
        } finally {
            isLoading.value = false;
        }
    });

    useVisibleTask$(async () => {
        await load$();
    });

    return { nodes, isLoading, reload$: load$ };
}
