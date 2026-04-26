/**
 * FieldComposer - In-situ Template-picker that doubles as the field-creation
 * form. One row per Template; checking a row materialises a live Component
 * preview the user can fill in. Save commits the batch; Cancel discards with
 * a Snackbar Undo.
 *
 * Modes:
 * - Display mode: Save and Cancel buttons in the sticky footer commit/discard.
 * - Construction mode: Save button hidden — the parent node's "Save" button
 *   drives commitAll$ via the handle. Locked Templates pre-seed and can't be
 *   unchecked.
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
import { getTemplateQueries } from '../../data/queries';
import { getSnackbarService } from '../../services/snackbar';
import { usePendingForms, type PendingForm } from '../../hooks/usePendingForms';
import { generateId } from '../../utils/id';
import type { DataFieldTemplate } from '../../data/models';
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
    /** Templates that should be pre-checked and immutable (construction defaults). */
    lockedTemplateIds?: readonly string[];
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
        if (props.lockedTemplateIds && props.lockedTemplateIds.length > 0) {
            const tq = getTemplateQueries();
            const seeded: PendingForm[] = [];
            for (const tid of props.lockedTemplateIds) {
                const tpl = await tq.getTemplateById(tid);
                if (!tpl) continue;
                seeded.push({
                    id: generateId(),
                    templateId: tpl.id,
                    componentType: tpl.componentType,
                    fieldName: tpl.label,
                    value: null,
                });
            }
            return seeded;
        }
        return [];
    });

    const { forms, togglePending$, setPendingValue$, commitAll$, discardAll$ } = usePendingForms({
        nodeId: props.nodeId,
        initialSeedLoader$,
    });

    useVisibleTask$(({ track }) => {
        track(() => forms.value);
        if (props.handleRef) {
            props.handleRef.value = { commitAll$, discardAll$ };
        }
    });

    const templatesResource = useResource$<DataFieldTemplate[]>(async () => {
        const list = await getTemplateQueries().listTemplates();
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

    const lockedSet = new Set(props.lockedTemplateIds ?? []);

    return (
        <div class={styles.composer}>
            <Resource
                value={templatesResource}
                onPending={() => <div class={styles.empty}>Loading templates…</div>}
                onResolved={(templates) => (
                    <div class={styles.rows}>
                        {templates.length === 0 ? (
                            <div class={styles.empty}>No templates available</div>
                        ) : (
                            templates.map((tpl) => {
                                const pf = forms.value.find(f => f.templateId === tpl.id);
                                return (
                                    <ComposerRow
                                        key={tpl.id}
                                        template={tpl}
                                        checked={!!pf}
                                        locked={lockedSet.has(tpl.id)}
                                        pendingForm={pf}
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
