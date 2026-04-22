/**
 * CreateDataField - Template picker for creating a new field.
 *
 * The user picks a Template from the library; on selection, the parent is
 * notified via onSave$ which creates a DataField instance (ADD_FIELD_FROM_TEMPLATE).
 * Phase 1 ships with no seeded templates, so the list is typically empty until the
 * follow-up SPEC templates plan lands.
 */

import { component$, useSignal, useResource$, Resource, $, PropFunction, useTask$ } from '@builder.io/qwik';
import { getTemplateQueries } from '../../data/queries';
import type { DataFieldTemplate } from '../../data/models';
import styles from './CreateDataField.module.css';

export type CreateDataFieldProps = {
    /** Unique ID for this form instance (used for keying, LS tracking) */
    id: string;
    /** Pre-selected template ID (when restored from localStorage) */
    initialTemplateId?: string;
    /** Pre-selected template label (snapshot) */
    initialTemplateLabel?: string;
    /** Called when user picks a template */
    onSave$: PropFunction<(id: string, templateId: string, templateLabel: string) => void>;
    /** Called when user cancels */
    onCancel$: PropFunction<(id: string) => void>;
    /** Called when selection changes (for LS persistence in display mode) */
    onChange$?: PropFunction<(id: string, templateId: string, templateLabel: string) => void>;
};

export const CreateDataField = component$<CreateDataFieldProps>((props) => {
    const selectedTemplateId = useSignal(props.initialTemplateId ?? '');
    const selectedLabel = useSignal(props.initialTemplateLabel ?? '');
    const isDropdownOpen = useSignal(false);
    const triggerRef = useSignal<HTMLButtonElement>();

    useTask$(() => {
        if (!props.initialTemplateId) {
            setTimeout(() => triggerRef.value?.focus(), 10);
        }
    });

    const templatesResource = useResource$<DataFieldTemplate[]>(async () => {
        return await getTemplateQueries().listTemplates();
    });

    const notifyChange$ = $((tplId: string, label: string) => {
        if (props.onChange$) {
            props.onChange$(props.id, tplId, label);
        }
    });

    const selectTemplate$ = $((tpl: DataFieldTemplate) => {
        selectedTemplateId.value = tpl.id;
        selectedLabel.value = tpl.label;
        isDropdownOpen.value = false;
        notifyChange$(tpl.id, tpl.label);
        props.onSave$(props.id, tpl.id, tpl.label);
    });

    const cancel$ = $(() => {
        props.onCancel$(props.id);
    });

    const toggleDropdown$ = $(() => {
        isDropdownOpen.value = !isDropdownOpen.value;
    });

    const handleTriggerKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            isDropdownOpen.value = true;
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
                <button
                    ref={triggerRef}
                    type="button"
                    class={styles.inputName}
                    onClick$={toggleDropdown$}
                    onKeyDown$={handleTriggerKeyDown$}
                    aria-haspopup="listbox"
                    aria-expanded={isDropdownOpen.value}
                    aria-label="Pick a field template"
                >
                    {selectedLabel.value || 'Pick a template…'}
                </button>

                {isDropdownOpen.value && (
                    <div class={styles.dropdown} role="listbox" aria-label="Field templates">
                        <Resource
                            value={templatesResource}
                            onPending={() => <div class={styles.dropdownItem}>Loading…</div>}
                            onRejected={() => <div class={styles.dropdownItem}>Failed to load templates</div>}
                            onResolved={(templates) => {
                                if (templates.length === 0) {
                                    return (
                                        <div class={styles.dropdownItem}>
                                            No templates available.
                                        </div>
                                    );
                                }
                                return (
                                    <>
                                        {templates.map((tpl) => (
                                            <button
                                                key={tpl.id}
                                                type="button"
                                                class={styles.dropdownItem}
                                                onClick$={() => selectTemplate$(tpl)}
                                                role="option"
                                            >
                                                {tpl.label}
                                            </button>
                                        ))}
                                    </>
                                );
                            }}
                        />
                    </div>
                )}
            </div>

            <div class={styles.actions}>
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
