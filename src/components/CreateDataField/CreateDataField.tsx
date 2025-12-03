/**
 * CreateDataField - Button that activates into two text inputs for creating a new field.
 * Double-tap the "+ Add Field" button to activate construction mode.
 * Enter field name and value, then Save or Cancel.
 */

import { component$, useSignal, $, PropFunction, useOnDocument } from '@builder.io/qwik';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { fieldService } from '../../data/services/fieldService';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    nodeId: string;
    onCreated$?: PropFunction<() => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const isConstructing = useSignal(false);
    const fieldName = useSignal('');
    const fieldValue = useSignal('');
    const rootEl = useSignal<HTMLElement>();
    const nameInputRef = useSignal<HTMLInputElement>();

    const { checkDoubleTap$ } = useDoubleTap();

    const startConstruction$ = $(() => {
        isConstructing.value = true;
        fieldName.value = '';
        fieldValue.value = '';
    });

    const cancel$ = $(() => {
        isConstructing.value = false;
        fieldName.value = '';
        fieldValue.value = '';
    });

    const save$ = $(async () => {
        const name = fieldName.value.trim();
        if (!name) {
            // Field name is required - just cancel if empty
            cancel$();
            return;
        }
        const value = fieldValue.value.trim() || null;
        await fieldService.addField(props.nodeId, name, value);
        isConstructing.value = false;
        fieldName.value = '';
        fieldValue.value = '';
        if (props.onCreated$) {
            props.onCreated$();
        }
    });

    const handleButtonPointerDown$ = $(async (ev: any) => {
        const e = ev as PointerEvent | MouseEvent;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) {
            await startConstruction$();
        }
    });

    const handleButtonKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startConstruction$();
        }
    });

    const handleInputKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel$();
        }
    });

    // Cancel on outside click
    useOnDocument('pointerdown', $((ev: Event) => {
        if (!isConstructing.value) return;
        const container = rootEl.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            cancel$();
        }
    }));

    if (!isConstructing.value) {
        return (
            <button
                type="button"
                class={styles.addButton}
                onPointerDown$={handleButtonPointerDown$}
                onKeyDown$={handleButtonKeyDown$}
                aria-label="Add new field (double-tap to activate)"
            >
                + Add Field
            </button>
        );
    }

    return (
        <div class={styles.constructionWrapper} ref={rootEl}>
            <div class={styles.construction}>
                <span class={styles.chevronPlaceholder}></span>
                <input
                    ref={nameInputRef}
                    type="text"
                    class={[styles.input, styles.inputLabel]}
                    value={fieldName.value}
                    onInput$={(e) => (fieldName.value = (e.target as HTMLInputElement).value)}
                    onKeyDown$={handleInputKeyDown$}
                    placeholder="Field Name"
                    aria-label="Field name"
                    autoFocus
                />
                <input
                    type="text"
                    class={[styles.input, styles.inputValue]}
                    value={fieldValue.value}
                    onInput$={(e) => (fieldValue.value = (e.target as HTMLInputElement).value)}
                    onKeyDown$={handleInputKeyDown$}
                    placeholder="Value (optional)"
                    aria-label="Field value"
                />
            </div>
            <div class={styles.actions}>
                <button
                    type="button"
                    class={styles.actionButton}
                    onClick$={save$}
                >
                    Save
                </button>
                <button
                    type="button"
                    class={[styles.actionButton, styles.cancelButton]}
                    onClick$={cancel$}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
});

