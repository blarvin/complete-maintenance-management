/**
 * FieldComposer - In-situ FieldDefinition picker that doubles as the field-
 * creation form. One row per FieldDefinition; checking a row materialises a
 * live Component preview the user can fill in. Save commits the batch; Cancel
 * discards with a Snackbar Undo.
 *
 * Layout (top → bottom):
 *  1. "+ New Field Definition…" affordance — or, when expanded, the inline
 *     FieldDefinitionAuthoringForm.
 *  2. Just-created FieldDefinitions (this Composer session), pre-checked, in
 *     creation order. On next open they fall into alphabetical place.
 *  3. Alphabetical list of all remaining active FieldDefinitions.
 *
 * Modes:
 * - "display": batch-add path on existing nodes. Sticky Save and Cancel in the
 *   footer; locked rows not used.
 * - "construction": Composer is the body of the under-construction node's
 *   DataCard. Save button hidden — the parent node's "Save" button drives
 *   commitAll$ via the handle. Locked FieldDefinitions pre-seed and can't be
 *   unchecked.
 */

import {
    component$,
    useResource$,
    useSignal,
    useVisibleTask$,
    Resource,
    $,
    type Signal,
    type QRL,
    type PropFunction,
} from '@builder.io/qwik';
import { getFieldDefinitionQueries } from '../../data/queries';
import { storageEventBus } from '../../data/storageEventBus';
import { getSnackbarService } from '../../services/snackbar';
import { usePendingForms, pendingFormFromFieldDefinition, type PendingForm } from '../../hooks/usePendingForms';
import type { FieldDefinition } from '../../data/models';
import { ComposerRow } from './ComposerRow';
import { FieldDefinitionAuthoringForm } from './FieldDefinitionAuthoringForm';
import styles from './FieldComposer.module.css';

export type FieldComposerMode = 'display' | 'construction';

export type FieldComposerHandle = {
    commitAll$: QRL<(currentMaxCardOrder: number) => Promise<number>>;
    discardAll$: QRL<() => PendingForm[]>;
};

export type FieldComposerProps = {
    nodeId: string;
    /** "display" (batch-add against an existing node) vs "construction" (Composer
     *  bound to a new node's Save). */
    mode: FieldComposerMode;
    /** Max cardOrder among already-persisted fields (used to size new fields after them). */
    currentMaxCardOrder: number;
    /** FieldDefinitions that should be pre-checked and immutable (construction defaults).
     *  Ignored in display mode. */
    lockedFieldDefinitionIds?: readonly string[];
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
        if (props.mode === 'construction' && props.lockedFieldDefinitionIds && props.lockedFieldDefinitionIds.length > 0) {
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

    // FieldDefinitions created during this Composer session — pinned above the
    // alphabetical pool, pre-checked. On next Composer open they fall into
    // alphabetical place (parent remounts the Composer fresh).
    const justCreated = useSignal<FieldDefinition[]>([]);
    const refreshKey = useSignal(0);
    const authoringOpen = useSignal(false);

    useVisibleTask$(({ cleanup }) => {
        const unsub = storageEventBus.subscribe((event) => {
            if (event.type === 'FIELD_DEFINITION_WRITTEN') {
                refreshKey.value++;
            }
        });
        cleanup(() => unsub());
    });

    const definitionsResource = useResource$<FieldDefinition[]>(async ({ track }) => {
        track(() => refreshKey.value);
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

    const openAuthoring$ = $(() => {
        authoringOpen.value = true;
    });

    const closeAuthoring$ = $(() => {
        authoringOpen.value = false;
    });

    const handleAuthored$ = $(async (def: FieldDefinition) => {
        justCreated.value = [...justCreated.value, def];
        // Pre-check the new definition so the user can immediately enter a value.
        await togglePending$(def);
        // Refresh the alphabetical resource so subsequent opens see the new row.
        refreshKey.value++;
        authoringOpen.value = false;
    });

    const lockedSet = new Set(
        props.mode === 'construction' ? (props.lockedFieldDefinitionIds ?? []) : []
    );

    return (
        <div class={styles.composer}>
            <Resource
                value={definitionsResource}
                onPending={() => <div class={styles.empty}>Loading field definitions…</div>}
                onResolved={(definitions) => {
                    const justCreatedIds = new Set(justCreated.value.map(d => d.id));
                    const rest = definitions.filter(d => !justCreatedIds.has(d.id));
                    return (
                        <div class={styles.rows}>
                            {/* Affordance / authoring form — top of the list. */}
                            {authoringOpen.value ? (
                                <FieldDefinitionAuthoringForm
                                    onCreated$={handleAuthored$}
                                    onCancel$={closeAuthoring$}
                                />
                            ) : (
                                <button
                                    type="button"
                                    class={styles.affordance}
                                    onClick$={openAuthoring$}
                                >
                                    + New Field Definition…
                                </button>
                            )}

                            {/* Just-created definitions, pinned above alphabetical pool. */}
                            {justCreated.value.map((def) => {
                                const pf = forms.value.find(f => f.fieldDefinitionId === def.id);
                                return (
                                    <ComposerRow
                                        key={def.id}
                                        definition={def}
                                        checked={!!pf}
                                        pendingForm={pf}
                                        autoFocus={!!pf && pf.id === lastToggledId.value}
                                        onToggle$={togglePending$}
                                        onValueChange$={setPendingValue$}
                                    />
                                );
                            })}

                            {/* Alphabetical pool. */}
                            {rest.length === 0 && justCreated.value.length === 0 ? (
                                <div class={styles.empty}>No field definitions available</div>
                            ) : (
                                rest.map((def) => {
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
                    );
                }}
            />

            <div class={styles.footer}>
                <button type="button" class={styles.cancelBtn} onClick$={handleCancel$}>
                    Cancel
                </button>
                {props.mode === 'display' && (
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
