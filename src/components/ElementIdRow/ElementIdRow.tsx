/**
 * ElementIdRow — an Element's id, shown and copyable.
 *
 * Two surfaces render it, in the same place on each: the Tools region of a
 * Node's details and of a Field's details, beside the delete action. Shared
 * deliberately — they show the same fact for the same reasons, and two copies
 * would drift.
 *
 * **Why the id is user-facing at all.** It is the only handle an `internal-link`
 * has: its target is a raw element id, and until a real target picker lands the
 * workflow is *navigate to the thing, copy it, paste at the field* (see
 * `InternalLinkField`, and the picker discussion in ISSUES). Copy is therefore
 * the point, not a convenience — but the id is also plain useful when reading
 * sync state or a history row against storage, which is why it is shown rather
 * than hidden behind the button.
 *
 * **Placement belongs to the host.** A Node's details is a plain block; a
 * Field's Tools band is a subgrid cell that has to be spanned. So this owns the
 * look and the copy behaviour, and each host wraps it in its own positioning
 * element.
 */

import { createSignal, onCleanup } from 'solid-js';
import styles from './ElementIdRow.module.css';

export type ElementIdRowProps = {
    id: string;
    /** Field label, e.g. `ID`. */
    label?: string;
};

/** Long enough to read as feedback, short enough not to linger into the next act. */
const COPIED_FEEDBACK_MS = 1500;

export const ElementIdRow = (props: ElementIdRowProps) => {
    const [copied, setCopied] = createSignal(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(timer));

    /**
     * Deliberately not routed through the Snackbar: it is single-slot, so a
     * "Copied" toast would evict a pending Undo — and copying is exactly the
     * kind of act you do *while* something else is undoable. Inline feedback
     * costs nothing and stays local to the thing that changed.
     */
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(props.id);
            setCopied(true);
            clearTimeout(timer);
            timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            // Clipboard unavailable (an insecure context) or denied. The id is
            // shown and `user-select: all`, so selecting it by hand still works
            // — which is why this stays silent rather than raising an error.
        }
    };

    return (
        <div class={styles.row}>
            <span class={styles.label}>{props.label ?? 'ID'}</span>
            <code class={styles.id}>{props.id}</code>
            <button
                type="button"
                class={styles.copyButton}
                onClick={() => void copy()}
                aria-label={copied() ? 'Copied' : 'Copy id to clipboard'}
                title={copied() ? 'Copied' : 'Copy id to clipboard'}
            >
                <span aria-hidden="true">{copied() ? '✓' : '⧉'}</span>
            </button>
            {/* Announced separately so the button's own label can stay stable
                for anyone mid-interaction with it. */}
            <span class={styles.srOnly} role="status" aria-live="polite">
                {copied() ? 'Copied' : ''}
            </span>
        </div>
    );
};
