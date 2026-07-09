/**
 * FieldList - Renders persisted DataFields for a node.
 *
 * Data arrives via useElementChildren (writes emit; readers subscribe) —
 * no reload callbacks are threaded to children.
 *
 * Phase II is read-only: the add-field surfaces are omitted.
 * TODO(Phase IV): add-field surfaces (FieldComposerSlot / CreateDataField),
 * activeSurface mutex, maxPersistedCardOrder.
 */

import { For } from 'solid-js';
import { DataField } from '../DataField/DataField';
import { useElementChildren } from '../../hooks/useElementChildren';
import styles from './FieldList.module.css';

export type FieldListProps = {
    nodeId: string;
    /** When true, operates in construction mode (composer open by default). */
    isConstruction?: boolean;
    /** Definition IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialDefinitionIds?: readonly string[];
    /** When true, suppress the add-field surfaces (composer/legacy) — a read-only peek of existing fields. */
    hideAddSurfaces?: boolean;
};

export const FieldList = (props: FieldListProps) => {
    const { children: fields } = useElementChildren(() => props.nodeId, 'fields');

    return (
        <div class={styles.fieldList}>
            <For each={fields()}>
                {(field) => (
                    <DataField
                        id={field.id}
                        name={field.name}
                        definitionId={field.definitionId!}
                        kind={field.kind}
                        value={field.value}
                        updatedAt={field.updatedAt}
                    />
                )}
            </For>
        </div>
    );
};
