/**
 * DataField - Editable field row with label:value pairs.
 * 
 * Orchestrates the field display, editing, and details sections.
 * Edit logic is delegated to useFieldEdit hook for reusability.
 */

import { component$, $, PropFunction } from '@builder.io/qwik';
import { getFieldService } from '../../data/services';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { DataFieldDetails } from '../DataFieldDetails/DataFieldDetails';
import { triggerSync } from '../../hooks/useSyncTrigger';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
    onDeleted$?: PropFunction<() => void>;
    onUpdated$?: PropFunction<() => void>;
};

export const DataField = component$<DataFieldProps>((props) => {
    const appState = useAppState();
    const { toggleFieldDetailsExpanded$ } = useAppTransitions();
    
    // Get details expansion state from FSM (persisted)
    const detailsState = selectors.getDataFieldDetailsState(appState, props.id);
    const isDetailsExpanded = detailsState === 'EXPANDED';
    
    // Edit state and handlers from hook
    const {
        isEditing,
        displayValue,
        isPreviewActive,
        hasValue,
        editValue,
        editInputRef,
        rootRef,
        valuePointerDown$,
        valueKeyDown$,
        inputPointerDown$,
        inputBlur$,
        inputKeyDown$,
        inputChange$,
        setPreview$,
        revert$,
        clearPreview$,
    } = useFieldEdit({
        fieldId: props.id,
        initialValue: props.fieldValue,
        onUpdated$: props.onUpdated$,
    });

    const toggleDetails$ = $(() => {
        const wasExpanded = selectors.getDataFieldDetailsState(appState, props.id) === 'EXPANDED';
        toggleFieldDetailsExpanded$(props.id);
        // Clear preview when collapsing details
        if (wasExpanded) {
            clearPreview$();
        }
    });

    const handleDelete$ = $(async () => {
        await getFieldService().deleteField(props.id);
        triggerSync();
        if (props.onDeleted$) {
            props.onDeleted$();
        }
    });

    const labelId = `field-label-${props.id}`;

    return (
        <div 
            class={[styles.datafieldWrapper, isDetailsExpanded && styles.datafieldWrapperExpanded, 'no-caret']} 
            ref={rootRef}
        >
            <div class={[styles.datafield, 'no-caret']}>
                {/* Column 1: Details chevron */}
                <button
                    type="button"
                    class={styles.datafieldChevron}
                    onClick$={toggleDetails$}
                    aria-expanded={isDetailsExpanded}
                    aria-label={isDetailsExpanded ? 'Collapse field details' : 'Expand field details'}
                >
                    {isDetailsExpanded ? '▾' : '▸'}
                </button>
                
                {/* Column 2: Field name */}
                <label class={styles.datafieldLabel} id={labelId}>{props.fieldName}:</label>
                
                {/* Column 3: Field value (edit or display mode) */}
                {isEditing ? (
                    <input
                        ref={editInputRef}
                        class={[styles.datafieldValue, editValue.value && styles.datafieldValueUnderlined]}
                        value={editValue.value}
                        onInput$={(e) => inputChange$((e.target as HTMLInputElement).value)}
                        onPointerDown$={inputPointerDown$}
                        onBlur$={inputBlur$}
                        onKeyDown$={inputKeyDown$}
                        aria-labelledby={labelId}
                        autoFocus
                    />
                ) : (
                    <div 
                        class={[
                            styles.datafieldValue, 
                            hasValue && styles.datafieldValueUnderlined, 
                            styles.datafieldValueEditable,
                            isPreviewActive && styles.datafieldValuePreview,
                            'no-caret',
                        ]} 
                        onPointerDown$={valuePointerDown$}
                        onKeyDown$={valueKeyDown$}
                        tabIndex={0}
                        role="button"
                        aria-labelledby={labelId}
                        aria-description="Press Enter to edit"
                    >
                        {displayValue || <span class={styles.datafieldPlaceholder}>Empty</span>}
                    </div>
                )}
                
                {/* Columns 4-6: DataFieldDetails when expanded */}
                {isDetailsExpanded && (
                    <DataFieldDetails
                        fieldId={props.id}
                        fieldName={props.fieldName}
                        currentValue={displayValue}
                        onDelete$={handleDelete$}
                        onPreviewChange$={setPreview$}
                        onRevert$={revert$}
                    />
                )}
            </div>
        </div>
    );
});
