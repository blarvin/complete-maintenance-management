/**
 * useStorageChangeListener - Reusable hook for listening to storage-change events.
 *
 * Subscribes to the 'storage-change' custom event (dispatched by StorageEventBus)
 * and calls the provided callback. Cleans up on unmount.
 */

import { useVisibleTask$, type QRL } from '@builder.io/qwik';

export function useStorageChangeListener(callback: QRL<() => void>) {
    useVisibleTask$(({ cleanup }) => {
        if (typeof window === 'undefined') return;

        const handler = () => callback();
        window.addEventListener('storage-change', handler);
        cleanup(() => window.removeEventListener('storage-change', handler));
    });
}
