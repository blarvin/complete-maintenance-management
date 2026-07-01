/**
 * DataField - Thin dispatcher: renders the chevron + label + Component-specific
 * body (via kind-keyed manifest lookup) + optional DataFieldDetails.
 *
 * The owning rootRef is created here so outside-click detection inside each
 * renderer covers the entire row (chevron, label, value), not just the value
 * column.
 */

import { component$, useSignal, $, type PropFunction, type Signal } from '@builder.io/qwik';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { DataFieldDetails } from '../DataFieldDetails/DataFieldDetails';
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
    onUpdated$?: PropFunction<() => void>;
};

export const DataField = component$<DataFieldProps>((props) => {
    const appState = useAppState();
    const { toggleFieldDetailsExpanded$ } = useAppTransitions();

    const rootRef = useSignal<HTMLElement>();

    const detailsState = selectors.getDataFieldDetailsState(appState, props.id);
    const isDetailsExpanded = detailsState === 'EXPANDED';

    const toggleDetails$ = $(() => {
        toggleFieldDetailsExpanded$(props.id);
    });

    const handleDelete$ = $(async () => {
        const fieldId = props.id;
        await commitWithUndo({
            message: 'Field deleted',
            execute$: $(() => getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id: fieldId } })),
            undo$: $(() => getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id: fieldId } })),
        });
    });

    const labelId = `field-label-${props.id}`;

    const manifest = getInlineManifest(props.kind);

    // Used by DataFieldDetails for metadata and (future) history-value preview.
    const currentDisplayValue = manifest.displayPreview(props.value);

    return (
        <div
            class={[
                styles.datafieldWrapper,
                isDetailsExpanded && styles.datafieldWrapperExpanded,
                manifest.blockValueLayout && styles.datafieldWrapperImage,
                'no-caret',
            ]}
            ref={rootRef}
        >
            <button
                type="button"
                class={[
                    styles.datafieldChevron,
                    isDetailsExpanded ? styles.datafieldChevronDown : styles.datafieldChevronRight,
                ]}
                onClick$={toggleDetails$}
                aria-expanded={isDetailsExpanded}
                aria-label={isDetailsExpanded ? 'Collapse field details' : 'Expand field details'}
            />


            {!manifest.hideLabel && (
                <label class={styles.datafieldLabel} id={labelId}>{props.name}:</label>
            )}

            {renderBody(props, rootRef)}

            {isDetailsExpanded && (
                <DataFieldDetails
                    fieldId={props.id}
                    definitionId={props.definitionId}
                    kind={props.kind}
                    currentValue={currentDisplayValue}
                    onDelete$={handleDelete$}
                />
            )}
        </div>
    );
});

function renderBody(
    props: DataFieldProps,
    rootRef: Signal<HTMLElement | undefined>,
) {
    const Renderer = getInlineManifest(props.kind).Renderer;
    return (
        <Renderer
            id={props.id}
            definitionId={props.definitionId}
            value={props.value}
            updatedAt={props.updatedAt}
            rootRef={rootRef}
            onUpdated$={props.onUpdated$}
        />
    );
}
