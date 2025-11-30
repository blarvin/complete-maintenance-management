/**
 * Hook for loading persisted DataFields for a TreeNode.
 * Extracted from TreeNode to enable reuse and testing.
 */

import { useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { listFieldsForNode } from '../../data/repo/dataFields';
import type { DataField } from '../../data/models';

export type UseTreeNodeFieldsOptions = {
    nodeId: string;
    enabled: boolean; // Set false for under-construction mode
};

export function useTreeNodeFields(options: UseTreeNodeFieldsOptions) {
    const fields = useSignal<DataField[] | null>(null);
    const isLoading = useSignal<boolean>(false);

    useVisibleTask$(async ({ track }) => {
        const nodeId = track(() => options.nodeId);
        const enabled = track(() => options.enabled);

        if (!enabled) {
            fields.value = null;
            return;
        }

        isLoading.value = true;
        fields.value = await listFieldsForNode(nodeId);
        isLoading.value = false;
    });

    return { fields, isLoading };
}
