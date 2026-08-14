/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * add-field surfaces enabled in ENABLED_ADD_FIELD_SURFACES.
 *
 * Hosts the `activeSurface` mutex shared by all display-mode add-field
 * surfaces — opening one closes the others. Surface contract and roster
 * live in ./addFieldSurfaces.ts.
 *
 * The roster gates construction mode too: with it empty, a node under
 * construction renders its persisted fields only (there are none yet) and the
 * defaults arrive anyway — useNodeCreation seeds and commits the pending draft
 * itself, so nothing here has to be mounted for that to happen.
 *
 * Data arrives via useElementChildren (writes emit; readers subscribe) —
 * no reload callbacks are threaded to children. Composer orchestration
 * (open/restore plumbing) lives inside FieldComposerSlot.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { useElementChildren } from '../../hooks/useElementChildren';
import { ENABLED_ADD_FIELD_SURFACES } from '../../constants';
import type { ActiveSurface } from './addFieldSurfaces';
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

    const maxPersistedCardOrder = createMemo(() => {
        if (fields().length === 0) return -1;
        return Math.max(...fields().map(f => f.siblingOrder));
    });

    // Shared mutex for the display-mode add-field surfaces.
    const [activeSurface, setActiveSurface] = createSignal<ActiveSurface>('none');

    const mode = () => props.isConstruction ? 'construction' : 'display';

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

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('composer')}>
                <FieldComposerSlot
                    nodeId={props.nodeId}
                    mode={mode()}
                    currentMaxCardOrder={maxPersistedCardOrder()}
                    initialDefinitionIds={props.initialDefinitionIds}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('legacy') && !props.isConstruction}>
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder()}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>
        </div>
    );
};
