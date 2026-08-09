/**
 * AssetDocField — renderer for the `asset-doc` kind (#6b minimal set).
 *
 * `Edges(internal, live) + Reads.resolver`: the value is the target Element's id;
 * display resolves it live (via `resolveEdge`) and shows the target's name. Stub
 * scope — the target is entered as a raw id in the composer (pendingMode); a real
 * target picker and editing a saved link are deferred (LATER.md). First consumer
 * of the Edges resolver in the capability engine.
 */

import { Show, createSignal, createMemo, createEffect, onCleanup } from 'solid-js';
import type { FieldRendererProps } from '../../kinds/types';
import type { AssetDocValue } from '../../data/models';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { resolveEdge } from '../../data/services/capabilityEngine';
import styles from './DataField.module.css';

export const AssetDocField = (props: FieldRendererProps) => {
    const targetId = createMemo(() => (props.value as AssetDocValue | null)?.targetId ?? '');
    const [resolvedName, setResolvedName] = createSignal<string | null>(null);

    // Live resolution: fetch the target's name whenever the id changes (display
    // only). Stale-async guard: an in-flight resolve must not land after the
    // tracked id changed (effects capture their values at run time).
    createEffect(() => {
        const id = targetId();
        let disposed = false;
        onCleanup(() => { disposed = true; });
        if (props.pendingMode || !id) {
            setResolvedName(null);
            return;
        }
        void (async () => {
            await initializeStorage();
            const target = await resolveEdge(id, getElementQueries());
            if (!disposed) setResolvedName(target ? target.name : null);
        })();
    });

    return (
        <Show
            when={props.pendingMode}
            fallback={
                <Show when={targetId()} fallback={<span class={styles.datafieldPlaceholder}>No link</span>}>
                    <span class={styles.datafieldValue} title={targetId()}>
                        → {resolvedName() ?? `(unresolved: ${targetId()})`}
                    </span>
                </Show>
            }
        >
            {(pending) => (
                // Composer: collect the target id as a raw string.
                <input
                    type="text"
                    class={styles.datafieldValue}
                    placeholder="Target element id"
                    value={targetId()}
                    onInput={(e) => {
                        const trimmed = e.currentTarget.value.trim();
                        void pending().onChange(trimmed ? ({ targetId: trimmed } as AssetDocValue) : null);
                    }}
                />
            )}
        </Show>
    );
};
