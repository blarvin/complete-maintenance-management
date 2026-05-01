/**
 * FieldComposerSlot — Self-contained mount point for the FieldComposer.
 *
 * Owns:
 * - the open/closed signal and "+ Add Fields" trigger
 * - the restore-from-Undo signal + remount keying
 * - the FieldComposer handle exposure (for construction-mode parent commit)
 * - the dismiss / restore plumbing the snackbar uses
 *
 * Consumers (FieldList, future variants) just drop this in and pass through
 * persistence-relevant props. Swap this file for a different presentation
 * (modal, drawer, append-only-when-empty, …) without touching FieldList.
 */

import { component$, useSignal, $, type Signal, type QRL, type PropFunction } from '@builder.io/qwik';
import { FieldComposer, type FieldComposerHandle } from './FieldComposer';
import type { PendingForm } from '../../hooks/usePendingForms';
import styles from './FieldComposerSlot.module.css';

/** Handle exposed to a parent that needs to drive commit/discard externally
 *  (e.g. TreeNodeConstruction's Save button). */
export type FieldComposerSlotHandle = {
    commitAll$: QRL<(currentMaxCardOrderOverride?: number) => Promise<number>>;
    discardAll$: QRL<() => Promise<PendingForm[]>>;
    restoreWith$: QRL<(rows: PendingForm[]) => void>;
};

export type FieldComposerSlotProps = {
    nodeId: string;
    /** Max cardOrder among already-persisted fields (for placement). */
    currentMaxCardOrder: number;
    /** Construction defaults, pre-checked and immutable. */
    initialTemplateIds?: readonly string[];
    /** When true: composer opens by default, "+ Add Fields" trigger hidden,
     *  composer Save button hidden (parent drives commit). */
    isConstruction?: boolean;
    /** Called after a commit successfully persists fields, so the parent can reload. */
    onCommitted$?: PropFunction<() => void>;
    /** Optional handle for external commit/discard/restore. */
    handleRef?: Signal<FieldComposerSlotHandle | null>;
};

export const FieldComposerSlot = component$<FieldComposerSlotProps>((props) => {
    const composerOpen = useSignal<boolean>(!!props.isConstruction);
    const composerHandle = useSignal<FieldComposerHandle | null>(null);
    const restoreSeed = useSignal<PendingForm[] | undefined>(undefined);

    const handleAddFields$ = $(() => {
        restoreSeed.value = undefined;
        composerOpen.value = true;
    });

    const handleDismiss$ = $(async () => {
        composerOpen.value = false;
        restoreSeed.value = undefined;
        if (props.onCommitted$) await props.onCommitted$();
    });

    const handleRequestRestore$ = $((rows: PendingForm[]) => {
        restoreSeed.value = rows;
        composerOpen.value = true;
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
            composerOpen.value = true;
        });
        props.handleRef.value = { commitAll$, discardAll$, restoreWith$ };
    }

    return (
        <>
            {composerOpen.value && (
                <FieldComposer
                    key={restoreSeed.value ? 'restored' : 'fresh'}
                    nodeId={props.nodeId}
                    currentMaxCardOrder={props.currentMaxCardOrder}
                    lockedTemplateIds={props.initialTemplateIds}
                    isConstruction={props.isConstruction}
                    restoreSeed={restoreSeed.value}
                    onDismiss$={handleDismiss$}
                    handleRef={composerHandle}
                    onRequestRestore$={handleRequestRestore$}
                />
            )}

            {!composerOpen.value && !props.isConstruction && (
                <button
                    type="button"
                    class={styles.addButton}
                    onClick$={handleAddFields$}
                    aria-label="Add fields"
                >
                    + Add Fields
                </button>
            )}
        </>
    );
});
