/**
 * useFieldValueSync - Subscribe a renderer's currentValue setter to
 * ELEMENT_WRITTEN events for a specific element (field) id.
 *
 * Calls the setter directly from the event payload whenever a write
 * touches this element — including writes dispatched from sibling components
 * (e.g. revert from DataFieldHistory). Writes emit; readers subscribe — this
 * is the standard read model (see useElementChildren.ts), specialized here
 * to patch a single value signal straight from the event payload instead of
 * refetching.
 *
 * The renderer's edit buffer is a separate signal, so writes that arrive
 * during an in-progress edit don't disturb the user's input — only the
 * underlying committed value updates.
 *
 * Ported dormant in Phase II: its consumers are the five field renderers,
 * which arrive in Phase III. `fieldId` is non-reactive (as in Qwik) —
 * renderers mount per field. Nothing is tracked, so the subscription is
 * made at hook call and torn down via onCleanup.
 */

import { onCleanup } from 'solid-js';
import { storageEventBus } from '../data/storageEventBus';

export function useFieldValueSync<T>(
    fieldId: string,
    setValue: (value: T | null) => void,
) {
    const unsub = storageEventBus.subscribe((event) => {
        if (event.type !== 'ELEMENT_WRITTEN') return;
        if (event.element.id !== fieldId) return;
        setValue((event.element.value as T | null) ?? null);
    });
    onCleanup(() => unsub());
}
