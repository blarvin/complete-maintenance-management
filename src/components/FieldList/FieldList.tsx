/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * add-field surfaces enabled in ENABLED_ADD_FIELD_SURFACES.
 *
 * Hosts the `activeSurface` mutex shared by all display-mode add-field
 * surfaces — opening one closes the others. Surface contract and roster
 * live in ./addFieldSurfaces.ts.
 *
 * Data arrives via useElementChildren (writes emit; readers subscribe) —
 * no reload callbacks are threaded to children. Composer orchestration
 * (open/restore plumbing, handle exposure) lives inside FieldComposerSlot.
 * Construction-mode parents pass `handleRef` through to drive commit/discard
 * externally from the node's Save button.
 */

import { component$, useComputed$, useSignal, type Signal } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot, type FieldComposerSlotHandle } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useElementChildren } from '../../hooks/useElementChildren';
import { elementToDataField } from '../../data/models';
import { ENABLED_ADD_FIELD_SURFACES } from '../../constants';
import type { ActiveSurface } from './addFieldSurfaces';
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
    const nodeIdSig = useComputed$(() => props.nodeId);
    const { children } = useElementChildren(nodeIdSig, 'fields');
    const fields = useComputed$(() => children.value.map(elementToDataField));

    const maxPersistedCardOrder = useComputed$(() => {
        if (fields.value.length === 0) return -1;
        return Math.max(...fields.value.map(f => f.cardOrder));
    });

    // Shared mutex for the display-mode add-field surfaces.
    const activeSurface = useSignal<ActiveSurface>('none');

    const mode = props.isConstruction ? 'construction' : 'display';

    return (
        <div class={styles.fieldList}>
            {fields.value.map((field) => (
                <DataField
                    key={field.id}
                    id={field.id}
                    fieldName={field.fieldName}
                    fieldDefinitionId={field.fieldDefinitionId}
                    componentType={field.componentType}
                    value={field.value}
                    updatedAt={field.updatedAt}
                />
            ))}

            {(props.isConstruction || ENABLED_ADD_FIELD_SURFACES.includes('composer')) && (
                <FieldComposerSlot
                    nodeId={props.nodeId}
                    mode={mode}
                    currentMaxCardOrder={maxPersistedCardOrder.value}
                    initialFieldDefinitionIds={props.initialFieldDefinitionIds}
                    activeSurface={activeSurface}
                    handleRef={props.handleRef}
                />
            )}

            {ENABLED_ADD_FIELD_SURFACES.includes('legacy') && !props.isConstruction && (
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder.value}
                    activeSurface={activeSurface}
                />
            )}
        </div>
    );
});
