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
import { getElementQueries } from '../data/queries';
import { useAppState, useAppTransitions } from '../state/appState';
import { elementToTreeNode, type TreeNode } from '../data/models';
import { useAsyncOperation, runAsync } from './useAsyncOperation';

export function useBranchViewData() {
    const parentNode = useSignal<TreeNode | null>(null);
    const children = useSignal<TreeNode[]>([]);
    const op = useAsyncOperation();

    const appState = useAppState();
    const { cancelConstruction$ } = useAppTransitions();

    const load$ = $(async (id: string) => {
        if (!id) return;

        if (appState.underConstruction) {
            cancelConstruction$();
        }

        await runAsync(op, async () => {
            const q = getElementQueries();
            const [parentEl, childEls] = await Promise.all([
                q.getElementById(id),
                q.getChildren(id),
            ]);
            parentNode.value = parentEl && parentEl.kind === 'node' ? elementToTreeNode(parentEl) : null;
            children.value = childEls
                .filter(e => e.kind === 'node' && e.deletedAt === null)
                .map(elementToTreeNode);
        });
    });

    // Reload function that accepts current parentId
    // Component should pass props.parentId when calling this
    const reload$ = load$;

    return {
        parentNode,
        children,
        isLoading: op.isLoading,
        load$,
        reload$,
    };
}
