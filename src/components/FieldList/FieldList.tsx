/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * add-field surfaces enabled in ENABLED_ADD_FIELD_SURFACES.
 *
 * Hosts the `activeSurface` mutex shared by all display-mode add-field
 * surfaces — opening one closes the others. Surface contract and roster
 * live in ./addFieldSurfaces.ts.
 *
 * The roster gates construction mode too, and under the current one no surface
 * draws there: the Add Surface excludes itself when `isConstruction` and the
 * other two are not enabled. So a node under construction renders its persisted
 * fields only (there are none yet) and the defaults arrive anyway —
 * useNodeCreation seeds and commits the pending draft itself, so nothing here
 * has to be mounted for that to happen.
 *
 * Data arrives via useElementChildren (writes emit; readers subscribe) —
 * no reload callbacks are threaded to children. Composer orchestration
 * (open/restore plumbing) lives inside FieldComposerSlot.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { AddFieldSurface } from '../AddFieldSurface/AddFieldSurface';
import { useElementChildren } from '../../hooks/useElementChildren';
import { allowedChildKinds } from '../../kinds/childrenPolicy';
import { FIELD_KINDS } from '../../kinds/registry';
import { ENABLED_ADD_FIELD_SURFACES } from '../../constants';
import type { ActiveSurface } from './addFieldSurfaces';
import type { Kind } from '../../data/models';
import styles from './FieldList.module.css';

export type FieldListProps = {
    nodeId: string;
    /**
     * The owning node's kind, which entails whether an Add Surface renders at
     * all (SPEC → The Add Surface). Optional because a read-only peek
     * (`hideAddSurfaces`) has no create affordance to gate.
     */
    kind?: Kind;
    /** When true, operates in construction mode (composer open by default). */
    isConstruction?: boolean;
    /** Definition IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialDefinitionIds?: readonly string[];
    /** When true, suppress the add-field surfaces — a read-only peek of existing fields. */
    hideAddSurfaces?: boolean;
};

export const FieldList = (props: FieldListProps) => {
    const { children: fields } = useElementChildren(() => props.nodeId, 'fields');

    const maxPersistedSiblingOrder = createMemo(() => {
        if (fields().length === 0) return -1;
        return Math.max(...fields().map(f => f.siblingOrder));
    });

    // Shared mutex for the display-mode add-field surfaces.
    const [activeSurface, setActiveSurface] = createSignal<ActiveSurface>('none');

    const mode = () => props.isConstruction ? 'construction' : 'display';

    /**
     * The Add Surface is entailed, not declared: it renders iff this kind admits
     * at least one field-like child (SPEC → The Add Surface). A kind with no
     * `children` capability yields `[]` and gets no create affordance, exactly as
     * a content-free lens offers no "Add".
     *
     * Construction is excluded because the node does not exist yet, so nothing
     * can be parented to it — its defaults arrive with the node itself
     * (SPEC → Node Creation).
     */
    const admittedFieldKinds = createMemo<Kind[]>(() => {
        if (!props.kind) return [];
        return allowedChildKinds(props.kind).filter((k) => FIELD_KINDS.includes(k));
    });

    const showAddSurface = () =>
        !props.hideAddSurfaces
        && !props.isConstruction
        && ENABLED_ADD_FIELD_SURFACES.includes('add-surface')
        && admittedFieldKinds().length > 0;

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

            <Show when={showAddSurface()}>
                <AddFieldSurface
                    nodeId={props.nodeId}
                    admittedKinds={admittedFieldKinds()}
                    baseOrder={maxPersistedSiblingOrder()}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('composer')}>
                <FieldComposerSlot
                    nodeId={props.nodeId}
                    mode={mode()}
                    currentMaxCardOrder={maxPersistedSiblingOrder()}
                    initialDefinitionIds={props.initialDefinitionIds}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('legacy') && !props.isConstruction}>
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedSiblingOrder()}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>
        </div>
    );
};
