/**
 * FieldComposerSlot — Self-contained mount point for the FieldComposer.
 *
 * Owns:
 * - the "+ Add Fields" trigger (display mode only)
 * - the restore-from-Undo signal + remount keying
 * - the FieldComposer handle exposure (for construction-mode parent commit)
 * - the dismiss / restore plumbing the snackbar uses
 *
 * Open state is shared with FieldList's other surface (legacy `+ Add Field`
 * dropdown) via the parent-owned `activeSurface` signal — flipping it to
 * `"composer"` opens this slot and implicitly closes the other surface.
 * In construction mode the composer is always shown and `activeSurface` is
 * irrelevant.
 */

import { component$, useSignal, $, type Signal, type QRL, type PropFunction } from '@builder.io/qwik';
import { FieldComposer, type FieldComposerHandle, type FieldComposerMode } from './FieldComposer';
import type { PendingForm } from '../../hooks/usePendingForms';
import styles from './FieldComposerSlot.module.css';

export type ActiveSurface = 'none' | 'legacy' | 'composer';

/** Handle exposed to a parent that needs to drive commit/discard externally
 *  (e.g. TreeNodeConstruction's Save button). */
export type FieldComposerSlotHandle = {
    commitAll$: QRL<(currentMaxCardOrderOverride?: number) => Promise<number>>;
    discardAll$: QRL<() => Promise<PendingForm[]>>;
    restoreWith$: QRL<(rows: PendingForm[]) => void>;
};

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
    /** Called after a commit successfully persists fields, so the parent can reload. */
    onCommitted$?: PropFunction<() => void>;
    /** Optional handle for external commit/discard/restore. */
    handleRef?: Signal<FieldComposerSlotHandle | null>;
};

export const FieldComposerSlot = component$<FieldComposerSlotProps>((props) => {
    const composerHandle = useSignal<FieldComposerHandle | null>(null);
    const restoreSeed = useSignal<PendingForm[] | undefined>(undefined);

    const isConstruction = props.mode === 'construction';
    const composerOpen =
        isConstruction || (props.activeSurface?.value === 'composer');

    const handleAddFields$ = $(() => {
        restoreSeed.value = undefined;
        if (props.activeSurface) props.activeSurface.value = 'composer';
    });

    const handleDismiss$ = $(async () => {
        restoreSeed.value = undefined;
        if (props.activeSurface) props.activeSurface.value = 'none';
        if (props.onCommitted$) await props.onCommitted$();
    });

    const handleRequestRestore$ = $((rows: PendingForm[]) => {
        restoreSeed.value = rows;
        if (props.activeSurface) props.activeSurface.value = 'composer';
    });

    // Wire the external handle if a parent asked for one.
    if (props.handleRef) {
        const commitAll$ = $(async (override?: number) => {
            if (!composerHandle.value) return 0;
            const max = override !== undefined ? override : props.currentMaxCardOrder;
            const count = await composerHandle.value.commitAll$(max);
            if (count > 0 && props.onCommitted$) await props.onCommitted$();
            return count;
        });
        const discardAll$ = $(async () => {
            if (!composerHandle.value) return [] as PendingForm[];
            return await composerHandle.value.discardAll$();
        });
        const restoreWith$ = $((rows: PendingForm[]) => {
            restoreSeed.value = rows;
            if (props.activeSurface) props.activeSurface.value = 'composer';
        });
        props.handleRef.value = { commitAll$, discardAll$, restoreWith$ };
    }

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
                    handleRef={composerHandle}
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
