/**
 * InternalLinkField — renderer for the `internal-link` kind (#6b minimal set).
 *
 * `Edges(internal, live) + Reads.resolver`: the value is the target Element's id;
 * display resolves it live (via `resolveEdge`) and shows the target's name. First
 * consumer of the Edges resolver in the capability engine.
 *
 * **Two targets, two acts** (2026-08-16), the same split as `external-link`: the
 * resolved name is the value surface and double-taps into the editor, while the
 * `→` beside it is the only thing that travels. It appears **only once the target
 * resolves** — there is nowhere to go otherwise — which mirrors `external-link`
 * withholding its `↗` from a value that is not a safe URL.
 *
 * The one deliberate asymmetry: **no `→` while drafting.** Opening an external
 * URL puts it in a new tab and leaves the draft standing; re-rooting the current
 * view would discard an in-memory draft that has not been committed. Leaving is
 * safe, travelling is not.
 *
 * **The target is still a raw element id**, which is the honest limit of this
 * renderer: the id appears nowhere in the UI to copy, so the field is editable
 * but not yet usable. The real fix is a target picker constrained by
 * `TargetSpec.allowedKinds` (already declared here as `node`/`org`/`job` and read
 * by nobody) — see ISSUES, and LATER → *Forcing kinds*, which wants the same
 * constrained reference in two other places. What landed here is the half that
 * was missing entirely: an edit path at all. Before it this renderer had no
 * editor branch outside `pendingMode`, so a saved link could never be changed.
 */

import { Show, createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { useAppTransitions } from '../../state/appState';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import type { InternalLinkValue } from '../../data/models';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { storageEventBus } from '../../data/storageEventBus';
import { affectsElement } from '../../data/storageEventRelevance';
import { resolveEdge } from '../../data/services/capabilityEngine';
import styles from './DataField.module.css';

export type InternalLinkFieldProps = {
    id: string;
    value: InternalLinkValue | null;
    rootRef: Accessor<HTMLElement | undefined>;
    pendingMode?: { onChange: (value: InternalLinkValue | null) => void | Promise<void>; autoFocus?: boolean };
};

const formatTarget = (v: InternalLinkValue | null): string => v?.targetId ?? '';

const parseTarget = (raw: string): InternalLinkValue | null => {
    const trimmed = raw.trim();
    return trimmed === '' ? null : ({ targetId: trimmed } as InternalLinkValue);
};

export const InternalLinkField = (props: InternalLinkFieldProps) => {
    const { navigateToNode } = useAppTransitions();

    /* eslint-disable solid/reactivity -- mount-time constants; rows remount per field (<For> reference-keyed) */
    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        setCurrentValue,
        setEditInputRef,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    } = useFieldEdit<InternalLinkValue>({
        fieldId: props.id,
        initialValue: props.value,
        format: formatTarget,
        parse: parseTarget,
        rootRef: props.rootRef,
        pendingMode: props.pendingMode,
    });
    /* eslint-enable solid/reactivity */

    // eslint-disable-next-line solid/reactivity -- mount-time constant; rows remount per field
    useFieldValueSync<InternalLinkValue>(props.id, setCurrentValue);

    const [resolvedName, setResolvedName] = createSignal<string | null>(null);

    /**
     * Live resolution, keyed off the *edit state's* current id rather than
     * `props.value`, so the name follows an edit as soon as it commits. Runs in
     * `pendingMode` too: a draft row previewing `Pump P-101` is the row being
     * the Field, where the bare id it was typed from is not.
     *
     * **Subscribed, not sampled.** `TargetSpec.pin: 'live'` is a claim about the
     * *target*, so re-reading only when this link's own value changes was not it:
     * renaming or deleting the target left a stale name on screen until the row
     * happened to remount. Writes emit and readers subscribe here as everywhere
     * else (`useElementById` is the same shape) — a deleted target resolves to
     * null and the row falls back to `(unresolved: …)` on the spot.
     *
     * Stale-async guard: an in-flight resolve must not land after the tracked id
     * changed (effects capture their values at run time).
     */
    createEffect(() => {
        const id = displayValue();
        let disposed = false;
        if (!id) {
            setResolvedName(null);
            return;
        }
        const resolve = async () => {
            await initializeStorage();
            const target = await resolveEdge(id, getElementQueries());
            if (!disposed) setResolvedName(target ? target.name : null);
        };
        const unsubscribe = storageEventBus.subscribe((event) => {
            if (!affectsElement(event, id)) return;
            void resolve();
        });
        onCleanup(() => {
            disposed = true;
            unsubscribe();
        });
        void resolve();
    });

    const labelId = () => `field-label-${props.id}`;

    /** Travel to the target. An FSM re-root, not a URL — hence a button, not an
     *  anchor. Offered only for a resolved target on a persisted row. */
    const canTravel = () => !props.pendingMode && !!resolvedName();

    return (
        <Show
            when={isEditing()}
            fallback={
                <div class={styles.datafieldLinkRow}>
                    <div
                        classList={{
                            [styles.datafieldValue]: true,
                            [styles.datafieldValueUnderlined]: hasValue(),
                            [styles.datafieldValueEditable]: true,
                            'no-caret': true,
                        }}
                        onPointerDown={valuePointerDown}
                        onKeyDown={valueKeyDown}
                        tabIndex={0}
                        role="button"
                        aria-labelledby={labelId()}
                        aria-description="Press Enter to edit"
                        title={displayValue()}
                    >
                        <Show
                            when={hasValue()}
                            fallback={<span class={styles.datafieldPlaceholder}>No link</span>}
                        >
                            {resolvedName() ?? `(unresolved: ${displayValue()})`}
                        </Show>
                    </div>

                    <Show when={canTravel()}>
                        <button
                            type="button"
                            class={styles.datafieldLinkOpen}
                            title={`Go to ${resolvedName()}`}
                            aria-label={`Go to ${resolvedName()}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                navigateToNode(displayValue());
                            }}
                        >
                            →
                        </button>
                    </Show>
                </div>
            }
        >
            <input
                ref={setEditInputRef}
                type="text"
                classList={{
                    [styles.datafieldValue]: true,
                    [styles.datafieldValueUnderlined]: !!editValue(),
                }}
                placeholder="Target element id"
                value={editValue()}
                onInput={(e) => inputChange(e.currentTarget.value)}
                onPointerDown={inputPointerDown}
                onBlur={inputBlur}
                onKeyDown={inputKeyDown}
                aria-labelledby={labelId()}
                autofocus
            />
        </Show>
    );
};
