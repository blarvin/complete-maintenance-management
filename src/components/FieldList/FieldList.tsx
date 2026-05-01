/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * FieldComposerSlot (and optionally the legacy "+ Add Field" surface).
 *
 * Composer orchestration (open state, restore plumbing, handle exposure) lives
 * inside FieldComposerSlot — FieldList just hosts and forwards reload events.
 * Construction-mode parents pass `handleRef` through to drive commit/discard
 * externally from the node's Save button.
 */

import { component$, $, useComputed$, type Signal } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot, type FieldComposerSlotHandle } from '../FieldComposer/FieldComposerSlot';
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

    const handleFieldDeleted$ = $(() => {
        reload$();
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

            <FieldComposerSlot
                nodeId={props.nodeId}
                currentMaxCardOrder={maxPersistedCardOrder.value}
                initialTemplateIds={props.initialTemplateIds}
                isConstruction={props.isConstruction}
                onCommitted$={reload$}
                handleRef={props.handleRef}
            />

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
