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
    /**
     * Library preview mode (DefinitionsIndex): a live microcosm. The Renderer
     * runs in `pendingMode` over local state — the value is editable in place
     * (seeded via the manifest's `previewSeed`) but nothing ever reaches the
     * command bus or sync — and Tools' Delete is disabled. The id is synthetic,
     * so no command may ever target it.
     */
    preview?: boolean;
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

    // Library-preview microcosm: the Renderer runs in `pendingMode` over this
    // local signal, so the value is live (switch an enum option, type a number,
    // watch threshold state) but no command ever reaches the bus or sync.
    // eslint-disable-next-line solid/reactivity -- the seed is read once; the preview value is local from mount on
    const [previewValue, setPreviewValue] = createSignal<DataFieldValue | null>(props.value);

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
                [styles.datafieldWrapperUnfilled]: isUnfilled(props.preview ? previewValue() : props.value),
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
                // `title` because the `label` track is fixed and long names
                // ellipsize (DataField.module.css → .datafieldLabel).
                <label class={styles.datafieldLabel} id={labelId()} title={props.name}>{props.name}:</label>
            )}

            <Dynamic
                component={manifest().Renderer}
                id={props.id}
                definitionId={props.definitionId}
                value={props.preview ? previewValue() : props.value}
                updatedAt={props.updatedAt}
                rootRef={rootEl}
                pendingMode={props.preview ? { onChange: setPreviewValue } : undefined}
            />

            <Show when={isDetailsExpanded()}>
                <DataFieldDetails
                    fieldId={props.id}
                    definitionId={props.definitionId}
                    kind={props.kind}
                    onDelete={handleDelete}
                    preview={props.preview}
                />
            </Show>
        </div>
    );
};
