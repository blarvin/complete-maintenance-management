/**
 * FieldList - Manages and renders the list of DataFields for a node.
 *
 * Responsibilities:
 * - Fetches persisted fields from DB (useTreeNodeFields)
 * - Renders the FieldComposer (in-situ Template picker that doubles as form)
 * - Provides "+ Add Fields" button to open the composer
 * - In construction mode, exposes a handle so the parent node Save can drive
 *   the composer's commit and Undo can re-seed it.
 */

import { component$, $, useSignal, useComputed$, useVisibleTask$, type Signal, type QRL } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { FieldComposer, type FieldComposerHandle } from '../FieldComposer/FieldComposer';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useTreeNodeFields } from '../TreeNode/useTreeNodeFields';
import type { PendingForm } from '../../hooks/usePendingForms';
import { LEGACY_ADD_FIELD_ENABLED } from '../../constants';
import styles from './FieldList.module.css';

/** Handle for external access to FieldList composer methods (construction mode). */
export type FieldListHandle = {
    commitAllComposer$: QRL<(currentMaxCardOrderOverride?: number) => Promise<number>>;
    discardComposer$: QRL<() => Promise<PendingForm[]>>;
    restoreComposerWith$: QRL<(rows: PendingForm[]) => void>;
};

export type FieldListProps = {
    nodeId: string;
    /** Optional signal to receive the FieldList handle for external control */
    handleRef?: Signal<FieldListHandle | null>;
    /** When true, operates in construction mode (composer open by default, Save hidden in composer). */
    isConstruction?: boolean;
    /** Template IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialTemplateIds?: readonly string[];
};

export const FieldList = component$<FieldListProps>((props) => {
    const { fields, reload$ } = useTreeNodeFields({
        nodeId: props.nodeId,
        enabled: true
    });

    const maxPersistedCardOrder = useComputed$(() => {
        if (!fields.value || fields.value.length === 0) return -1;
        return Math.max(...fields.value.map(f => f.cardOrder));
    });

    const composerOpen = useSignal<boolean>(!!props.isConstruction);
    const composerHandle = useSignal<FieldComposerHandle | null>(null);
    const restoreSeed = useSignal<PendingForm[] | undefined>(undefined);

    useVisibleTask$(() => {
        if (props.handleRef) {
            const commitAllComposer$ = $(async (override?: number) => {
                if (!composerHandle.value) return 0;
                const max = override !== undefined ? override : maxPersistedCardOrder.value;
                const count = await composerHandle.value.commitAll$(max);
                if (count > 0) await reload$();
                return count;
            });
            const discardComposer$ = $(async () => {
                if (!composerHandle.value) return [] as PendingForm[];
                return await composerHandle.value.discardAll$();
            });
            const restoreComposerWith$ = $((rows: PendingForm[]) => {
                restoreSeed.value = rows;
                composerOpen.value = true;
            });
            props.handleRef.value = { commitAllComposer$, discardComposer$, restoreComposerWith$ };
        }
    });

    const handleFieldDeleted$ = $(() => {
        reload$();
    });

    const handleAddFields$ = $(() => {
        restoreSeed.value = undefined;
        composerOpen.value = true;
    });

    const handleComposerDismiss$ = $(() => {
        composerOpen.value = false;
        restoreSeed.value = undefined;
        // Reload in case commit added persisted fields.
        reload$();
    });

    const handleRequestRestore$ = $((rows: PendingForm[]) => {
        restoreSeed.value = rows;
        composerOpen.value = true;
    });

    return (
        <div class={styles.fieldList}>
            {fields.value && fields.value.map((field) => (
                <DataField
                    key={field.id}
                    id={field.id}
                    fieldName={field.fieldName}
                    templateId={field.templateId}
                    componentType={field.componentType}
                    value={field.value}
                    onDeleted$={handleFieldDeleted$}
                />
            ))}

            {composerOpen.value && (
                <FieldComposer
                    key={restoreSeed.value ? 'restored' : 'fresh'}
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder.value}
                    lockedTemplateIds={props.initialTemplateIds}
                    isConstruction={props.isConstruction}
                    restoreSeed={restoreSeed.value}
                    onDismiss$={handleComposerDismiss$}
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

            {LEGACY_ADD_FIELD_ENABLED && !props.isConstruction && (
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder.value}
                    onCreated$={reload$}
                />
            )}
        </div>
    );
});
