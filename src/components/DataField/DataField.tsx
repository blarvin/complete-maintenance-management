/**
 * DataField - Thin dispatcher: renders the chevron + label + Component-specific
 * body (via kind-keyed manifest lookup). Display-only in Phase II: the chevron
 * toggles the FSM/uiPrefs expanded state, but no details panel mounts yet.
 */

import { createMemo } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { getInlineManifest } from '../../kinds/registry';
import type { Kind, DataFieldValue } from '../../data/models';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    name: string;
    definitionId: string;
    kind: Kind;
    value: DataFieldValue | null;
    /** Epoch ms when this DataField was last written. Used by number-kv for
     *  stale-state computation. */
    updatedAt?: number;
    // TODO(Phase III): restore onUpdated
};

export const DataField = (props: DataFieldProps) => {
    const appState = useAppState();
    const { toggleFieldDetailsExpanded } = useAppTransitions();

    const isDetailsExpanded = () =>
        selectors.getDataFieldDetailsState(appState, props.id) === 'EXPANDED';

    const labelId = () => `field-label-${props.id}`;

    const manifest = createMemo(() => getInlineManifest(props.kind));

    // The arrangement law, entailed by the kind's value shape (SPEC → chrome
    // entailment): scalar = label + inline run + centred chevron; block = label +
    // tall block + top chevron; composite = renderer-owned sub-structure, label
    // suppressed, tall block + top chevron. No ownValue (asset-doc — the value is
    // an Edge) → a scalar-shaped resolved read.
    const shape = () => manifest().ownValue?.shape ?? 'scalar';

    return (
        <div
            classList={{
                [styles.datafieldWrapper]: true,
                [styles.datafieldWrapperExpanded]: isDetailsExpanded(),
                [styles.datafieldWrapperBlock]: shape() !== 'scalar',
                'no-caret': true,
            }}
        >
            <button
                type="button"
                classList={{
                    [styles.datafieldChevron]: true,
                    [styles.datafieldChevronDown]: isDetailsExpanded(),
                    [styles.datafieldChevronRight]: !isDetailsExpanded(),
                }}
                onClick={() => toggleFieldDetailsExpanded(props.id)}
                aria-expanded={isDetailsExpanded()}
                aria-label={isDetailsExpanded() ? 'Collapse field details' : 'Expand field details'}
            />

            {shape() !== 'composite' && (
                <label class={styles.datafieldLabel} id={labelId()}>{props.name}:</label>
            )}

            <Dynamic
                component={manifest().Renderer}
                id={props.id}
                definitionId={props.definitionId}
                value={props.value}
                updatedAt={props.updatedAt}
                rootRef={() => { /* TODO(Phase III): outside-click root */ }}
            />

            {/* TODO(Phase III): mount <DataFieldDetails> + delete (commitWithUndo DELETE_ELEMENT/RESTORE_ELEMENT) */}
        </div>
    );
};
