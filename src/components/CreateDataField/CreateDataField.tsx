/**
 * CreateDataField - Form for creating a new field.
 * Purely UI component: handles name/value inputs, library picker, Save/Cancel.
 * Does NOT handle persistence - parent decides what to do with onSave$.
 * 
 * Used in both UC mode (defaults + added fields) and Display mode (added fields).
 */

import { component$, useSignal, $, PropFunction, useTask$ } from '@builder.io/qwik';
import { DATAFIELD_LIBRARY } from '../../constants';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    /** Unique ID for this form instance (used for keying, LS tracking) */
    id: string;
    /** Initial field name (for defaults like "Type Of") */
    initialName?: string;
    /** Initial field value */
    initialValue?: string | null;
    /** Called when user saves the field */
    onSave$: PropFunction<(id: string, fieldName: string, fieldValue: string | null) => void>;
    /** Called when user cancels */
    onCancel$: PropFunction<(id: string) => void>;
    /** Called when form values change (for LS persistence in display mode) */
    onChange$?: PropFunction<(id: string, fieldName: string, fieldValue: string | null) => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const fieldName = useSignal(props.initialName ?? '');
    const fieldValue = useSignal(props.initialValue ?? '');
    const isDropdownOpen = useSignal(false);
    const nameInputRef = useSignal<HTMLInputElement>();
    const valueInputRef = useSignal<HTMLInputElement>();
    const comboBoxRef = useSignal<HTMLDivElement>();
    const dropdownPosition = useSignal({ top: 0, left: 0, width: 0 });

    // Auto-focus name input on mount (if no initial name)
    useTask$(() => {
        if (!props.initialName) {
            setTimeout(() => {
                nameInputRef.value?.focus();
            }, 10);
        }
    });

    // Notify parent of changes (for LS persistence)
    const notifyChange$ = $(() => {
        if (props.onChange$) {
            props.onChange$(props.id, fieldName.value, fieldValue.value || null);
        }
    });

    const save$ = $(() => {
        const name = fieldName.value.trim();
        const value = fieldValue.value.trim() || null;
        props.onSave$(props.id, name, value);
    });

    const cancel$ = $(() => {
        // Blur any focused element
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        props.onCancel$(props.id);
    });

    const toggleDropdown$ = $(() => {
        if (!isDropdownOpen.value && comboBoxRef.value) {
            const rect = comboBoxRef.value.getBoundingClientRect();
            dropdownPosition.value = {
                top: rect.bottom + 2,
                left: rect.left,
                width: rect.width,
            };
        }
        isDropdownOpen.value = !isDropdownOpen.value;
    });

    const selectPrefab$ = $((name: string) => {
        fieldName.value = name;
        isDropdownOpen.value = false;
        notifyChange$();
        setTimeout(() => {
            valueInputRef.value?.focus();
        }, 10);
    });

    const handleNameInput$ = $((e: Event) => {
        fieldName.value = (e.target as HTMLInputElement).value;
        notifyChange$();
    });

    const handleValueInput$ = $((e: Event) => {
        fieldValue.value = (e.target as HTMLInputElement).value;
        notifyChange$();
    });

    const handleNameKeyDown$ = $((e: KeyboardEvent) => {
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
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            toggleDropdown$();
        } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            valueInputRef.value?.focus();
        }
    });

    const handleValueKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel$();
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            nameInputRef.value?.focus();
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

    return (
        <div class={styles.constructionWrapper}>
            <div class={styles.construction}>
                {/* Chevron button for dropdown */}
                <button
                    type="button"
                    class={styles.chevronButton}
                    onClick$={toggleDropdown$}
                    onKeyDown$={handleChevronKeyDown$}
                    aria-expanded={isDropdownOpen.value}
                    aria-label={isDropdownOpen.value ? 'Close field name picker' : 'Open field name picker'}
                    tabIndex={-1}
                >
                    <span class={[styles.chevron, isDropdownOpen.value && styles.chevronOpen]}></span>
                </button>
                
                {/* Field Name combo box */}
                <div class={styles.comboBoxWrapper} ref={comboBoxRef}>
                    <input
                        ref={nameInputRef}
                        type="text"
                        class={styles.inputName}
                        value={fieldName.value}
                        onInput$={handleNameInput$}
                        onKeyDown$={handleNameKeyDown$}
                        onFocus$={() => { isDropdownOpen.value = false; }}
                        placeholder="Field Name"
                        aria-label="Field name (press Down Arrow for library)"
                    />
                    
                    {/* Dropdown menu */}
                    {isDropdownOpen.value && (
                        <div 
                            class={styles.dropdown} 
                            role="listbox" 
                            aria-label="Prefab field names"
                            style={{
                                top: `${dropdownPosition.value.top}px`,
                                left: `${dropdownPosition.value.left}px`,
                                width: `${dropdownPosition.value.width}px`,
                            }}
                        >
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
                    ref={valueInputRef}
                    type="text"
                    class={styles.inputValue}
                    value={fieldValue.value}
                    onInput$={handleValueInput$}
                    onKeyDown$={handleValueKeyDown$}
                    placeholder="Value (optional)"
                    aria-label="Field value"
                />
            </div>
            
            {/* Save/Cancel buttons */}
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
