/**
 * FieldComposer - In-situ Definition picker that doubles as the field-
 * creation form. One row per Definition; checking a row materialises a
 * live Component preview the user can fill in. Save commits the batch; Cancel
 * discards with a Snackbar Undo.
 *
 * Layout (top → bottom):
 *  1. "+ New Field Definition…" affordance — or, when expanded, the inline
 *     DefinitionAuthoringForm.
 *  2. Just-created Definitions (this Composer session), pre-checked, in
 *     creation order. On next open they fall into alphabetical place.
 *  3. Alphabetical list of all remaining active Definitions.
 *
 * Modes:
 * - "display": batch-add path on existing nodes. Sticky Save and Cancel in the
 *   footer; locked rows not used.
 * - "construction": Composer is the body of the under-construction node's
 *   DataCard. Save button hidden — the parent node's "Save" button drives
 *   commitAll via the handle. Locked Definitions pre-seed and can't be
 *   unchecked.
 */

import { For, Show, createResource, createSignal, onCleanup } from 'solid-js';
import { getDefinitionQueries } from '../../data/queries';
import { isInline } from '../../kinds/placement';
import { storageEventBus } from '../../data/storageEventBus';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { usePendingForms, type PendingForm } from '../../hooks/usePendingForms';
import { seedPendingDraft } from '../../data/services/pendingDraft';
import type { Definition } from '../../data/models';
import { ComposerRow } from './ComposerRow';
import { DefinitionAuthoringForm } from './DefinitionAuthoringForm';
import styles from './FieldComposer.module.css';

export type FieldComposerMode = 'display' | 'construction';

export type FieldComposerProps = {
    nodeId: string;
    /** "display" (batch-add against an existing node) vs "construction" (Composer
     *  bound to a new node's Save). */
    mode: FieldComposerMode;
    /** Max cardOrder among already-persisted fields (used to size new fields after them). */
    currentMaxCardOrder: number;
    /** Definitions that should be pre-checked and immutable (construction defaults).
     *  Ignored in display mode. */
    lockedDefinitionIds?: readonly string[];
    /** Pre-seed the batch (e.g. Snackbar Undo restoring a cancelled draft). */
    restoreSeed?: PendingForm[];
    /** Called when the composer should close itself (after Save / Cancel). */
    onDismiss: () => void;
    /** Re-open the composer with the given rows (Snackbar Undo path). */
    onRequestRestore?: (rows: PendingForm[]) => void;
};

export const FieldComposer = (props: FieldComposerProps) => {
    // Mount-time constants: the composer remounts via the slot's keyed <Show>.
    const initialSeedLoader = async (): Promise<PendingForm[]> => {
        if (props.restoreSeed && props.restoreSeed.length > 0) {
            return props.restoreSeed;
        }
        if (props.mode === 'construction' && props.lockedDefinitionIds && props.lockedDefinitionIds.length > 0) {
            // The draft store owns seeding, so node creation can seed the same
            // rows with no composer mounted (see useNodeCreation.complete),
            // which is also where the unresolved ids are reported.
            return (await seedPendingDraft(props.nodeId, props.lockedDefinitionIds)).forms;
        }
        return [];
    };

    const { forms, lastToggledId, togglePending, setPendingValue, commitAll, discardAll } = usePendingForms({
        // eslint-disable-next-line solid/reactivity -- mount-time constant; the composer remounts via the slot's keyed <Show>
        nodeId: props.nodeId,
        initialSeedLoader,
    });

    // Definitions created during this Composer session — pinned above the
    // alphabetical pool, pre-checked. On next Composer open they fall into
    // alphabetical place (parent remounts the Composer fresh).
    const [justCreated, setJustCreated] = createSignal<Definition[]>([]);
    const [refreshKey, setRefreshKey] = createSignal(0);
    const [authoringOpen, setAuthoringOpen] = createSignal(false);

    // Subscribe BEFORE the resource's first fetch so no DEFINITION_WRITTEN
    // lands in the gap between load and subscription.
    const unsub = storageEventBus.subscribe((event) => {
        if (event.type === 'DEFINITION_WRITTEN') {
            setRefreshKey((k) => k + 1);
        }
    });
    onCleanup(() => unsub());

    const [definitions] = createResource(refreshKey, async (): Promise<Definition[]> => {
        try {
            const list = await getDefinitionQueries().listDefinitions();
            // Field kinds only: re-root policy Definitions (logbook) live in the
            // same library tree but are not composer-instantiable rows.
            return list.filter((d) => isInline(d.kind)).sort((a, b) => a.label.localeCompare(b.label));
        } catch {
            return [];
        }
    });

    const rest = () => {
        const justCreatedIds = new Set(justCreated().map(d => d.id));
        return (definitions() ?? []).filter(d => !justCreatedIds.has(d.id));
    };

    const handleSave = async () => {
        await commitAll(props.currentMaxCardOrder);
        props.onDismiss();
    };

    const handleCancel = async () => {
        await commitWithUndo({
            execute: () => {
                const captured = discardAll();
                props.onDismiss();
                return captured; // PendingForm[]
            },
            undo: (captured) => {
                props.onRequestRestore?.(captured as PendingForm[]);
            },
            message: (captured) => {
                const n = (captured as PendingForm[]).length;
                return n ? `${n} field${n === 1 ? '' : 's'} discarded` : null; // null ⇒ no toast
            },
        });
    };

    const handleAuthored = (def: Definition) => {
        setJustCreated([...justCreated(), def]);
        // Pre-check the new definition so the user can immediately enter a value.
        togglePending(def);
        // Refresh the alphabetical resource so subsequent opens see the new row.
        setRefreshKey((k) => k + 1);
        setAuthoringOpen(false);
    };

    // eslint-disable-next-line solid/reactivity -- mount-time constant; the composer remounts via the slot's keyed <Show>
    const lockedSet = new Set(props.mode === 'construction' ? (props.lockedDefinitionIds ?? []) : []);

    const pendingFor = (def: Definition) => forms().find(f => f.definitionId === def.id);

    return (
        <div class={styles.composer}>
            <Show
                when={definitions()}
                fallback={<div class={styles.empty}>Loading field definitions…</div>}
            >
                <div class={styles.rows}>
                    {/* Affordance / authoring form — top of the list. */}
                    <Show
                        when={authoringOpen()}
                        fallback={
                            <button
                                type="button"
                                class={styles.affordance}
                                onClick={() => setAuthoringOpen(true)}
                            >
                                + New Field Definition…
                            </button>
                        }
                    >
                        <DefinitionAuthoringForm
                            onCreated={handleAuthored}
                            onCancel={() => setAuthoringOpen(false)}
                        />
                    </Show>

                    {/* Just-created definitions, pinned above alphabetical pool. */}
                    <For each={justCreated()}>
                        {(def) => (
                            <ComposerRow
                                definition={def}
                                checked={!!pendingFor(def)}
                                pendingForm={pendingFor(def)}
                                autoFocus={!!pendingFor(def) && pendingFor(def)!.id === lastToggledId()}
                                onToggle={togglePending}
                                onValueChange={setPendingValue}
                            />
                        )}
                    </For>

                    {/* Alphabetical pool. */}
                    <Show
                        when={rest().length > 0 || justCreated().length > 0}
                        fallback={<div class={styles.empty}>No field definitions available</div>}
                    >
                        <For each={rest()}>
                            {(def) => (
                                <ComposerRow
                                    definition={def}
                                    checked={!!pendingFor(def)}
                                    locked={lockedSet.has(def.id)}
                                    pendingForm={pendingFor(def)}
                                    autoFocus={!!pendingFor(def) && pendingFor(def)!.id === lastToggledId()}
                                    onToggle={togglePending}
                                    onValueChange={setPendingValue}
                                />
                            )}
                        </For>
                    </Show>
                </div>
            </Show>

            {/* Construction mode is driven by the parent node's Cancel/Create row,
                so the composer hides its own footer to avoid a duplicate Cancel. */}
            <Show when={props.mode === 'display'}>
                <div class={styles.footer}>
                    <button type="button" class={styles.cancelBtn} onClick={handleCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        class={styles.saveBtn}
                        onClick={handleSave}
                        disabled={forms().length === 0}
                    >
                        Save
                    </button>
                </div>
            </Show>
        </div>
    );
};
