/**
 * ExternalLinkField — renderer for the `external-link` kind.
 *
 * `Edges(external)`: the value is a stored URL, and unlike `asset-doc` there is no
 * resolver — nothing internal to look up, so display is the link itself. Opens in a
 * new tab (`rel="noopener noreferrer"`, since `target="_blank"` otherwise hands the
 * opened page a reference back to this one).
 *
 * A value that isn't an http(s) URL renders as plain text, never as an anchor —
 * `safeHttpUrl` is what stops a typed `javascript:` from becoming a live link.
 */

import { Show, createMemo } from 'solid-js';
import type { FieldRendererProps } from '../../kinds/types';
import type { ExternalLinkValue } from '../../data/models';
import { safeHttpUrl, displayUrl } from '../../utils/url';
import styles from './DataField.module.css';

export const ExternalLinkField = (props: FieldRendererProps) => {
    const raw = createMemo(() => (props.value as ExternalLinkValue | null)?.url ?? '');
    const href = createMemo(() => safeHttpUrl(raw()));

    return (
        <Show
            when={props.pendingMode}
            fallback={
                <Show when={raw()} fallback={<span class={styles.datafieldPlaceholder}>No link</span>}>
                    <Show
                        when={href()}
                        fallback={<span class={styles.datafieldValue} title={raw()}>{raw()}</span>}
                    >
                        <a
                            class={styles.datafieldValue}
                            href={href()!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={href()!}
                            // The row's own click handlers re-root / expand; a link
                            // click should just follow the link.
                            onClick={(e) => e.stopPropagation()}
                        >
                            {displayUrl(raw())}
                        </a>
                    </Show>
                </Show>
            }
        >
            {(pending) => (
                <input
                    type="url"
                    class={styles.datafieldValue}
                    placeholder="https://supplier.example/part"
                    value={raw()}
                    onInput={(e) => {
                        const trimmed = e.currentTarget.value.trim();
                        // Stored as typed; normalization happens at display, so the
                        // user's own text survives a reload of a half-typed value.
                        void pending().onChange(trimmed ? ({ url: trimmed } as ExternalLinkValue) : null);
                    }}
                />
            )}
        </Show>
    );
};
