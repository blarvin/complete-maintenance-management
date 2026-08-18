/**
 * EnumKvField - Renderer for enum-kv DataFields.
 *
 * Click/double-tap to open a dropdown of Definition.config.options. Pick
 * an option to save; Escape / outside-click cancels. `allowOther` swaps the
 * option list for an inline text input so the user can type a custom value.
 *
 * Does NOT use useFieldEdit — the popover lifecycle is its own state machine
 * over the same FSM seams (startFieldEdit/stopFieldEdit). Positioning and
 * focus run from effects, never from timeouts: the open-transition effect
 * deliberately also tracks the options resource, so first-open focus lands
 * after the IDB config fetch rather than racing it; the activeElement guard
 * prevents focus theft on re-runs.
 */

import { Show, For, createSignal, createEffect, createMemo, createResource, onMount, onCleanup, type Accessor } from 'solid-js';
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
    rootRef: Accessor<HTMLElement | undefined>;
    /** Draft config, for a row with no Definition to fetch from (the Add Surface).
     *  This is the kind where preview fidelity matters most — without it a draft
     *  enum would offer no options at all. */
    config?: EnumKvConfig;
    /** When set, edits are buffered (no IDB write) and forwarded via onChange.
     *  `autoFocus` flags the row as just-ticked-by-user so the popover should
     *  auto-open and focus its first option; seeded rows leave it false. */
    pendingMode?: { onChange: (value: string | null) => void | Promise<void>; autoFocus?: boolean };
};

export const EnumKvField = (props: EnumKvFieldProps) => {
    const appState = useAppState();
    const { startFieldEdit, stopFieldEdit } = useAppTransitions();

    const { checkDoubleTap } = useDoubleTap();

    const [isOpen, setIsOpen] = createSignal(false);
    // eslint-disable-next-line solid/reactivity -- mount-time seed; rows remount per field (<For> reference-keyed)
    const [currentValue, setCurrentValueRaw] = createSignal<string | null>(props.value);
    const setCurrentValue = (v: string | null) => setCurrentValueRaw(() => v);
    const [popoverPos, setPopoverPos] = createSignal<{ top: number; left: number }>({ top: 0, left: 0 });
    // When config.allowOther is true, "Other…" swaps the option list for an
    // inline text input so the user can type a custom value.
    const [otherMode, setOtherMode] = createSignal(false);
    const [otherText, setOtherText] = createSignal('');
    // Plain callback-ref locals — nothing tracks them.
    let triggerEl: HTMLElement | undefined;
    let popoverEl: HTMLElement | undefined;
    let otherInputEl: HTMLInputElement | undefined;

    // eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field
    useFieldValueSync<string>(props.id, setCurrentValue);

    const isEditing = () => selectors.getDataFieldState(appState, props.id) === 'EDITING';

    const positionPopover = () => {
        if (!triggerEl || !popoverEl) return;
        const r = triggerEl.getBoundingClientRect();
        const margin = 8;
        const popWidth = popoverEl.offsetWidth || 200;
        const popHeight = popoverEl.offsetHeight || 200;
        let left = r.left;
        if (left + popWidth > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - popWidth - margin);
        }
        let top = r.bottom + 4;
        if (top + popHeight > window.innerHeight - margin) {
            const above = r.top - 4 - popHeight;
            if (above >= margin) top = above;
        }
        setPopoverPos({ top, left });
    };

    // Error-catching fetcher: never enters the throwing state (no ErrorBoundary).
    // A null source skips the fetch entirely — a draft row carries its config on
    // the prop and has no Definition to read.
    const [fetchedOptions] = createResource(
        () => (props.config ? null : props.definitionId),
        async (definitionId): Promise<{ options: string[]; allowOther: boolean }> => {
            try {
                const def = await getDefinitionQueries().getDefinitionById(definitionId);
                if (!def || def.kind !== 'enum-kv') return { options: [], allowOther: false };
                const config = def.config as EnumKvConfig;
                return { options: config.options, allowOther: config.allowOther ?? false };
            } catch {
                return { options: [], allowOther: false };
            }
        },
    );

    // A memo, not a plain accessor: the draft branch builds a fresh object, and
    // `<Show keyed>` below would otherwise remount the option list on every read.
    const options = createMemo(() => {
        const draft = props.config;
        if (!draft) return fetchedOptions();
        return { options: draft.options ?? [], allowOther: draft.allowOther ?? false };
    });

    const open = () => {
        if (appState.editingElementId === props.id) return;
        startFieldEdit(props.id);
        setIsOpen(true);
    };

    const close = () => {
        if (appState.editingElementId === props.id) stopFieldEdit();
        setIsOpen(false);
        setOtherMode(false);
        setOtherText('');
    };

    const pick = async (option: string) => {
        const fieldId = props.id;
        const prev = currentValue();
        if (props.pendingMode) {
            await props.pendingMode.onChange(option);
            setCurrentValue(option);
            close();
            return;
        }
        const ok = await commitWithUndo({
            message: 'Field updated',
            execute: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: option } }),
            undo: () => getCommandBus().execute({ type: 'UPDATE_ELEMENT_VALUE', payload: { id: fieldId, value: prev } }),
        });
        if (ok) {
            setCurrentValue(option);
            close();
        }
    };

    const startOther = () => {
        setOtherMode(true);
        setOtherText('');
        // Positioning + focus handled by the other-mode effect (§10: setTimeout(0) deleted).
    };

    const commitOther = async () => {
        const trimmed = otherText().trim();
        if (trimmed === '') return;
        await pick(trimmed);
    };

    const handleOtherKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void commitOther();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
            triggerEl?.focus();
        }
    };

    // Outside-click close — always-on document listener with the isOpen guard
    // (the useOnDocument shape); dual containment: the DataField row (chevron/
    // label/trigger) and the popover itself.
    const onDocumentPointerDown = (ev: Event) => {
        if (!isOpen()) return;
        const container = props.rootRef();
        const target = ev.target as Node | null;
        if (!target) return;
        const insideRow = !!(container && container.contains(target));
        const insidePopover = !!(popoverEl && popoverEl.contains(target));
        if (!insideRow && !insidePopover) {
            close();
        }
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    // Reposition on scroll / resize so the popover tracks its trigger.
    const onWindowScroll = () => { if (isOpen()) positionPopover(); };
    const onWindowResize = () => { if (isOpen()) positionPopover(); };
    window.addEventListener('scroll', onWindowScroll);
    window.addEventListener('resize', onWindowResize);
    onCleanup(() => {
        document.removeEventListener('pointerdown', onDocumentPointerDown);
        window.removeEventListener('scroll', onWindowScroll);
        window.removeEventListener('resize', onWindowResize);
    });

    const focusOption = (index: number) => {
        if (!popoverEl) return;
        const items = popoverEl.querySelectorAll<HTMLButtonElement>('[role="option"]');
        if (items.length === 0) return;
        const clamped = ((index % items.length) + items.length) % items.length;
        items[clamped]?.focus();
    };

    // Auto-open when mounted in pendingMode with no value AND this row is the
    // one the user just ticked (autoFocus). Seeded rows (construction defaults /
    // Undo restore) skip this so the composer opens with no field stealing
    // focus. Positioning/focus delegated to the open-transition effect.
    onMount(() => {
        if (!props.pendingMode?.autoFocus) return;
        if (currentValue() !== null) return;
        open();
    });

    // Open-transition effect: position + focus the first option. Also tracks
    // the options resource so first-open focus is deterministic after the IDB
    // config fetch; the activeElement guard prevents focus theft on re-runs.
    createEffect(() => {
        if (!isOpen()) return;
        options();
        positionPopover();
        const active = document.activeElement;
        if (popoverEl && (!active || !popoverEl.contains(active))) {
            focusOption(0);
        }
    });

    // Other-mode effect: reposition (the list swapped for an input) and focus it.
    createEffect(() => {
        if (!otherMode()) return;
        positionPopover();
        otherInputEl?.focus();
    });

    // One tap in pendingMode, double-tap once persisted — see the note on
    // `useFieldEdit`'s `valuePointerDown`, which this mirrors for the popover.
    const handleTriggerPointerDown = (ev: PointerEvent | MouseEvent) => {
        if (isOpen()) return;
        const x = ev.clientX ?? 0;
        const y = ev.clientY ?? 0;
        if (props.pendingMode || checkDoubleTap(x, y)) {
            // Cancel the compatibility mousedown: its focus default action runs
            // after the open-transition effect focused the first option and
            // would otherwise steal focus back to the trigger.
            ev.preventDefault();
            open();
        }
    };

    const handleTriggerKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            open();
        } else if (e.key === 'Escape' && isOpen()) {
            e.preventDefault();
            close();
        }
    };

    const handleOptionKeyDown = (e: KeyboardEvent, index: number) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusOption(index + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusOption(index - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            focusOption(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            const count = popoverEl?.querySelectorAll('[role="option"]').length ?? 0;
            focusOption(count - 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
            triggerEl?.focus();
        }
    };

    const displayValue = () => currentValue() ?? '';
    const hasValue = () => !!displayValue();
    const labelId = () => `field-label-${props.id}`;

    return (
        <div style={{ display: 'contents' }}>
            <div
                ref={(el) => (triggerEl = el)}
                classList={{
                    [styles.datafieldValue]: true,
                    [styles.datafieldValueUnderlined]: hasValue(),
                    [styles.datafieldValueEditable]: true,
                    'no-caret': true,
                }}
                onPointerDown={handleTriggerPointerDown}
                onKeyDown={handleTriggerKeyDown}
                tabIndex={0}
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isEditing()}
                aria-labelledby={labelId()}
            >
                {displayValue() || <span class={styles.datafieldPlaceholder}>Empty</span>}
            </div>

            <Show when={isOpen()}>
                <div
                    ref={(el) => (popoverEl = el)}
                    class={enumStyles.popover}
                    role="listbox"
                    aria-label="Options"
                    style={{ top: `${popoverPos().top}px`, left: `${popoverPos().left}px` }}
                >
                    <Show
                        when={options()}
                        keyed
                        fallback={<div class={dropdownStyles.dropdownItem}>Loading…</div>}
                    >
                        {({ options: opts, allowOther }) => (
                            <>
                                <For each={opts}>
                                    {(opt, idx) => (
                                        <button
                                            type="button"
                                            class={dropdownStyles.dropdownItem}
                                            onClick={() => void pick(opt)}
                                            onKeyDown={(e) => handleOptionKeyDown(e, idx())}
                                            role="option"
                                            aria-selected={opt === currentValue()}
                                            tabIndex={-1}
                                        >
                                            {opt}
                                        </button>
                                    )}
                                </For>
                                <Show when={allowOther && !otherMode()}>
                                    <button
                                        type="button"
                                        class={dropdownStyles.dropdownItem}
                                        onClick={startOther}
                                        onKeyDown={(e) => handleOptionKeyDown(e, opts.length)}
                                        role="option"
                                        aria-selected={false}
                                        tabIndex={-1}
                                    >
                                        Other…
                                    </button>
                                </Show>
                                <Show when={allowOther && otherMode()}>
                                    <input
                                        ref={(el) => (otherInputEl = el)}
                                        class={enumStyles.otherInput}
                                        type="text"
                                        value={otherText()}
                                        placeholder="Custom value"
                                        aria-label="Custom value"
                                        onInput={(e) => setOtherText(e.currentTarget.value)}
                                        onKeyDown={handleOtherKeyDown}
                                    />
                                </Show>
                            </>
                        )}
                    </Show>
                </div>
            </Show>
        </div>
    );
};
