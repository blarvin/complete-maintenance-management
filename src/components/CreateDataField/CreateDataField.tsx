/**
 * CreateDataField - Button that activates into a combo box for creating a new field.
 * Double-tap the "+ Add Field" button to activate construction mode.
 * Enter field name (or select from prefab library) and value, then Save or Cancel.
 */

import { component$, useSignal, $, PropFunction, useOnDocument, useTask$ } from '@builder.io/qwik';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { getFieldService } from '../../data/services';
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
    const valueInputRef = useSignal<HTMLInputElement>();
    const comboBoxRef = useSignal<HTMLDivElement>();
    const dropdownPosition = useSignal({ top: 0, left: 0, width: 0 });

    const { checkDoubleTap$ } = useDoubleTap();

    // Auto-focus name input when construction mode starts
    useTask$(({ track }) => {
        const constructing = track(() => isConstructing.value);
        if (constructing) {
            // Schedule focus after render
            setTimeout(() => {
                nameInputRef.value?.focus();
            }, 10);
        }
    });

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
        await getFieldService().addField(props.nodeId, name, value);
        isConstructing.value = false;
        fieldName.value = '';
        fieldValue.value = '';
        isDropdownOpen.value = false;
        if (props.onCreated$) {
            props.onCreated$();
        }
    });

    const toggleDropdown$ = $(() => {
        if (!isDropdownOpen.value && comboBoxRef.value) {
            // Calculate position before opening
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
        // Focus the value input after selecting a prefab
        setTimeout(() => {
            valueInputRef.value?.focus();
        }, 10);
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

    // Key handler for name input - includes down arrow to open picklist and tab to move to value
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
            // Tab forward: move to value input
            e.preventDefault();
            valueInputRef.value?.focus();
        }
    });

    // Key handler for value input
    const handleValueKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel$();
        } else if (e.key === 'Tab' && e.shiftKey) {
            // Shift+Tab: move back to name input
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
                {/* Hollow chevron button for dropdown - tabindex=-1 to keep it out of tab flow */}
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
                
                {/* Field Name combo box wrapper */}
                <div class={styles.comboBoxWrapper} ref={comboBoxRef}>
                    <input
                        ref={nameInputRef}
                        type="text"
                        class={styles.inputName}
                        value={fieldName.value}
                        onInput$={(e) => (fieldName.value = (e.target as HTMLInputElement).value)}
                        onKeyDown$={handleNameKeyDown$}
                        onFocus$={() => { isDropdownOpen.value = false; }}
                        placeholder="Field Name"
                        aria-label="Field name (press Down Arrow for library)"
                    />
                    
                    {/* Dropdown menu - position:fixed to escape all parent containers */}
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
                    onInput$={(e) => (fieldValue.value = (e.target as HTMLInputElement).value)}
                    onKeyDown$={handleValueKeyDown$}
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
