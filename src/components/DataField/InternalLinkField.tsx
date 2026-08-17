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
 * URL puts it in a new tab and leaves the draft standing; leaving the current
 * view would discard an in-memory draft that has not been committed. Leaving is
 * safe, travelling is not.
 *
 * **`→` reveals, it does not re-root** (2026-08-16). One glyph, one behaviour,
 * whatever the target's kind: `revealElement` brings the *owner* into view, opens
 * its card, and the arriving row centres and flashes itself. A node target is
 * then one tap from being re-rooted, and a Field target works at all — travelling
 * to a Field with `navigateToNode` rendered a branch with no parent node, because
 * `TargetSpec.allowedKinds` is declared here (`node`/`org`/`job`) and enforced
 * nowhere, so a Field id pastes in and resolves happily.
 *
 * **The value carries its nearest ancestor** (`Tony / Color`), full path in the
 * `title`: a bare name is not unique — every pump has a Pressure. The whole
 * breadcrumb does not fit the value cell, and any future target picker will need
 * the same disambiguation for the same reason.
 *
 * **The target is still a raw element id** in the editor, which is the honest
 * limit of this renderer. The real fix is a target picker constrained by
 * `allowedKinds` — see ISSUES, and LATER → *Forcing kinds*, which wants the same
 * constrained reference in two other places.
 */

import { Show, createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { useAppTransitions } from '../../state/appState';
import { useFieldEdit } from '../../hooks/useFieldEdit';
import { useFieldValueSync } from '../../hooks/useFieldValueSync';
import type { Element, InternalLinkValue } from '../../data/models';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { storageEventBus } from '../../data/storageEventBus';
import { affectsElement } from '../../data/storageEventRelevance';
import { resolveEdge } from '../../data/services/capabilityEngine';
import { getAncestorPath } from '../../data/nodeIndex';
import { isReRoot } from '../../kinds/placement';
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
    const { revealElement } = useAppTransitions();

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

    /** The whole resolved Element, not just its name: the path needs `parentId`
     *  and `kind`, and `→` needs `parentId` to know where to stand. */
    const [target, setTarget] = createSignal<Element | null>(null);

    /**
     * Live resolution, keyed off the *edit state's* current id rather than
     * `props.value`, so the name follows an edit as soon as it commits. Runs in
     * `pendingMode` too: a draft row previewing `Pump P-101` is the row being
     * the Field, where the bare id it was typed from is not.
     *
     * **Subscribed, not sampled.** `TargetSpec.pin: 'live'` is a claim about the
     * *target*, so re-reading only when this link's own value changes was not it:
     * any write to the target has to reach the row without waiting for it to
     * remount. Writes emit and readers subscribe here as everywhere else
     * (`useElementById` is the same shape).
     *
     * **What that does not yet buy** (corrected 2026-08-16). The subscription
     * fires, but `resolveEdge` → `getElementById` is a bare `db.elements.get`,
     * which — unlike `getChildren` beside it — returns soft-deleted rows. A
     * deleted target therefore keeps resolving and keeps rendering as live, `→`
     * and all; only an id that never existed reaches `(unresolved: …)`. And
     * nothing user-facing renames an Element yet (`UPDATE_ELEMENT_NAME` has no
     * production caller), so the live pin's headline case is wired but
     * untriggerable. Both are the resolver-status item in ISSUES → Architecture.
     *
     * Stale-async guard: an in-flight resolve must not land after the tracked id
     * changed (effects capture their values at run time).
     */
    createEffect(() => {
        const id = displayValue();
        let disposed = false;
        if (!id) {
            setTarget(null);
            return;
        }
        const resolve = async () => {
            await initializeStorage();
            const resolved = await resolveEdge(id, getElementQueries());
            if (!disposed) setTarget(resolved);
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

    /**
     * The target's canonical address, root first, as segments. Synchronous — the
     * in-memory node index is what breadcrumbs already read. `getAncestorPath`
     * is nodes-only, so a Field's path is its owner's path plus its own name.
     *
     * Rendered as nearest-ancestor-plus-name; the full join goes in the `title`.
     * The whole breadcrumb does not fit the value cell, whose right end already
     * belongs to the metadata column (ISSUES → UI #3). `TreeBreadcrumbs` is
     * deliberately not reused: it renders navigable buttons and its own chrome.
     */
    const pathSegments = (): string[] => {
        const t = target();
        if (!t) return [];
        return isReRoot(t.kind)
            ? getAncestorPath(t.id).map((s) => s.name)
            : [...getAncestorPath(t.parentId ?? '').map((s) => s.name), t.name];
    };
    const pathLabel = () => pathSegments().slice(-2).join(' / ');
    const pathTitle = () => pathSegments().join(' / ');

    /** Travel to the target — a reveal, not a re-root, so it costs you nothing
     *  if it wasn't what you wanted. An FSM transition, not a URL, hence a
     *  button. Offered only for a resolved target on a persisted row. */
    const canTravel = () => !props.pendingMode && !!target();

    const travel = () => {
        const t = target();
        if (!t) return;
        // The owner either way: a Field's parent is the node that holds it, a
        // node's parent is the branch it sits in. `null` lands on ROOT view.
        revealElement({ elementId: t.id, branchId: t.parentId });
    };

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
                        title={target() ? pathTitle() : displayValue()}
                    >
                        <Show
                            when={hasValue()}
                            fallback={<span class={styles.datafieldPlaceholder}>No link</span>}
                        >
                            {target() ? pathLabel() : `(unresolved: ${displayValue()})`}
                        </Show>
                    </div>

                    <Show when={canTravel()}>
                        <button
                            type="button"
                            class={styles.datafieldLinkOpen}
                            title={`Show ${pathTitle()}`}
                            aria-label={`Show ${pathTitle()}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                travel();
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
