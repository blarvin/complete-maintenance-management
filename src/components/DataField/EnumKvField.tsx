/**
 * EnumKvField - Renderer for enum-kv DataFields.
 *
 * Click/double-tap to open a dropdown of Template.config.options. Pick an
 * option to save; Escape / outside-click cancels. `allowOther` is deferred —
 * Phase 1 MVP only shows the fixed options list.
 */

import { component$, useSignal, useResource$, Resource, useVisibleTask$, $, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useOnDocument } from '@builder.io/qwik';
import { getTemplateQueries } from '../../data/queries';
import { getCommandBus } from '../../data/commands';
import { getSnackbarService } from '../../services/snackbar';
import { toStorageError, describeForUser } from '../../data/storage/storageErrors';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import type { EnumKvConfig } from '../../data/models';
import styles from './DataField.module.css';
import dropdownStyles from '../CreateDataField/CreateDataField.module.css';

export type EnumKvFieldProps = {
    id: string;
    fieldName: string;
    templateId: string;
    value: string | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange$. */
    pendingMode?: { onChange$: QRL<(value: string | null) => void> };
};

export const EnumKvField = component$<EnumKvFieldProps>((props) => {
    const appState = useAppState();
    const { startFieldEdit$, stopFieldEdit$ } = useAppTransitions();

    const isOpen = useSignal(false);
    const currentValue = useSignal<string | null>(props.value);

    useVisibleTask$(({ track }) => {
        track(() => props.value);
        currentValue.value = props.value;
    });

    const isEditing = selectors.getDataFieldState(appState, props.id) === 'EDITING';

    const optionsResource = useResource$<string[]>(async ({ track }) => {
        track(() => props.templateId);
        const tpl = await getTemplateQueries().getTemplateById(props.templateId);
        if (!tpl || tpl.componentType !== 'enum-kv') return [];
        return (tpl.config as EnumKvConfig).options;
    });

    const open$ = $(() => {
        if (appState.editingFieldId === props.id) return;
        startFieldEdit$(props.id);
        isOpen.value = true;
    });

    const close$ = $(() => {
        if (appState.editingFieldId === props.id) stopFieldEdit$();
        isOpen.value = false;
    });

    const pick$ = $(async (option: string) => {
        const fieldId = props.id;
        const prev = currentValue.value;
        if (props.pendingMode) {
            await props.pendingMode.onChange$(option);
            currentValue.value = option;
            close$();
            if (props.onUpdated$) await props.onUpdated$();
            return;
        }
        try {
            await getCommandBus().execute({
                type: 'UPDATE_FIELD_VALUE',
                payload: { fieldId, newValue: option },
            });
            currentValue.value = option;
            close$();
            getSnackbarService().show({
                message: 'Field updated',
                action: {
                    label: 'Undo',
                    handler: $(async () => {
                        await getCommandBus().execute({
                            type: 'UPDATE_FIELD_VALUE',
                            payload: { fieldId, newValue: prev },
                        });
                    }),
                },
            });
            if (props.onUpdated$) await props.onUpdated$();
        } catch (err) {
            getSnackbarService().show({
                variant: 'error',
                message: describeForUser(toStorageError(err)),
            });
        }
    });

    useOnDocument('pointerdown', $((ev: Event) => {
        if (!isOpen.value) return;
        const container = props.rootRef.value;
        const target = ev.target as Node | null;
        if (container && target && !container.contains(target)) {
            close$();
        }
    }));

    const handleTriggerKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            open$();
        } else if (e.key === 'Escape' && isOpen.value) {
            e.preventDefault();
            close$();
        }
    });

    const displayValue = currentValue.value ?? '';
    const hasValue = !!displayValue;
    const labelId = `field-label-${props.id}`;

    return (
        <div style="display: contents">
            <div
                class={[
                    styles.datafieldValue,
                    hasValue && styles.datafieldValueUnderlined,
                    styles.datafieldValueEditable,
                    'no-caret',
                ]}
                onClick$={open$}
                onKeyDown$={handleTriggerKeyDown$}
                tabIndex={0}
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isEditing}
                aria-labelledby={labelId}
            >
                {displayValue || <span class={styles.datafieldPlaceholder}>Empty</span>}
            </div>

            {isOpen.value && (
                <div class={dropdownStyles.dropdown} role="listbox" aria-label="Options">
                    <Resource
                        value={optionsResource}
                        onPending={() => <div class={dropdownStyles.dropdownItem}>Loading…</div>}
                        onResolved={(options) => (
                            <>
                                {options.map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        class={dropdownStyles.dropdownItem}
                                        onClick$={() => pick$(opt)}
                                        role="option"
                                        aria-selected={opt === currentValue.value}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </>
                        )}
                    />
                </div>
            )}
        </div>
    );
});
