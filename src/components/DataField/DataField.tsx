/**
 * DataField - Editable field row with label:value pairs.
 * Uses FSM state for editing (only one field can edit at a time per SPEC).
 * Includes expandable DataFieldDetails section with metadata, history, and delete.
 * Supports preview mode when user selects a historical value from DataFieldHistory.
 */

import { component$, useSignal, $, useVisibleTask$, useOnDocument, PropFunction } from '@builder.io/qwik';
import { fieldService } from '../../data/services/fieldService';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { DataFieldDetails } from '../DataFieldDetails/DataFieldDetails';
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
    const { startFieldEdit$, stopFieldEdit$, toggleFieldDetailsExpanded$ } = useAppTransitions();
    
    // Get field state from FSM
    const fieldState = selectors.getDataFieldState(appState, props.id);
    const isEditing = fieldState === 'EDITING';
    
    // Get details expansion state from FSM (persisted)
    const detailsState = selectors.getDataFieldDetailsState(appState, props.id);
    const isDetailsExpanded = detailsState === 'EXPANDED';
    
    const rootEl = useSignal<HTMLElement>();
    const currentValue = useSignal<string>(props.fieldValue ?? '');
    const editValue = useSignal<string>('');
    const previewValue = useSignal<string | null>(null);
    const suppressCancelUntil = useSignal<number>(0);

    // Double-tap detection hook
    const { checkDoubleTap$ } = useDoubleTap();

    useVisibleTask$(() => {
        currentValue.value = props.fieldValue ?? '';
    });

    const beginEdit$ = $(() => {
        if (isEditing) return;
        startFieldEdit$(props.id);
        editValue.value = currentValue.value;
        // Clear preview when entering edit mode
        previewValue.value = null;
    });

    const save$ = $(async () => {
        if (!isEditing) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await fieldService.updateFieldValue(props.id, newVal);
        currentValue.value = newVal ?? '';
        stopFieldEdit$();
        if (props.onUpdated$) {
            props.onUpdated$();
        }
    });

    const cancel$ = $(() => {
        stopFieldEdit$();
        editValue.value = currentValue.value;
    });

    const toggleDetails$ = $(() => {
        toggleFieldDetailsExpanded$(props.id);
        // Clear preview when collapsing details
        if (isDetailsExpanded) {
            previewValue.value = null;
        }
    });

    const handleDelete$ = $(async () => {
        await fieldService.deleteField(props.id);
        // Notify parent to refresh the field list
        if (props.onDeleted$) {
            props.onDeleted$();
        }
    });

    const handlePreviewChange$ = $((value: string | null) => {
        previewValue.value = value;
    });

    const handleRevert$ = $(async (value: string | null) => {
        await fieldService.updateFieldValue(props.id, value);
        currentValue.value = value ?? '';
        previewValue.value = null;
        if (props.onUpdated$) {
            props.onUpdated$();
        }
    });

    // Display value: preview takes precedence if set
    const displayValue = previewValue.value !== null ? previewValue.value : currentValue.value;
    const hasValue = !!displayValue;
    const isPreviewActive = previewValue.value !== null;

    const valuePointerDown$ = $(async (ev: any) => {
        if (isEditing) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await beginEdit$();
        }
    });

    const valueKeyDown$ = $((e: KeyboardEvent) => {
        if (isEditing) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginEdit$();
        }
    });

    const inputPointerDown$ = $(async (ev: any) => {
        if (!isEditing) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        suppressCancelUntil.value = Date.now() + 220;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await save$();
        }
    });

    // Cancel edit on any outside click
    useOnDocument('pointerdown', $((ev: Event) => {
        if (!isEditing) return;
        const container = rootEl.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            cancel$();
        }
    }));

    // Generate unique ID for label association
    const labelId = `field-label-${props.id}`;

    return (
        <div class={[styles.datafieldWrapper, isDetailsExpanded && styles.datafieldWrapperExpanded]} ref={rootEl}>
            <div class={styles.datafield}>
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
                {isEditing ? (
                    <input
                        class={[styles.datafieldValue, editValue.value && styles.datafieldValueUnderlined]}
                        value={editValue.value}
                        onInput$={(e) => (editValue.value = (e.target as HTMLInputElement).value)}
                        onPointerDown$={inputPointerDown$}
                        onBlur$={$(() => {
                            if (Date.now() < suppressCancelUntil.value) return;
                            if (isEditing) cancel$();
                        })}
                        onKeyDown$={$((e) => {
                            const key = (e as KeyboardEvent).key;
                            if (key === 'Enter') {
                                // prevent form submits if any
                                e.preventDefault();
                                save$();
                            } else if (key === 'Escape') {
                                e.preventDefault();
                                cancel$();
                            }
                        })}
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
            </div>
            {isDetailsExpanded && (
                <DataFieldDetails
                    fieldId={props.id}
                    fieldName={props.fieldName}
                    currentValue={currentValue.value}
                    onDelete$={handleDelete$}
                    onPreviewChange$={handlePreviewChange$}
                    onRevert$={handleRevert$}
                />
            )}
        </div>
    );
});
