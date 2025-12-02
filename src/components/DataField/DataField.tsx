/**
 * DataField - Editable field row with label:value pairs.
 * Uses FSM state for editing (only one field can edit at a time per SPEC).
 * Includes expandable DataFieldDetails section with metadata and delete.
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
    });

    const save$ = $(async () => {
        if (!isEditing) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await fieldService.updateFieldValue(props.id, newVal);
        currentValue.value = newVal ?? '';
        stopFieldEdit$();
    });

    const cancel$ = $(() => {
        stopFieldEdit$();
        editValue.value = currentValue.value;
    });

    const toggleDetails$ = $(() => {
        toggleFieldDetailsExpanded$(props.id);
    });

    const handleDelete$ = $(async () => {
        await fieldService.deleteField(props.id);
        // Notify parent to refresh the field list
        if (props.onDeleted$) {
            props.onDeleted$();
        }
    });

    const hasValue = !!currentValue.value;

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
                        class={[styles.datafieldValue, hasValue && styles.datafieldValueUnderlined, styles.datafieldValueEditable]} 
                        onPointerDown$={valuePointerDown$}
                        onKeyDown$={valueKeyDown$}
                        tabIndex={0}
                        role="button"
                        aria-labelledby={labelId}
                        aria-description="Press Enter to edit"
                    >
                        {currentValue.value || <span class={styles.datafieldPlaceholder}>Empty</span>}
                    </div>
                )}
            </div>
            {isDetailsExpanded && (
                <DataFieldDetails
                    fieldId={props.id}
                    onDelete$={handleDelete$}
                />
            )}
        </div>
    );
});
