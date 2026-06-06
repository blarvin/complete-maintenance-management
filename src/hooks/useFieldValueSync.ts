/**
 * useFieldValueSync - Subscribe a renderer's currentValue signal to
 * ELEMENT_WRITTEN events for a specific element (field) id.
 *
 * Updates the signal directly from the event payload whenever a write
 * touches this element — including writes dispatched from sibling components
 * (e.g. revert from DataFieldHistory). This bypasses the FieldList → props
 * → renderer reactivity chain, which doesn't reliably propagate in time
 * for cross-component writes.
 *
 * The renderer's edit buffer is a separate signal, so writes that arrive
 * during an in-progress edit don't disturb the user's input — only the
 * underlying committed value updates.
 */

import { useVisibleTask$, type Signal } from '@builder.io/qwik';
import { storageEventBus } from '../data/storageEventBus';

export function useFieldValueSync<T>(
    fieldId: string,
    currentValue: Signal<T | null>,
) {
    useVisibleTask$(({ cleanup }) => {
        const unsub = storageEventBus.subscribe((event) => {
            if (event.type !== 'ELEMENT_WRITTEN') return;
            if (event.element.id !== fieldId) return;
            currentValue.value = (event.element.value as T | null) ?? null;
        });
        cleanup(() => unsub());
    });
}
