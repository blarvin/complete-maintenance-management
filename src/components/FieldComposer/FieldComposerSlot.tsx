/**
 * FieldComposerSlot — Self-contained mount point for the FieldComposer.
 *
 * Owns:
 * - the "+ Add Fields" trigger (display mode only)
 * - the restore-from-Undo signal + remount keying
 * - the dismiss / restore plumbing the snackbar uses
 *
 * Open state is shared with FieldList's other surface (legacy `+ Add Field`
 * dropdown) via the parent-owned `activeSurface` signal — flipping it to
 * `"composer"` opens this slot and implicitly closes the other surface.
 * In construction mode the composer is always shown and `activeSurface` is
 * irrelevant.
 */

import { component$, useSignal, $, type Signal } from '@builder.io/qwik';
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
    initialFieldDefinitionIds?: readonly string[];
    /** Shared mutex with the legacy "+ Add Field" surface (display mode only).
     *  Ignored in construction mode. */
    activeSurface?: Signal<ActiveSurface>;
};

export const FieldComposerSlot = component$<FieldComposerSlotProps>((props) => {
    const restoreSeed = useSignal<PendingForm[] | undefined>(undefined);

    const isConstruction = props.mode === 'construction';
    const composerOpen =
        isConstruction || (props.activeSurface?.value === 'composer');

    const handleAddFields$ = $(() => {
        restoreSeed.value = undefined;
        if (props.activeSurface) props.activeSurface.value = 'composer';
    });

    const handleDismiss$ = $(() => {
        restoreSeed.value = undefined;
        if (props.activeSurface) props.activeSurface.value = 'none';
    });

    const handleRequestRestore$ = $((rows: PendingForm[]) => {
        restoreSeed.value = rows;
        if (props.activeSurface) props.activeSurface.value = 'composer';
    });

    return (
        <>
            {composerOpen && (
                <FieldComposer
                    key={restoreSeed.value ? 'restored' : 'fresh'}
                    nodeId={props.nodeId}
                    mode={props.mode}
                    currentMaxCardOrder={props.currentMaxCardOrder}
                    lockedFieldDefinitionIds={props.initialFieldDefinitionIds}
                    restoreSeed={restoreSeed.value}
                    onDismiss$={handleDismiss$}
                    onRequestRestore$={handleRequestRestore$}
                />
            )}

            {!composerOpen && !isConstruction && (
                <button
                    type="button"
                    class={styles.addButton}
                    onClick$={handleAddFields$}
                    aria-label="Add fields (open composer)"
                >
                    + Add Fields
                </button>
            )}
        </>
    );
});
