/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * FieldComposerSlot (and optionally the legacy "+ Add Field" surface).
 *
 * Hosts the `activeSurface` mutex shared by the two display-mode add-field
 * surfaces — opening one closes the other.
 *
 * Composer orchestration (open/restore plumbing, handle exposure) lives
 * inside FieldComposerSlot; FieldList just hosts and forwards reload events.
 * Construction-mode parents pass `handleRef` through to drive commit/discard
 * externally from the node's Save button.
 */

import { component$, $, useComputed$, useSignal, type Signal } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot, type FieldComposerSlotHandle, type ActiveSurface } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useTreeNodeFields } from '../TreeNode/useTreeNodeFields';
import { LEGACY_ADD_FIELD_ENABLED } from '../../constants';
import styles from './FieldList.module.css';

/** Re-export so existing TreeNodeConstruction imports keep working. */
export type FieldListHandle = FieldComposerSlotHandle;

export type FieldListProps = {
    nodeId: string;
    /** Optional signal to receive the composer slot's handle. */
    handleRef?: Signal<FieldListHandle | null>;
    /** When true, operates in construction mode (composer open by default). */
    isConstruction?: boolean;
    /** FieldDefinition IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialFieldDefinitionIds?: readonly string[];
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

    // Shared mutex for the two display-mode surfaces.
    const activeSurface = useSignal<ActiveSurface>('none');

    const handleFieldDeleted$ = $(() => {
        reload$();
    });

    const mode = props.isConstruction ? 'construction' : 'display';

    return (
        <div class={styles.fieldList}>
            {fields.value && fields.value.map((field) => (
                <DataField
                    key={field.id}
                    id={field.id}
                    fieldName={field.fieldName}
                    fieldDefinitionId={field.fieldDefinitionId}
                    componentType={field.componentType}
                    value={field.value}
                    updatedAt={field.updatedAt}
                    onDeleted$={handleFieldDeleted$}
                />
            ))}

            <FieldComposerSlot
                nodeId={props.nodeId}
                mode={mode}
                currentMaxCardOrder={maxPersistedCardOrder.value}
                initialFieldDefinitionIds={props.initialFieldDefinitionIds}
                activeSurface={activeSurface}
                onCommitted$={reload$}
                handleRef={props.handleRef}
            />

            {LEGACY_ADD_FIELD_ENABLED && !props.isConstruction && (
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder.value}
                    activeSurface={activeSurface}
                    onCreated$={reload$}
                />
            )}
        </div>
    );
});
