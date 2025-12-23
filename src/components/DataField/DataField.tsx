/**
 * DataField - Editable field row with label:value pairs.
 * Uses FSM state for editing (only one field can edit at a time per SPEC).
 * Includes expandable DataFieldDetails section with metadata, history, and delete.
 * Supports preview mode when user selects a historical value from DataFieldHistory.
 */

import { component$, useSignal, $, useVisibleTask$, useOnDocument, PropFunction, useTask$ } from '@builder.io/qwik';
import { getFieldService } from '../../data/services';
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
    const editInputRef = useSignal<HTMLInputElement>();
    const currentValue = useSignal<string>(props.fieldValue ?? '');
    const editValue = useSignal<string>('');
    const previewValue = useSignal<string | null>(null);
    const suppressCancelUntil = useSignal<number>(0);
    const focusTimeoutId = useSignal<number | null>(null);
    
    // Set cursor position at end of text when entering edit mode
    // Track the actual editingFieldId to ensure proper reactivity
    useTask$(({ track, cleanup }) => {
        const editingId = track(() => appState.editingFieldId);
        const thisFieldIsEditing = editingId === props.id;
        
        // Clear any pending focus timeout
        if (focusTimeoutId.value !== null) {
            clearTimeout(focusTimeoutId.value);
            focusTimeoutId.value = null;
        }
        
        if (thisFieldIsEditing) {
            // Schedule focus with cursor at end
            focusTimeoutId.value = window.setTimeout(() => {
                // Double-check this field is still the one being edited
                if (appState.editingFieldId === props.id && editInputRef.value) {
                    const input = editInputRef.value;
                    const len = input.value.length;
                    input.focus();
                    input.setSelectionRange(len, len);
                }
                focusTimeoutId.value = null;
            }, 10) as unknown as number;
        }
        
        cleanup(() => {
            if (focusTimeoutId.value !== null) {
                clearTimeout(focusTimeoutId.value);
                focusTimeoutId.value = null;
            }
        });
    });

    // Double-tap detection hook
    const { checkDoubleTap$ } = useDoubleTap();

    useVisibleTask$(() => {
        currentValue.value = props.fieldValue ?? '';
    });

    const beginEdit$ = $(() => {
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId === props.id) return;
        startFieldEdit$(props.id);
        editValue.value = currentValue.value;
        // Clear preview when entering edit mode
        previewValue.value = null;
    });

    const save$ = $(async () => {
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId !== props.id) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await getFieldService().updateFieldValue(props.id, newVal);
        currentValue.value = newVal ?? '';
        stopFieldEdit$();
        if (props.onUpdated$) {
            props.onUpdated$();
        }
    });

    const cancel$ = $(() => {
        // Only cancel if this field is actually being edited
        if (appState.editingFieldId !== props.id) return;
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
        await getFieldService().deleteField(props.id);
        // Notify parent to refresh the field list
        if (props.onDeleted$) {
            props.onDeleted$();
        }
    });

    const handlePreviewChange$ = $((value: string | null) => {
        previewValue.value = value;
    });

    const handleRevert$ = $(async (value: string | null) => {
        await getFieldService().updateFieldValue(props.id, value);
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
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId === props.id) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await beginEdit$();
        }
    });

    const valueKeyDown$ = $((e: KeyboardEvent) => {
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId === props.id) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginEdit$();
        }
    });

    const inputPointerDown$ = $(async (ev: any) => {
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId !== props.id) return;
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
        // Check actual state directly to avoid stale derived values
        if (appState.editingFieldId !== props.id) return;
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
            {/* Main row: 6-column grid with columns 4-6 filled when expanded */}
            <div class={styles.datafield}>
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
                {/* Column 3: Field value */}
                {isEditing ? (
                    <input
                        ref={editInputRef}
                        class={[styles.datafieldValue, editValue.value && styles.datafieldValueUnderlined]}
                        value={editValue.value}
                        onInput$={(e) => (editValue.value = (e.target as HTMLInputElement).value)}
                        onPointerDown$={inputPointerDown$}
                        onBlur$={$(() => {
                            if (Date.now() < suppressCancelUntil.value) return;
                            // Check actual state, not derived value, to avoid stale checks
                            if (appState.editingFieldId === props.id) {
                                cancel$();
                            }
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
                {/* Columns 4-6: Filled by DataFieldDetails when expanded (using display:contents) */}
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
        </div>
    );
});
