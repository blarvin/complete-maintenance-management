import { component$, useSignal, $, useVisibleTask$, useOnDocument } from '@builder.io/qwik';
import { fieldService } from '../../data/services/fieldService';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import styles from './DataField.module.css';

export type DataFieldProps = {
    id: string;
    fieldName: string;
    fieldValue: string | null;
};

export const DataField = component$<DataFieldProps>((props) => {
    const isEditing = useSignal<boolean>(false);
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
        if (isEditing.value) return;
        isEditing.value = true;
        editValue.value = currentValue.value;
    });

    const save$ = $(async () => {
        if (!isEditing.value) return;
        const newVal = editValue.value.trim() === '' ? null : editValue.value;
        await fieldService.updateFieldValue(props.id, newVal);
        currentValue.value = newVal ?? '';
        isEditing.value = false;
    });

    const cancel$ = $(() => {
        isEditing.value = false;
        editValue.value = currentValue.value;
    });

    const hasValue = !!currentValue.value;

    const valuePointerDown$ = $(async (ev: any) => {
        if (isEditing.value) return;
        const e = ev as PointerEvent | MouseEvent;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await beginEdit$();
        }
    });

    const valueKeyDown$ = $((e: KeyboardEvent) => {
        if (isEditing.value) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            beginEdit$();
        }
    });

    const inputPointerDown$ = $(async (ev: any) => {
        if (!isEditing.value) return;
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
        if (!isEditing.value) return;
        const container = rootEl.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            cancel$();
        }
    }));

    // Generate unique ID for label association
    const labelId = `field-label-${props.id}`;

    return (
        <div class={styles.datafield} ref={rootEl}>
            <label class={styles.datafieldLabel} id={labelId}>{props.fieldName}:</label>
            {isEditing.value ? (
                <input
                    class={[styles.datafieldValue, editValue.value && styles.datafieldValueUnderlined]}
                    value={editValue.value}
                    onInput$={(e) => (editValue.value = (e.target as HTMLInputElement).value)}
                    onPointerDown$={inputPointerDown$}
                    onBlur$={$(() => {
                        if (Date.now() < suppressCancelUntil.value) return;
                        if (isEditing.value) cancel$();
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
    );
});


