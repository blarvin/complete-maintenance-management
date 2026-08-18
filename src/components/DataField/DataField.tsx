/**
 * DataField - Thin dispatcher: renders the chevron + label + Component-specific
 * body (via kind-keyed manifest lookup) + optional DataFieldDetails.
 */

import { Show, createMemo, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { DataFieldDetails } from '../DataFieldDetails/DataFieldDetails';
import { useRevealOnArrival } from '../../hooks/useRevealOnArrival';
import { getInlineManifest } from '../../kinds/registry';
import { isUnfilled } from '../../data/models';
import type { Kind, DataFieldValue, DefinitionConfig } from '../../data/models';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    name: string;
    /**
     * Nullable because a **config Field** is a row here too (a Definition's Data
     * Card in the Library) and a config Field is bound to no Definition —
     * `definitionId: null` is the third case of the identity column (SPEC → *What
     * identifies a Definition*). Such a row is handed its `config` directly
     * instead, by whoever knows the schema.
     */
    definitionId: string | null;
    kind: Kind;
    value: DataFieldValue | null;
    /** Epoch ms when this DataField was last written. Used by number-kv for
     *  stale-state computation. */
    updatedAt?: number;
    /**
     * Config supplied by the caller instead of fetched from a Definition. Two
     * callers: the Add Surface's draft row (which has no Definition yet) and a
     * config Field in the Library (which never will). Without it a config row's
     * renderer waits forever on a resource whose source is null.
     */
    config?: DefinitionConfig;
    /** Write-once: the row displays but never opens an editor. The `kind` Field on
     *  a Definition is the only user (SPEC → *The defined kind is a config Field*). */
    readOnly?: boolean;
};

export const DataField = (props: DataFieldProps) => {
    const appState = useAppState();
    const { toggleFieldDetailsExpanded } = useAppTransitions();

    // The row ref is owned here so outside-click detection inside each renderer
    // covers the entire row (chevron, label, value), not just the value column.
    const [rootEl, setRootEl] = createSignal<HTMLElement>();

    // The same row ref doubles as the reveal target: an `internal-link` pointing
    // at this Field centres and flashes it here rather than re-rooting to it.
    const isRevealed = useRevealOnArrival(() => props.id, rootEl);

    const isDetailsExpanded = () =>
        selectors.getDataFieldDetailsState(appState, props.id) === 'EXPANDED';

    const handleDelete = () => {
        const fieldId = props.id;
        void commitWithUndo({
            message: 'Field deleted',
            execute: () => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id: fieldId } }),
            undo: () => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id: fieldId } }),
        });
    };

    const labelId = () => `field-label-${props.id}`;

    const manifest = createMemo(() => getInlineManifest(props.kind));

    // The arrangement law, entailed by the kind's value shape (SPEC → chrome
    // entailment): scalar = label + inline run + centred chevron; block = label +
    // tall block + top chevron; composite = renderer-owned sub-structure, label
    // suppressed, tall block + top chevron. No ownValue (internal-link — the value
    // is an Edge) → a scalar-shaped resolved read.
    const shape = () => manifest().ownValue?.shape ?? 'scalar';

    return (
        <div
            ref={setRootEl}
            classList={{
                [styles.datafieldWrapper]: true,
                [styles.datafieldWrapperExpanded]: isDetailsExpanded(),
                [styles.datafieldWrapperBlock]: shape() !== 'scalar',
                // Derived, not stored — a card shows at a glance which facts are
                // still owed (SPEC → DataField States → isUnfilled).
                [styles.datafieldWrapperUnfilled]: isUnfilled(props.value),
                [styles.datafieldWrapperRevealed]: isRevealed(),
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
                // `''` rather than null: every renderer uses this as a
                // `createResource` source, and a falsy source is what skips the
                // fetch a config row has nothing to fetch from.
                definitionId={props.definitionId ?? ''}
                config={props.config}
                readOnly={props.readOnly}
                value={props.value}
                updatedAt={props.updatedAt}
                rootRef={rootEl}
            />

            <Show when={isDetailsExpanded()}>
                <DataFieldDetails
                    fieldId={props.id}
                    definitionId={props.definitionId}
                    kind={props.kind}
                    onDelete={handleDelete}
                />
            </Show>
        </div>
    );
};
