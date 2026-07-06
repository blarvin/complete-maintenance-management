/**
 * EnumKvField - Renderer for enum-kv DataFields.
 *
 * Click/double-tap to open a dropdown of Definition.config.options. Pick
 * an option to save; Escape / outside-click cancels. `allowOther` is deferred —
 * Phase 1 MVP only shows the fixed options list.
 */

import { component$, useSignal, useResource$, Resource, useVisibleTask$, $, type PropFunction, type Signal, type QRL } from '@builder.io/qwik';
import { useOnDocument, useOnWindow } from '@builder.io/qwik';
import { getDefinitionQueries } from '../../data/queries';
import { getCommandBus } from '../../data/commands';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { useDoubleTap } from '../../hooks/useDoubleTap';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import type { EnumKvConfig } from '../../data/models';
import styles from './DataField.module.css';
import dropdownStyles from '../CreateDataField/CreateDataField.module.css';
import enumStyles from './EnumKvField.module.css';

export type EnumKvFieldProps = {
    id: string;
    definitionId: string;
    value: string | null;
    rootRef: Signal<HTMLElement | undefined>;
    onUpdated$?: PropFunction<() => void>;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange$.
     *  `autoFocus` flags the row as just-ticked-by-user so the popover should
     *  auto-open and focus its first option; seeded rows leave it false. */
    pendingMode?: { onChange$: QRL<(value: string | null) => void>; autoFocus?: boolean };
};

export const EnumKvField = component$<EnumKvFieldProps>((props) => {
    const appState = useAppState();
    const { startFieldEdit$, stopFieldEdit$ } = useAppTransitions();

    const { checkDoubleTap$ } = useDoubleTap();

    const isOpen = useSignal(false);
    const currentValue = useSignal<string | null>(props.value);
    const triggerRef = useSignal<HTMLElement>();
    const popoverRef = useSignal<HTMLElement>();
    const popoverPos = useSignal<{ top: number; left: number }>({ top: 0, left: 0 });
    // When config.allowOther is true, "Other…" swaps the option list for an
    // inline text input so the user can type a custom value.
    const otherMode = useSignal(false);
    const otherText = useSignal('');
    const otherInputRef = useSignal<HTMLInputElement>();

    useFieldValueSync<string>(props.id, currentValue);

    const isEditing = selectors.getDataFieldState(appState, props.id) === 'EDITING';

    const positionPopover$ = $(() => {
        const trigger = triggerRef.value;
        const popover = popoverRef.value;
        if (!trigger || !popover) return;
        const r = trigger.getBoundingClientRect();
        const margin = 8;
        const popWidth = popover.offsetWidth || 200;
        const popHeight = popover.offsetHeight || 200;
        let left = r.left;
        if (left + popWidth > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - popWidth - margin);
        }
        let top = r.bottom + 4;
        if (top + popHeight > window.innerHeight - margin) {
            const above = r.top - 4 - popHeight;
            if (above >= margin) top = above;
        }
        popoverPos.value = { top, left };
    });

    const optionsResource = useResource$<{ options: string[]; allowOther: boolean }>(async ({ track }) => {
        track(() => props.definitionId);
        const def = await getDefinitionQueries().getDefinitionById(props.definitionId);
        if (!def || def.kind !== 'enum-kv') return { options: [], allowOther: false };
        const config = def.config as EnumKvConfig;
        return { options: config.options, allowOther: config.allowOther ?? false };
    });

    const open$ = $(() => {
        if (appState.editingElementId === props.id) return;
        startFieldEdit$(props.id);
        isOpen.value = true;
    });

    const close$ = $(() => {
        if (appState.editingElementId === props.id) stopFieldEdit$();
        isOpen.value = false;
        otherMode.value = false;
        otherText.value = '';
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
        const ok = await commitWithUndo({
            message: 'Field updated',
            execute$: $(() => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: option } })),
            undo$: $(() => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prev } })),
        });
        if (ok) {
            currentValue.value = option;
            close$();
            if (props.onUpdated$) await props.onUpdated$();
        }
    });

    const startOther$ = $(() => {
        otherMode.value = true;
        otherText.value = '';
        setTimeout(() => {
            positionPopover$();
            otherInputRef.value?.focus();
        }, 0);
    });

    const commitOther$ = $(async () => {
        const trimmed = otherText.value.trim();
        if (trimmed === '') return;
        await pick$(trimmed);
    });

    const handleOtherKeyDown$ = $(async (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await commitOther$();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close$();
            triggerRef.value?.focus();
        }
    });

    useOnDocument('pointerdown', $((ev: Event) => {
        if (!isOpen.value) return;
        const container = props.rootRef.value;
        const popover = popoverRef.value;
        const target = ev.target as Node | null;
        if (!target) return;
        const insideRow = !!(container && container.contains(target));
        const insidePopover = !!(popover && popover.contains(target));
        if (!insideRow && !insidePopover) {
            close$();
        }
    }));

    // Reposition on scroll / resize so the popover tracks its trigger.
    useOnWindow('scroll', $(() => { if (isOpen.value) positionPopover$(); }));
    useOnWindow('resize', $(() => { if (isOpen.value) positionPopover$(); }));

    const focusOption$ = $((index: number) => {
        const popover = popoverRef.value;
        if (!popover) return;
        const items = popover.querySelectorAll<HTMLButtonElement>('[role="option"]');
        if (items.length === 0) return;
        const clamped = ((index % items.length) + items.length) % items.length;
        items[clamped]?.focus();
    });

    // Auto-open + focus first option when mounted in pendingMode with no value
    // AND this row is the one the user just ticked (autoFocus). Seeded rows
    // (construction defaults / Undo restore) skip this so the composer opens
    // with no field stealing focus.
    useVisibleTask$(({ cleanup }) => {
        if (!props.pendingMode?.autoFocus) return;
        if (currentValue.value !== null) return;
        open$();
        const t = setTimeout(() => {
            positionPopover$();
            focusOption$(0);
        }, 0);
        cleanup(() => clearTimeout(t));
    });

    // Track open transitions to position + focus on subsequent opens too.
    useVisibleTask$(({ track }) => {
        const open = track(() => isOpen.value);
        if (!open) return;
        const t = setTimeout(() => {
            positionPopover$();
            // Keep focus on the popover's first option for keyboard users.
            const popover = popoverRef.value;
            const active = document.activeElement;
            if (popover && (!active || !popover.contains(active))) {
                focusOption$(0);
            }
        }, 0);
        return () => clearTimeout(t);
    });

    const handleTriggerPointerDown$ = $(async (ev: PointerEvent | MouseEvent) => {
        if (isOpen.value) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        const isDouble = await checkDoubleTap$(x, y);
        if (isDouble) open$();
    });

    const handleTriggerKeyDown$ = $((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            open$();
        } else if (e.key === 'Escape' && isOpen.value) {
            e.preventDefault();
            close$();
        }
    });

    const handleOptionKeyDown$ = $((e: KeyboardEvent, index: number) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusOption$(index + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusOption$(index - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            focusOption$(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            const popover = popoverRef.value;
            const count = popover?.querySelectorAll('[role="option"]').length ?? 0;
            focusOption$(count - 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close$();
            triggerRef.value?.focus();
        }
    });

    const displayValue = currentValue.value ?? '';
    const hasValue = !!displayValue;
    const labelId = `field-label-${props.id}`;

    return (
        <div style="display: contents">
            <div
                ref={triggerRef}
                class={[
                    styles.datafieldValue,
                    hasValue && styles.datafieldValueUnderlined,
                    styles.datafieldValueEditable,
                    'no-caret',
                ]}
                onPointerDown$={handleTriggerPointerDown$}
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
                <div
                    ref={popoverRef}
                    class={enumStyles.popover}
                    role="listbox"
                    aria-label="Options"
                    style={{ top: `${popoverPos.value.top}px`, left: `${popoverPos.value.left}px` }}
                >
                    <Resource
                        value={optionsResource}
                        onPending={() => <div class={dropdownStyles.dropdownItem}>Loading…</div>}
                        onResolved={({ options, allowOther }) => (
                            <>
                                {options.map((opt, idx) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        class={dropdownStyles.dropdownItem}
                                        onClick$={() => pick$(opt)}
                                        onKeyDown$={(e) => handleOptionKeyDown$(e, idx)}
                                        role="option"
                                        aria-selected={opt === currentValue.value}
                                        tabIndex={-1}
                                    >
                                        {opt}
                                    </button>
                                ))}
                                {allowOther && !otherMode.value && (
                                    <button
                                        type="button"
                                        class={dropdownStyles.dropdownItem}
                                        onClick$={startOther$}
                                        onKeyDown$={(e) => handleOptionKeyDown$(e, options.length)}
                                        role="option"
                                        aria-selected={false}
                                        tabIndex={-1}
                                    >
                                        Other…
                                    </button>
                                )}
                                {allowOther && otherMode.value && (
                                    <input
                                        ref={otherInputRef}
                                        class={enumStyles.otherInput}
                                        type="text"
                                        value={otherText.value}
                                        placeholder="Custom value"
                                        aria-label="Custom value"
                                        onInput$={(e) => { otherText.value = (e.target as HTMLInputElement).value; }}
                                        onKeyDown$={handleOtherKeyDown$}
                                    />
                                )}
                            </>
                        )}
                    />
                </div>
            )}
        </div>
    );
});
