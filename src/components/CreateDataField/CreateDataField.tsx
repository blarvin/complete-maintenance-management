/**
 * CreateDataField - Button that activates into a combo box for creating a new field.
 * Double-tap the "+ Add Field" button to activate construction mode.
 * Enter field name (or select from prefab library) and value, then Save or Cancel.
 */

import { component$, useSignal, $, PropFunction, useOnDocument } from '@builder.io/qwik';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { fieldService } from '../../data/services/fieldService';
import { DATAFIELD_LIBRARY } from '../../constants';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    nodeId: string;
    onCreated$?: PropFunction<() => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const isConstructing = useSignal(false);
    const fieldName = useSignal('');
    const fieldValue = useSignal('');
    const isDropdownOpen = useSignal(false);
    const rootEl = useSignal<HTMLElement>();
    const nameInputRef = useSignal<HTMLInputElement>();

    const { checkDoubleTap$ } = useDoubleTap();

    const startConstruction$ = $(() => {
        isConstructing.value = true;
        fieldName.value = '';
        fieldValue.value = '';
        isDropdownOpen.value = false;
    });

    const cancel$ = $(() => {
        isConstructing.value = false;
        fieldName.value = '';
        fieldValue.value = '';
        isDropdownOpen.value = false;
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
        isDropdownOpen.value = false;
        if (props.onCreated$) {
            props.onCreated$();
        }
    });

    const toggleDropdown$ = $(() => {
        isDropdownOpen.value = !isDropdownOpen.value;
    });

    const selectPrefab$ = $((name: string) => {
        fieldName.value = name;
        isDropdownOpen.value = false;
        // Focus the value input after selecting a prefab
        // (nameInputRef is the name input, but we want to move to value)
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
            if (isDropdownOpen.value) {
                isDropdownOpen.value = false;
            } else {
                cancel$();
            }
        }
    });

    const handleChevronKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isDropdownOpen.value) {
                isDropdownOpen.value = false;
            } else {
                cancel$();
            }
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
                {/* Hollow chevron button for dropdown */}
                <button
                    type="button"
                    class={styles.chevronButton}
                    onClick$={toggleDropdown$}
                    onKeyDown$={handleChevronKeyDown$}
                    aria-expanded={isDropdownOpen.value}
                    aria-label={isDropdownOpen.value ? 'Close field name picker' : 'Open field name picker'}
                >
                    <span class={[styles.chevron, isDropdownOpen.value && styles.chevronOpen]}></span>
                </button>
                
                {/* Field Name combo box wrapper */}
                <div class={styles.comboBoxWrapper}>
                    <input
                        ref={nameInputRef}
                        type="text"
                        class={styles.inputName}
                        value={fieldName.value}
                        onInput$={(e) => (fieldName.value = (e.target as HTMLInputElement).value)}
                        onKeyDown$={handleInputKeyDown$}
                        onFocus$={() => { isDropdownOpen.value = false; }}
                        placeholder="Field Name"
                        aria-label="Field name"
                        autoFocus
                    />
                    
                    {/* Dropdown menu */}
                    {isDropdownOpen.value && (
                        <div class={styles.dropdown} role="listbox" aria-label="Prefab field names">
                            {DATAFIELD_LIBRARY.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    class={styles.dropdownItem}
                                    onClick$={() => selectPrefab$(name)}
                                    role="option"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Value input */}
                <input
                    type="text"
                    class={styles.inputValue}
                    value={fieldValue.value}
                    onInput$={(e) => (fieldValue.value = (e.target as HTMLInputElement).value)}
                    onKeyDown$={handleInputKeyDown$}
                    placeholder="Value (optional)"
                    aria-label="Field value"
                />
            </div>
            
            {/* Action buttons - right aligned */}
            <div class={styles.actions}>
                <button
                    type="button"
                    class={[styles.actionButton, styles.cancelButton]}
                    onClick$={cancel$}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class={styles.actionButton}
                    onClick$={save$}
                >
                    Save
                </button>
            </div>
        </div>
    );
});
