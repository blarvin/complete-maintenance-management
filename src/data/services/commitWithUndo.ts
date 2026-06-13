/**
 * commitWithUndo — One helper for the repeated pattern:
 *   execute an action → success snackbar with an Undo button → on failure, an
 *   error snackbar via describeForUser(toStorageError(err)).
 *
 * Plain async function (NOT a `$`-suffixed QRL): callers pass `$()` QRLs for
 * execute$/undo$, and passing those to a plain function is fine — the same way
 * snackbar action handlers were passed before. A `$`-suffixed name would make
 * the Qwik optimizer try to QRL-ify the whole options object (and its nested
 * QRLs that capture local ids), which it can't.
 *
 * The execute$ result is threaded into both the message builder and the undo
 * handler, so a discard/restore variant (FieldComposer cancel) can report a
 * count and restore the captured rows through the same path as the command
 * sites. Returns true if execute$ succeeded.
 */

import { $, type QRL } from '@builder.io/qwik';
import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../storage/storageErrors';

export type CommitWithUndoOptions = {
    /** The forward action (e.g. a command bus execute). Its return value is passed to undo$/message. */
    execute$: QRL<() => Promise<unknown> | unknown>;
    /** Inverse action, given the execute$ result. Wired to the snackbar Undo button. */
    undo$: QRL<(result: unknown) => Promise<void> | void>;
    /** Static success message, or a fn of the execute$ result (return null to suppress the toast). */
    message: string | null | ((result: unknown) => string | null);
};

export async function commitWithUndo(opts: CommitWithUndoOptions): Promise<boolean> {
    try {
        const result = await opts.execute$();
        const msg = typeof opts.message === 'function' ? opts.message(result) : opts.message;
        if (msg) {
            getSnackbarService().show({
                message: msg,
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await opts.undo$(result);
                    }),
                },
            });
        }
        return true;
    } catch (err) {
        getSnackbarService().show({
            variant: 'error',
            message: describeForUser(toStorageError(err)),
        });
        return false;
    }
}
