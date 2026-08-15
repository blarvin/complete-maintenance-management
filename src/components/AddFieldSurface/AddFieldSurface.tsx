/**
 * AddFieldSurface — the DataCard's create affordance (SPEC → The Add Surface).
 *
 * Collapsed it is one quiet "+ Add Field" row; expanded it is the LibraryPicker.
 * Picking mints the DataField **immediately** — a real Element, in its final
 * place, unfilled — and leaves the picker open so the next pick is one tap away.
 * There is no batch and no Save: Undo is the reversal.
 *
 * Deliberately does **not** focus the minted row. Autofocus would fight the
 * picker staying open, would raise the keyboard on a phone mid-pick, and
 * contradicts the state itself: an unfilled field is a resting state, not a form
 * waiting to be completed.
 *
 * Ships as one of several roster entries (see ../FieldList/addFieldSurfaces),
 * so it shares the `activeSurface` mutex — opening it closes the others.
 */

import { Show, createSignal } from 'solid-js';
import { getCommandBus } from '../../data/commands';
import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../../data/storage/storageErrors';
import { LibraryPicker } from './LibraryPicker';
import type { ActiveSurface } from '../FieldList/addFieldSurfaces';
import type { Definition, Kind } from '../../data/models';
import type { Accessor } from 'solid-js';
import styles from './AddFieldSurface.module.css';

export type AddFieldSurfaceProps = {
    nodeId: string;
    /** Field kinds this node admits — `allowedChildKinds ∩ FIELD_KINDS`. */
    admittedKinds: Kind[];
    /** Max `siblingOrder` among already-persisted fields, read once when the picker opens. */
    baseOrder: number;
    activeSurface: Accessor<ActiveSurface>;
    setActiveSurface: (s: ActiveSurface) => void;
};

const SURFACE_ID = 'add-surface' as const;

/** Groups consecutive adds into one toast whose Undo reverses the whole run. */
const COALESCE_KEY = 'field-added';

export const AddFieldSurface = (props: AddFieldSurfaceProps) => {
    const isOpen = () => props.activeSurface() === SURFACE_ID;

    /** Ids minted since the current run began — what a coalesced Undo reverses. */
    const [batch, setBatch] = createSignal<string[]>([]);

    /**
     * Sibling order is counted locally rather than re-derived per pick.
     * `baseOrder` comes from FieldList's `fields()`, which reloads asynchronously
     * off the storage bus, so two quick picks would both read the same max and
     * land on the same order.
     */
    let nextOrder = 0;

    const open = () => {
        nextOrder = props.baseOrder + 1;
        setBatch([]);
        props.setActiveSurface(SURFACE_ID);
    };

    const close = () => props.setActiveSurface('none');

    const toggle = () => (isOpen() ? close() : open());

    const undoBatch = async () => {
        const bus = getCommandBus();
        for (const id of batch()) {
            await bus.execute({ type: 'DELETE_ELEMENT', payload: { id } });
        }
        setBatch([]);
    };

    /**
     * Written out rather than routed through `commitWithUndo`, which models one
     * action with one inverse. Here the inverse accumulates: the toast reports a
     * running count and its Undo has to reverse every pick in the run, so the
     * batch has to be extended *before* the message and action are built.
     */
    const pick = async (definition: Definition) => {
        const siblingOrder = nextOrder++;
        try {
            const created = await getCommandBus().execute({
                type: 'CREATE_ELEMENT_FROM_DEFINITION',
                payload: { parentId: props.nodeId, definitionId: definition.id, siblingOrder },
            });
            const ids = [...batch(), created.id];
            setBatch(ids);
            getSnackbarService().show({
                message: ids.length === 1 ? 'Field added' : `${ids.length} fields added`,
                coalesceKey: COALESCE_KEY,
                action: { label: 'Undo', handler: undoBatch },
                // The run is over once the toast lapses, so the next pick starts a
                // fresh count. (An unrelated toast replacing ours mid-run would
                // leave the batch standing — rare, and the cost is an Undo that
                // reverses more than the last toast showed.)
                onExpire: () => {
                    setBatch([]);
                },
            });
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: describeForUser(toStorageError(err)),
            });
        }
    };

    let buttonEl: HTMLButtonElement | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen()) {
            e.preventDefault();
            close();
            buttonEl?.focus();
        }
    };

    return (
        <div class={styles.wrapper} onKeyDown={onKeyDown}>
            <button
                ref={buttonEl}
                type="button"
                class={styles.addButton}
                onClick={toggle}
                aria-expanded={isOpen()}
            >
                {/* The + rides in its own chevron-width box, so the words start
                    on the label column of the rows above instead of wherever the
                    glyph happens to end. */}
                <span class={styles.addGlyph} aria-hidden="true">+</span>
                Add Field
            </button>
            <Show when={isOpen()}>
                <LibraryPicker admittedKinds={props.admittedKinds} onPick={(d) => void pick(d)} />
            </Show>
        </div>
    );
};
