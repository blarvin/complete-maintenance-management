/**
 * useValueSlot — the wiring every `useFieldEdit`-driven renderer repeats.
 *
 * Five renderers (`text-kv`, `number-kv`, `single-image`, `internal-link`,
 * `external-link`) each restated the same four options into `useFieldEdit` —
 * `props.id` → `fieldId`, `props.value` → `initialValue`, `props.rootRef`,
 * `props.pendingMode` — then called `useFieldValueSync` with the setter it
 * handed back, each behind its own `solid/reactivity` disable. Only the codec
 * differs by kind, so that is all a renderer passes now.
 *
 * Eleven `solid/reactivity` disables go with it — see the note at the reads.
 *
 * `enum-kv` is deliberately absent — its popover is its own state machine over
 * the same FSM seams, with no text buffer to parse. What it *does* share is the
 * commit branch, which is `commitFieldValue`, not this.
 */

import type { Accessor } from 'solid-js';
import { useFieldEdit, type UseFieldEditResult } from './useFieldEdit';
import { useFieldValueSync } from './useFieldValueSync';
import type { DataFieldValue } from '../data/models';
import type { PendingMode } from '../kinds/types';

/** The subset of a renderer's props this hook reads. Every value-bearing
 *  renderer's props are a superset of it, so callers pass `props` whole. */
export type ValueSlotProps<T extends DataFieldValue> = {
    id: string;
    value: T | null;
    rootRef: Accessor<HTMLElement | undefined>;
    pendingMode?: PendingMode<T>;
};

/** The per-kind half: how this kind's value reads as text and back again. */
export type ValueCodec<T extends DataFieldValue> = {
    /** Render T | null to the display/edit string. */
    format: (value: T | null) => string;
    /** Parse the raw edit input to T | null (null for empty). Throw to reject. */
    parse: (raw: string) => T | null;
    /** Optional post-parse validation (throw to reject). Runs before commit. */
    validate?: (value: T | null) => void;
};

export function useValueSlot<T extends DataFieldValue>(
    props: ValueSlotProps<T>,
    codec: ValueCodec<T>,
): UseFieldEditResult<T> {
    // The props reads below are mount-time constants: a row remounts per field
    // (`<For>` reference-keyed) and a draft row per config identity (`<Show
    // keyed>`), so nothing here needs to track. `solid/reactivity` does not
    // reach into a plain helper like this one, which is why the callers'
    // disables could go rather than move — the invariant is stated here instead.
    const edit = useFieldEdit<T>({
        fieldId: props.id,
        initialValue: props.value,
        format: codec.format,
        parse: codec.parse,
        validate: codec.validate,
        rootRef: props.rootRef,
        pendingMode: props.pendingMode,
    });

    useFieldValueSync<T>(props.id, edit.setCurrentValue);

    return edit;
}
