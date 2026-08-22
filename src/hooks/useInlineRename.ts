/**
 * useInlineRename — double-tap-to-edit over a node's own text: its `name` and
 * its `subtitle`.
 *
 * The lifecycle is the one a DataField value has, deliberately: double-tap
 * opens (the accidental-brush guard is the point — a node header carries other
 * gestures), Enter or blur commits, Escape or a tap outside cancels, and text
 * that did not change dispatches nothing.
 *
 * **Not `useFieldEdit`.** That hook commits through `commitFieldValue`, which
 * writes `UPDATE_ELEMENT_VALUE`. A node's name is not its value — different
 * column, different command — so what the two share is the lifecycle, not the
 * write. The write is the caller's, passed in as `commit`.
 *
 * The FSM's `editingElementId` is the app's single edit slot, so opening a title
 * cancels a field edit and vice versa (SPEC → DataField Management: "If another
 * DataField is already editing, it is cancelled"). Its key is
 * `${elementId}::name`, not the bare id: a node's title and subtitle are two
 * editors over one Element and the slot holds one string.
 */

import { createSignal, onCleanup, type Accessor } from 'solid-js';
import { useAppState, useAppTransitions } from '../state/appState';
import { useDoubleTap } from './useDoubleTap';
import { useFocusManager } from './useFocusManager';

export type UseInlineRenameOptions = {
    /** The FSM edit slot this editor claims. Unique per editor, not per Element. */
    editKey: Accessor<string>;
    /** The persisted text being edited. */
    current: Accessor<string>;
    /** Whether the surface offers renaming at all — read-only surfaces pass false. */
    enabled: Accessor<boolean>;
    /** Dispatch the change. Not called for empty-or-unchanged text. */
    commit: (next: string) => Promise<void>;
    /**
     * Whether clearing the text is a real edit. False for a name — a nameless
     * node is unreadable in every list it appears in, so an emptied name closes
     * the editor and keeps what was there. True for a subtitle, which is
     * optional by definition.
     */
    allowEmpty?: boolean;
};

export type UseInlineRenameResult = {
    isEditing: Accessor<boolean>;
    draft: Accessor<string>;
    /** JSX `ref=` for the edit input; focus lands on it, caret at the end. */
    setInputRef: (el: HTMLInputElement) => void;
    /** `onPointerDown` for the display element. */
    displayPointerDown: (ev: PointerEvent | MouseEvent) => void;
    inputChange: (value: string) => void;
    inputBlur: () => void;
    inputKeyDown: (e: KeyboardEvent) => void;
};

export function useInlineRename(options: UseInlineRenameOptions): UseInlineRenameResult {
    const appState = useAppState();
    const { startFieldEdit, stopFieldEdit } = useAppTransitions();
    const { checkDoubleTap } = useDoubleTap();

    const [draft, setDraft] = createSignal('');
    let inputEl: HTMLInputElement | undefined;
    /** Re-entrancy latch — same reason as `useFieldEdit.save`: `commit` is async
     *  and the FSM guard only closes after it, so an action key that delivers
     *  both an `Enter` and a blur would otherwise dispatch twice. */
    let saving = false;

    const isEditing = () => appState.editingElementId === options.editKey();

    // Focus is the focus manager's job, not the ref's: a Solid `ref=` callback
    // runs *before* the element is inserted, and `focus()` on a detached node is
    // a no-op. The effect runs after render, when there is something to focus.
    const setInputRef = (el: HTMLInputElement) => {
        inputEl = el;
    };
    useFocusManager(() => inputEl, isEditing);

    const cancel = () => {
        if (!isEditing()) return;
        stopFieldEdit();
    };

    const save = async () => {
        if (saving) return;
        if (!isEditing()) return;
        const next = draft().trim();
        const unchanged = next === options.current();
        const emptied = next === '' && !options.allowEmpty;
        if (unchanged || emptied) {
            stopFieldEdit();
            return;
        }
        saving = true;
        try {
            await options.commit(next);
            stopFieldEdit();
        } finally {
            saving = false;
        }
    };

    const displayPointerDown = (ev: PointerEvent | MouseEvent) => {
        if (!options.enabled()) return;
        if (isEditing()) return;
        if (!checkDoubleTap(ev.clientX ?? 0, ev.clientY ?? 0)) return;
        // The display element is swapped for the input synchronously, so the
        // browser's post-pointerdown focus would aim at a stale hit-test and
        // steal focus straight back off the input (same reason as DataField).
        ev.preventDefault();
        setDraft(options.current());
        startFieldEdit(options.editKey());
    };

    // Tapping outside cancels. `pointerdown` lands before `blur`, so this closes
    // the FSM first and `inputBlur`'s guard then fails — which is the whole
    // mechanism that lets blur mean commit (see useFieldEdit → inputBlur).
    const onDocumentPointerDown = (ev: Event) => {
        if (!isEditing()) return;
        const target = ev.target as Node | null;
        if (target && !target.isConnected) return;
        if (inputEl && target && !inputEl.contains(target)) cancel();
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    onCleanup(() => document.removeEventListener('pointerdown', onDocumentPointerDown));

    const inputChange = (value: string) => setDraft(value);

    const inputBlur = () => {
        if (!isEditing()) return;
        void save();
    };

    const inputKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    return {
        isEditing,
        draft,
        setInputRef,
        displayPointerDown,
        inputChange,
        inputBlur,
        inputKeyDown,
    };
}
