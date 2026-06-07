/**
 * DataField - Thin dispatcher: renders the chevron + label + Component-specific
 * body (via componentType switch) + optional DataFieldDetails.
 *
 * The owning rootRef is created here so outside-click detection inside each
 * renderer covers the entire row (chevron, label, value), not just the value
 * column.
 */

import { component$, useSignal, $, type PropFunction, type Signal } from '@builder.io/qwik';
import { getCommandBus } from '../../data/commands';
import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../../data/storage/storageErrors';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { DataFieldDetails } from '../DataFieldDetails/DataFieldDetails';
import { getKindManifest } from '../../kinds/registry';
import type { ComponentType, DataFieldValue } from '../../data/models';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    fieldName: string;
    fieldDefinitionId: string;
    componentType: ComponentType;
    value: DataFieldValue | null;
    /** Epoch ms when this DataField was last written. Used by number-kv for
     *  stale-state computation. */
    updatedAt?: number;
    onDeleted$?: PropFunction<() => void>;
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
        try {
            await getCommandBus().execute({ type: 'DELETE_ELEMENT', payload: { id: fieldId } });
            getSnackbarService().show({
                message: 'Field deleted',
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await getCommandBus().execute({ type: 'RESTORE_ELEMENT', payload: { id: fieldId } });
                    }),
                },
            });
            if (props.onDeleted$) {
                props.onDeleted$();
            }
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: describeForUser(toStorageError(err)),
            });
        }
    });

    const labelId = `field-label-${props.id}`;

    // Used by DataFieldDetails for metadata and (future) history-value preview.
    const currentDisplayValue = getKindManifest(props.componentType).displayPreview(props.value);

    const isImageVariant = props.componentType === 'single-image';

    return (
        <div
            class={[
                styles.datafieldWrapper,
                isDetailsExpanded && styles.datafieldWrapperExpanded,
                isImageVariant && styles.datafieldWrapperImage,
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


            {props.componentType !== 'single-image' && (
                <label class={styles.datafieldLabel} id={labelId}>{props.fieldName}:</label>
            )}

            {renderBody(props, rootRef)}

            {isDetailsExpanded && (
                <DataFieldDetails
                    fieldId={props.id}
                    fieldName={props.fieldName}
                    fieldDefinitionId={props.fieldDefinitionId}
                    componentType={props.componentType}
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
    const Renderer = getKindManifest(props.componentType).Renderer;
    return (
        <Renderer
            id={props.id}
            fieldName={props.fieldName}
            fieldDefinitionId={props.fieldDefinitionId}
            value={props.value}
            updatedAt={props.updatedAt}
            rootRef={rootRef}
            onUpdated$={props.onUpdated$}
        />
    );
}
