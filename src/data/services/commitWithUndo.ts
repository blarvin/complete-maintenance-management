/**
 * commitWithUndo — One helper for the repeated pattern:
 *   execute an action → success snackbar with an Undo button → on failure, an
 *   error snackbar via describeForUser(toStorageError(err)).
 *
 * The execute result is threaded into both the message builder and the undo
 * handler, so a discard/restore variant (FieldComposer cancel) can report a
 * count and restore the captured rows through the same path as the command
 * sites. Returns true if execute succeeded.
 */

import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../storage/storageErrors';

export type CommitWithUndoOptions = {
    /** The forward action (e.g. a command bus execute). Its return value is passed to undo/message. */
    execute: () => Promise<unknown> | unknown;
    /** Inverse action, given the execute result. Wired to the snackbar Undo button. */
    undo: (result: unknown) => Promise<void> | void;
    /** Static success message, or a fn of the execute result (return null to suppress the toast). */
    message: string | null | ((result: unknown) => string | null);
};

export async function commitWithUndo(opts: CommitWithUndoOptions): Promise<boolean> {
    try {
        const result = await opts.execute();
        const msg = typeof opts.message === 'function' ? opts.message(result) : opts.message;
        if (msg) {
            getSnackbarService().show({
                message: msg,
                action: {
                    label: 'Undo',
                    handler: async () => {
                        await opts.undo(result);
                    },
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
