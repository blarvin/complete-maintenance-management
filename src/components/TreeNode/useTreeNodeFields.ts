/**
 * Hook for loading persisted DataFields for a TreeNode.
 * Extracted from TreeNode to enable reuse and testing.
 * 
 * Uses useTask$ to sync props to signals, then useVisibleTask$ to load data
 * when those signals change. This ensures fields reload when nodeId changes
 * during navigation.
 */

import { useSignal, useTask$, useVisibleTask$, $ } from '@builder.io/qwik';
import { getFieldService } from '../../data/services';
import type { DataField } from '../../data/models';

export type UseTreeNodeFieldsOptions = {
    nodeId: string;
    enabled: boolean; // Set false for under-construction mode
};

export function useTreeNodeFields(options: UseTreeNodeFieldsOptions) {
    const fields = useSignal<DataField[] | null>(null);
    const isLoading = useSignal<boolean>(false);
    
    // Store nodeId in a signal so useVisibleTask$ can track it
    const currentNodeId = useSignal<string>(options.nodeId);
    const currentEnabled = useSignal<boolean>(options.enabled);
    
    // Version counter to trigger reload - increments when props change
    const loadVersion = useSignal<number>(0);

    // Sync props to signals during render (runs on every render)
    // This detects prop changes and bumps the version to trigger reload
    useTask$(() => {
        // These tracks ensure the task re-runs when the hook is called with new options
        const newNodeId = options.nodeId;
        const newEnabled = options.enabled;

        if (currentNodeId.value !== newNodeId || currentEnabled.value !== newEnabled) {
            currentNodeId.value = newNodeId;
            currentEnabled.value = newEnabled;
            loadVersion.value++;  // Trigger reload
        }
    });

    // Reload function to refresh fields (e.g., after deletion)
    // Defined before useVisibleTask$ so it can be referenced in the event handler
    const reload$ = $(async () => {
        if (!currentEnabled.value) return;
        isLoading.value = true;
        fields.value = await getFieldService().getFieldsForNode(currentNodeId.value);
        isLoading.value = false;
    });

    // Load fields when version changes (client-only for Firebase access)
    useVisibleTask$(async ({ track, cleanup }) => {
        // Track the version to react to prop changes
        track(() => loadVersion.value);
        const nodeId = currentNodeId.value;
        const enabled = currentEnabled.value;

        if (!enabled) {
            fields.value = null;
            return;
        }

        isLoading.value = true;
        fields.value = await getFieldService().getFieldsForNode(nodeId);
        isLoading.value = false;
        
        // Listen for storage change events (triggered by sync or other storage operations)
        if (typeof window !== 'undefined') {
            const handleStorageChange = () => {
                if (currentEnabled.value) {
                    console.log('[useTreeNodeFields] Storage change detected, reloading fields...');
                    reload$();
                }
            };
            
            window.addEventListener('storage-change', handleStorageChange);
            
            cleanup(() => {
                window.removeEventListener('storage-change', handleStorageChange);
            });
        }
    });

    return { fields, isLoading, reload$ };
}
