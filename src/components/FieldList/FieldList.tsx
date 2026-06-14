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
 * (open/restore plumbing) lives inside FieldComposerSlot. The construction
 * draft is committed by useNodeCreation reading localStorage, so no handle
 * into the composer is threaded.
 */

import { component$, useComputed$, useSignal } from '@builder.io/qwik';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useElementChildren } from '../../hooks/useElementChildren';
import type { ComponentType } from '../../data/models';
import { ENABLED_ADD_FIELD_SURFACES } from '../../constants';
import type { ActiveSurface } from './addFieldSurfaces';
import styles from './FieldList.module.css';

export type FieldListProps = {
    nodeId: string;
    /** When true, operates in construction mode (composer open by default). */
    isConstruction?: boolean;
    /** FieldDefinition IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialFieldDefinitionIds?: readonly string[];
};

export const FieldList = component$<FieldListProps>((props) => {
    const nodeIdSig = useComputed$(() => props.nodeId);
    const { children: fields } = useElementChildren(nodeIdSig, 'fields');

    const maxPersistedCardOrder = useComputed$(() => {
        if (fields.value.length === 0) return -1;
        return Math.max(...fields.value.map(f => f.siblingOrder));
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
                    name={field.name}
                    fieldDefinitionId={field.fieldDefinitionId!}
                    kind={field.kind as ComponentType}
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
