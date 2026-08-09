/**
 * FieldComposerSlot — Self-contained mount point for the FieldComposer.
 *
 * Owns:
 * - the "+ Add Fields" trigger (display mode only)
 * - the restore-from-Undo signal + remount keying
 * - the dismiss / restore plumbing the snackbar uses
 *
 * Open state is shared with FieldList's other surface (legacy `+ Add Field`
 * dropdown) via the parent-owned `activeSurface` accessor/setter pair —
 * flipping it to `"composer"` opens this slot and implicitly closes the other
 * surface. In construction mode the composer is always shown and
 * `activeSurface` is irrelevant.
 */

import { Show, createSignal, type Accessor } from 'solid-js';
import { FieldComposer, type FieldComposerMode } from './FieldComposer';
import type { PendingForm } from '../../hooks/usePendingForms';
import type { ActiveSurface } from '../FieldList/addFieldSurfaces';
import styles from './FieldComposerSlot.module.css';

export type FieldComposerSlotProps = {
    nodeId: string;
    mode: FieldComposerMode;
    /** Max cardOrder among already-persisted fields (for placement). */
    currentMaxCardOrder: number;
    /** Construction defaults, pre-checked and immutable. Ignored in display mode. */
    initialDefinitionIds?: readonly string[];
    /** Shared mutex with the legacy "+ Add Field" surface (display mode only).
     *  Ignored in construction mode. */
    activeSurface?: Accessor<ActiveSurface>;
    setActiveSurface?: (s: ActiveSurface) => void;
};

export const FieldComposerSlot = (props: FieldComposerSlotProps) => {
    const [restoreSeed, setRestoreSeed] = createSignal<PendingForm[] | undefined>(undefined);

    const isConstruction = () => props.mode === 'construction';
    const composerOpen = () => isConstruction() || props.activeSurface?.() === 'composer';

    const handleAddFields = () => {
        setRestoreSeed(undefined);
        props.setActiveSurface?.('composer');
    };

    const handleDismiss = () => {
        setRestoreSeed(undefined);
        props.setActiveSurface?.('none');
    };

    const handleRequestRestore = (rows: PendingForm[]) => {
        setRestoreSeed(() => rows);
        props.setActiveSurface?.('composer');
    };

    return (
        <>
            <Show when={composerOpen()}>
                {/* Value-keyed <Show>: flipping 'fresh' → 'restored' recreates the
                    composer, and that remount is what re-runs usePendingForms'
                    seed loader against the restore seed. */}
                <Show when={restoreSeed() ? 'restored' : 'fresh'} keyed>
                    <FieldComposer
                        nodeId={props.nodeId}
                        mode={props.mode}
                        currentMaxCardOrder={props.currentMaxCardOrder}
                        lockedDefinitionIds={props.initialDefinitionIds}
                        restoreSeed={restoreSeed()}
                        onDismiss={handleDismiss}
                        onRequestRestore={handleRequestRestore}
                    />
                </Show>
            </Show>

            <Show when={!composerOpen() && !isConstruction()}>
                <button
                    type="button"
                    class={styles.addButton}
                    onClick={handleAddFields}
                    aria-label="Add fields (open composer)"
                >
                    + Add Fields
                </button>
            </Show>
        </>
    );
};
