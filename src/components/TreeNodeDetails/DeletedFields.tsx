/**
 * DeletedFields — the restore list, a band inside the node's Node Tools band.
 *
 * A soft-deleted Field is invisible the moment the delete's undo window closes;
 * the data model and the command bus have both supported bringing it back all
 * along (`RESTORE_ELEMENT` is what every delete's Undo already runs), so this is
 * UI over an existing command, not new storage work.
 *
 * **It is a `DetailBands` band, not a bespoke region.** The whole of ISSUES #56
 * is that a recycle bin should look and act like the history/restore UI the app
 * already has, and the closest thing to a guarantee of that is rendering the
 * same components: the band chrome comes from `DetailBands` (heading, chevron,
 * persisted open state) and the rows follow `DataFieldHistory` — tap a row to
 * select it, and its action appears in the left gutter. A list of tombstones
 * should not read as a column of buttons.
 *
 * `present` is what keeps it invisible on a clean node: no deleted Fields means
 * `DetailBands` filters the band out entirely, heading and all, so the node's
 * Tools band is just its delete action as before.
 *
 * Fields only. A deleted child *node* is a bigger question — it takes its own
 * subtree with it — and nothing has asked for it.
 */

import { For, Show, createSignal } from 'solid-js';
import { useDeletedFields } from '../../hooks/useElementChildren';
import { DetailBands, type DetailBand } from '../DetailBands/DetailBands';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { formatTimestampShort } from '../../utils/time';
import styles from './TreeNodeDetails.module.css';

export type DeletedFieldsProps = {
    nodeId: string;
};

export const DeletedFields = (props: DeletedFieldsProps) => {
    const { deleted } = useDeletedFields(() => props.nodeId);
    const [selectedId, setSelectedId] = createSignal<string | null>(null);

    const toggleSelect = (id: string) => setSelectedId(selectedId() === id ? null : id);

    /** Undo is the delete again — the same pair the Snackbar has always run,
     *  in the other order. */
    const restore = (id: string) => {
        // Clear first: the row is about to leave the list, and a stale selection
        // would light up whichever row takes its place.
        setSelectedId(null);
        void commitWithUndo({
            message: 'Field restored',
            execute: () => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id } }),
            undo: () => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id } }),
        });
    };

    const bands = (): DetailBand[] => [
        {
            id: 'deleted-fields',
            title: 'Deleted Fields',
            present: deleted().length > 0,
            collapsible: true,
            // Open by default. The band's mere presence is already the signal
            // that something is deleted, so a second tap to reveal what would
            // buy nothing — and getting here already cost opening the panel and
            // the Node Tools band. It still has its own chevron to shut.
            defaultOpen: true,
            body: () => (
                <div class={styles.deletedList} role="list" aria-label="Deleted fields">
                    <For each={deleted()}>
                        {(field) => {
                            const isSelected = () => selectedId() === field.id;
                            return (
                                <div
                                    classList={{
                                        [styles.deletedRow]: true,
                                        [styles.deletedRowSelected]: isSelected(),
                                    }}
                                    role="listitem"
                                    onClick={() => toggleSelect(field.id)}
                                >
                                    <Show when={isSelected()}>
                                        <button
                                            type="button"
                                            class={styles.restoreButton}
                                            aria-label={`Restore ${field.name}`}
                                            title="Restore this field"
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                restore(field.id);
                                            }}
                                        >
                                            ↺
                                        </button>
                                    </Show>
                                    <span class={styles.deletedName}>{field.name}</span>
                                    {/* `updatedBy` is who deleted it: the delete
                                        write stamped the row. Same pairing the
                                        history rows show. */}
                                    <span class={styles.deletedMeta}>
                                        {formatTimestampShort(field.deletedAt ?? 0)} {field.updatedBy}
                                    </span>
                                </div>
                            );
                        }}
                    </For>
                </div>
            ),
        },
    ];

    return <DetailBands bands={bands()} persistKey={props.nodeId} />;
};
