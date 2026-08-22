/**
 * DeletedFields — the restore list, in the node's details panel.
 *
 * A soft-deleted Field is invisible the moment the delete's undo window closes;
 * the data model and the command bus have both supported bringing it back all
 * along (`RESTORE_ELEMENT` is what every delete's Undo already runs), so this is
 * UI over an existing command, not new storage work.
 *
 * It lives here rather than as a band on the Data Card because a band would sit
 * empty on almost every card forever. This renders nothing at all when nothing
 * is deleted, so a node with a clean history looks exactly as it did.
 *
 * Fields only. A deleted child *node* is a bigger question — it takes its own
 * subtree with it — and nothing has asked for it.
 */

import { For, Show } from 'solid-js';
import { useDeletedFields } from '../../hooks/useElementChildren';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { formatTimestampShort } from '../../utils/time';
import styles from './TreeNodeDetails.module.css';

export type DeletedFieldsProps = {
    nodeId: string;
};

export const DeletedFields = (props: DeletedFieldsProps) => {
    const { deleted } = useDeletedFields(() => props.nodeId);

    /** Undo is the delete again — the same pair the Snackbar has always run,
     *  in the other order. */
    const restore = (id: string) =>
        void commitWithUndo({
            message: 'Field restored',
            execute: () => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id } }),
            undo: () => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id } }),
        });

    return (
        <Show when={deleted().length > 0}>
            <div class={styles.deletedRegion}>
                <div class={styles.deletedHeading}>Deleted fields</div>
                <For each={deleted()}>
                    {(field) => (
                        <div class={styles.deletedRow}>
                            <span class={styles.deletedName}>{field.name}</span>
                            <span class={styles.deletedStamp}>
                                {formatTimestampShort(field.deletedAt ?? 0)}
                            </span>
                            <button
                                type="button"
                                class={styles.restoreButton}
                                aria-label={`Restore ${field.name}`}
                                onClick={() => restore(field.id)}
                            >
                                Restore
                            </button>
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
};
