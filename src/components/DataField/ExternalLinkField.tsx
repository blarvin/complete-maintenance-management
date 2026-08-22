/**
 * ExternalLinkField — renderer for the `external-link` kind.
 *
 * `Edges(external)`: the value is a stored URL, and unlike `internal-link` there is no
 * resolver — nothing internal to look up, so display is the link itself. Opens in a
 * new tab (`rel="noopener noreferrer"`, since `target="_blank"` otherwise hands the
 * opened page a reference back to this one).
 *
 * **Two targets, two acts** (2026-08-16, the same split `AddFieldSurface.KindRow`
 * uses for its chevron and its name). The URL *text* is the field's value surface
 * and double-taps into the editor like every other kind; the `↗` beside it is the
 * only thing that navigates. Until this split the value **was** the anchor, so the
 * first tap left the app — which meant a saved URL could never be edited, and a
 * wrong one could not even be inspected without visiting it. Rejected alternative:
 * gating edit on Field Details being open, which would couple the row's affordance
 * to another region's state, make this the one kind with a bespoke interaction
 * rule, and say nothing about the Add Surface's draft row, where there is no
 * Details.
 *
 * A value that isn't an http(s) URL renders as plain text and grows no `↗` —
 * `safeHttpUrl` is what stops a typed `javascript:` from becoming a live link.
 */

import { Show, createMemo, type Accessor } from 'solid-js';
import { useValueSlot } from '../../hooks/useValueSlot';
import type { ExternalLinkValue } from '../../data/models';
import type { PendingMode } from '../../kinds/types';
import { safeHttpUrl, displayUrl } from '../../utils/url';
import styles from './DataField.module.css';

export type ExternalLinkFieldProps = {
    id: string;
    value: ExternalLinkValue | null;
    rootRef: Accessor<HTMLElement | undefined>;
    pendingMode?: PendingMode<ExternalLinkValue>;
};

const formatUrl = (v: ExternalLinkValue | null): string => v?.url ?? '';

/** Stored as typed; normalization happens at display, so the user's own text
 *  survives a reload of a half-typed value. */
const parseUrl = (raw: string): ExternalLinkValue | null => {
    const trimmed = raw.trim();
    return trimmed === '' ? null : ({ url: trimmed } as ExternalLinkValue);
};

export const ExternalLinkField = (props: ExternalLinkFieldProps) => {
    const {
        isEditing,
        displayValue,
        hasValue,
        editValue,
        setEditInputRef,
        valuePointerDown,
        valueKeyDown,
        inputPointerDown,
        inputBlur,
        inputKeyDown,
        inputChange,
    } = useValueSlot<ExternalLinkValue>(props, { format: formatUrl, parse: parseUrl });

    // Derived from the live edit state, not `props.value`, so the `↗` follows an
    // edit the moment it commits.
    const href = createMemo(() => safeHttpUrl(displayValue()));

    const labelId = () => `field-label-${props.id}`;

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
                            {displayUrl(displayValue())}
                        </Show>
                    </div>

                    {/* The only navigating target. Its own hit area, and it stops
                        propagation so the row's expand/re-root handlers stay out
                        of it. Absent for a value that is not a safe http(s) URL —
                        there is nothing to open. */}
                    <Show when={href()}>
                        <a
                            class={styles.datafieldLinkOpen}
                            href={href()!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${href()!}`}
                            aria-label="Open link in a new tab"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            ↗
                        </a>
                    </Show>
                </div>
            }
        >
            <input
                ref={setEditInputRef}
                type="url"
                classList={{
                    [styles.datafieldValue]: true,
                    [styles.datafieldValueUnderlined]: !!editValue(),
                }}
                placeholder="https://supplier.example/part"
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
