/**
 * useBranchViewData - Hook for loading parent node and children data.
 * 
 * Extracts parent + children loading logic from BranchView to eliminate duplication
 * and enable reuse. Handles construction cancellation when loading.
 * 
 * The component must track props.parentId and call load$ when it changes.
 * This is necessary because Qwik's track() only works on reactive props, not function parameters.
 * 
 * Usage:
 * ```tsx
 * const { parentNode, children, isLoading, load$ } = useBranchViewData();
 * useTask$(async ({ track }) => {
 *   const id = track(() => props.parentId);
 *   if (id) await load$(id);
 * });
 * ```
 */

import { useSignal, $ } from '@builder.io/qwik';
import { getNodeService } from '../data/services';
import { useAppState, useAppTransitions } from '../state/appState';
import type { TreeNode } from '../data/models';

export function useBranchViewData() {
    const parentNode = useSignal<TreeNode | null>(null);
    const children = useSignal<TreeNode[]>([]);
    const isLoading = useSignal(false);

    const appState = useAppState();
    const { cancelConstruction$ } = useAppTransitions();

    const load$ = $(async (id: string) => {
        if (!id) return;

        // Cancel construction when navigating (maintain existing behavior)
        if (appState.underConstruction) {
            cancelConstruction$();
        }

        isLoading.value = true;
        try {
            const result = await getNodeService().getNodeWithChildren(id);
            parentNode.value = result.node;
            children.value = result.children;
        } finally {
            isLoading.value = false;
        }
    });

    // Reload function that accepts current parentId
    // Component should pass props.parentId when calling this
    const reload$ = load$;

    return {
        parentNode,
        children,
        isLoading,
        load$,
        reload$,
    };
}
