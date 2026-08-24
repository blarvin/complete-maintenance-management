/**
 * commitFieldValue — the one decision every value-bearing renderer makes once a
 * new value is settled.
 *
 * A `pendingMode` row buffers: the value goes to its host and nothing reaches
 * the command bus, IDB or sync. A persisted row dispatches
 * `UPDATE_ELEMENT_VALUE` through `commitWithUndo`, so the write carries its own
 * inverse and a snackbar.
 *
 * Both `useFieldEdit` (five kinds) and `EnumKvField` (its own popover state
 * machine, deliberately not on the hook) used to spell this branch out
 * themselves, which is the only thing they had left in common.
 *
 * Returns whether the caller should adopt the value and leave edit mode —
 * always true for a buffered row, `commitWithUndo`'s own verdict otherwise.
 * The no-op gate (identical value skips the dispatch entirely) stays with the
 * caller: it needs the previous value in the caller's own terms, and only the
 * text-edit lifecycle can produce a save that changed nothing.
 */

import { getCommandBus } from '../commands';
import { commitWithUndo } from './commitWithUndo';
import type { DataFieldValue } from '../models';
import type { PendingMode } from '../../kinds/types';

export async function commitFieldValue<T extends DataFieldValue>(args: {
    fieldId: string;
    /** Restored by Undo. */
    prev: T | null;
    next: T | null;
    pendingMode?: PendingMode<T>;
}): Promise<boolean> {
    if (args.pendingMode) {
        await args.pendingMode.onChange(args.next);
        return true;
    }
    return commitWithUndo({
        message: 'Field updated',
        execute: () => getCommandBus().execute({
            type: 'UPDATE_ELEMENT_VALUE',
            payload: { id: args.fieldId, value: args.next },
        }),
        undo: () => getCommandBus().execute({
            type: 'UPDATE_ELEMENT_VALUE',
            payload: { id: args.fieldId, value: args.prev },
        }),
    });
}
