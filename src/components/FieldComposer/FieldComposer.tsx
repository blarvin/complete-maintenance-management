/**
 * FieldComposer - In-situ FieldDefinition picker that doubles as the field-
 * creation form. One row per FieldDefinition; checking a row materialises a
 * live Component preview the user can fill in. Save commits the batch; Cancel
 * discards with a Snackbar Undo.
 *
 * Modes:
 * - Display mode: Save and Cancel buttons in the sticky footer commit/discard.
 * - Construction mode: Save button hidden — the parent node's "Save" button
 *   drives commitAll$ via the handle. Locked FieldDefinitions pre-seed and
 *   can't be unchecked.
 */

import {
    component$,
    useResource$,
    useVisibleTask$,
    Resource,
    $,
    type Signal,
    type QRL,
    type PropFunction,
} from '@builder.io/qwik';
import { getFieldDefinitionQueries } from '../../data/queries';
import { getSnackbarService } from '../../services/snackbar';
import { usePendingForms, pendingFormFromFieldDefinition, type PendingForm } from '../../hooks/usePendingForms';
import type { FieldDefinition } from '../../data/models';
import { ComposerRow } from './ComposerRow';
import styles from './FieldComposer.module.css';

export type FieldComposerHandle = {
    commitAll$: QRL<(currentMaxCardOrder: number) => Promise<number>>;
    discardAll$: QRL<() => PendingForm[]>;
};

export type FieldComposerProps = {
    nodeId: string;
    /** Max cardOrder among already-persisted fields (used to size new fields after them). */
    currentMaxCardOrder: number;
    /** FieldDefinitions that should be pre-checked and immutable (construction defaults). */
    lockedFieldDefinitionIds?: readonly string[];
    /** Hides the Save button — parent (construction node Save) drives commit. */
    isConstruction?: boolean;
    /** Pre-seed the batch (e.g. Snackbar Undo restoring a cancelled draft). */
    restoreSeed?: PendingForm[];
    /** Called when the composer should close itself (after Save / Cancel). */
    onDismiss$: PropFunction<() => void>;
    /** Optional signal to receive the composer handle for external commit/discard. */
    handleRef?: Signal<FieldComposerHandle | null>;
    /** Re-open the composer with the given rows (Snackbar Undo path). */
    onRequestRestore$?: PropFunction<(rows: PendingForm[]) => void>;
};

export const FieldComposer = component$<FieldComposerProps>((props) => {
    const initialSeedLoader$ = $(async (): Promise<PendingForm[]> => {
        if (props.restoreSeed && props.restoreSeed.length > 0) {
            return props.restoreSeed;
        }
        if (props.lockedFieldDefinitionIds && props.lockedFieldDefinitionIds.length > 0) {
            const fdq = getFieldDefinitionQueries();
            const seeded: PendingForm[] = [];
            for (const fid of props.lockedFieldDefinitionIds) {
                const def = await fdq.getFieldDefinitionById(fid);
                if (def) seeded.push(pendingFormFromFieldDefinition(def));
            }
            return seeded;
        }
        return [];
    });

    const { forms, lastToggledId, togglePending$, setPendingValue$, commitAll$, discardAll$ } = usePendingForms({
        nodeId: props.nodeId,
        initialSeedLoader$,
    });

    useVisibleTask$(({ track }) => {
        track(() => forms.value);
        if (props.handleRef) {
            props.handleRef.value = { commitAll$, discardAll$ };
        }
    });

    const definitionsResource = useResource$<FieldDefinition[]>(async () => {
        const list = await getFieldDefinitionQueries().listFieldDefinitions();
        return [...list].sort((a, b) => a.label.localeCompare(b.label));
    });

    const handleSave$ = $(async () => {
        await commitAll$(props.currentMaxCardOrder);
        await props.onDismiss$();
    });

    const handleCancel$ = $(async () => {
        const captured = await discardAll$();
        await props.onDismiss$();
        const count = captured.length;
        if (count === 0) return;
        getSnackbarService().show({
            message: `${count} field${count === 1 ? '' : 's'} discarded`,
            action: {
                label: 'Undo',
                handler: $(async () => {
                    if (props.onRequestRestore$) await props.onRequestRestore$(captured);
                }),
            },
        });
    });

    const lockedSet = new Set(props.lockedFieldDefinitionIds ?? []);

    return (
        <div class={styles.composer}>
            <Resource
                value={definitionsResource}
                onPending={() => <div class={styles.empty}>Loading field definitions…</div>}
                onResolved={(definitions) => (
                    <div class={styles.rows}>
                        {definitions.length === 0 ? (
                            <div class={styles.empty}>No field definitions available</div>
                        ) : (
                            definitions.map((def) => {
                                const pf = forms.value.find(f => f.fieldDefinitionId === def.id);
                                return (
                                    <ComposerRow
                                        key={def.id}
                                        definition={def}
                                        checked={!!pf}
                                        locked={lockedSet.has(def.id)}
                                        pendingForm={pf}
                                        autoFocus={!!pf && pf.id === lastToggledId.value}
                                        onToggle$={togglePending$}
                                        onValueChange$={setPendingValue$}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
            />

            <div class={styles.footer}>
                <button type="button" class={styles.cancelBtn} onClick$={handleCancel$}>
                    Cancel
                </button>
                {!props.isConstruction && (
                    <button
                        type="button"
                        class={styles.saveBtn}
                        onClick$={handleSave$}
                        disabled={forms.value.length === 0}
                    >
                        Save
                    </button>
                )}
            </div>
        </div>
    );
});
