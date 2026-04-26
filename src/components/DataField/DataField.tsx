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
import { TextKvField } from './TextKvField';
import { EnumKvField } from './EnumKvField';
import { MeasurementKvField } from './MeasurementKvField';
import { SingleImageField } from './SingleImageField';
import type { ComponentType, DataFieldValue, SingleImageValue } from '../../data/models';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    fieldName: string;
    templateId: string;
    componentType: ComponentType;
    value: DataFieldValue | null;
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
            await getCommandBus().execute({ type: 'DELETE_FIELD', payload: { fieldId } });
            getSnackbarService().show({
                message: 'Field deleted',
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await getCommandBus().execute({ type: 'RESTORE_FIELD', payload: { fieldId } });
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
    const currentDisplayValue = displayPreview(props.componentType, props.value);

    return (
        <div
            class={[styles.datafieldWrapper, isDetailsExpanded && styles.datafieldWrapperExpanded, 'no-caret']}
            ref={rootRef}
        >
            <button
                type="button"
                class={styles.datafieldChevron}
                onClick$={toggleDetails$}
                aria-expanded={isDetailsExpanded}
                aria-label={isDetailsExpanded ? 'Collapse field details' : 'Expand field details'}
            >
                {isDetailsExpanded ? '▾' : '▸'}
            </button>

            <label class={styles.datafieldLabel} id={labelId}>{props.fieldName}:</label>

            {renderBody(props, rootRef)}

            {isDetailsExpanded && (
                <DataFieldDetails
                    fieldId={props.id}
                    fieldName={props.fieldName}
                    templateId={props.templateId}
                    componentType={props.componentType}
                    currentValue={currentDisplayValue}
                    onDelete$={handleDelete$}
                />
            )}
        </div>
    );
});

/**
 * Best-effort string preview of a DataField value, dispatched on componentType.
 * Used by metadata/history surfaces that need a uniform string view of the
 * current value across all Component types.
 */
function displayPreview(componentType: ComponentType, value: DataFieldValue | null): string | null {
    if (value === null || value === undefined) return null;
    switch (componentType) {
        case 'text-kv':
        case 'enum-kv':
            return value as string;
        case 'measurement-kv':
            return String(value as number);
        case 'single-image':
            return (value as SingleImageValue).caption ?? '[image]';
    }
}

function renderBody(
    props: DataFieldProps,
    rootRef: Signal<HTMLElement | undefined>,
) {
    switch (props.componentType) {
        case 'text-kv':
            return (
                <TextKvField
                    id={props.id}
                    fieldName={props.fieldName}
                    value={(props.value as string | null) ?? null}
                    rootRef={rootRef}
                    onUpdated$={props.onUpdated$}
                />
            );
        case 'enum-kv':
            return (
                <EnumKvField
                    id={props.id}
                    fieldName={props.fieldName}
                    templateId={props.templateId}
                    value={(props.value as string | null) ?? null}
                    rootRef={rootRef}
                    onUpdated$={props.onUpdated$}
                />
            );
        case 'measurement-kv':
            return (
                <MeasurementKvField
                    id={props.id}
                    fieldName={props.fieldName}
                    templateId={props.templateId}
                    value={(props.value as number | null) ?? null}
                    rootRef={rootRef}
                    onUpdated$={props.onUpdated$}
                />
            );
        case 'single-image':
            return (
                <SingleImageField
                    id={props.id}
                    fieldName={props.fieldName}
                    value={(props.value as SingleImageValue | null) ?? null}
                    rootRef={rootRef}
                    onUpdated$={props.onUpdated$}
                />
            );
    }
}
