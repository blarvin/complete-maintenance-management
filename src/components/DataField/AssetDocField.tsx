/**
 * AssetDocField — renderer for the `asset-doc` kind (#6b minimal set).
 *
 * `Edges(internal, live) + Reads.resolver`: the value is the target Element's id;
 * display resolves it live (via `resolveEdge`) and shows the target's name. Stub
 * scope — the target is entered as a raw id in the composer (pendingMode); a real
 * target picker and editing a saved link are deferred (LATER.md). First consumer
 * of the Edges resolver in the capability engine.
 */

import { component$, useSignal, useComputed$, useVisibleTask$, $, type QRL } from '@builder.io/qwik';
import type { FieldRendererProps } from '../../kinds/types';
import type { AssetDocValue, DataFieldValue } from '../../data/models';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { resolveEdge } from '../../data/services/capabilityEngine';
import styles from './DataField.module.css';

export const AssetDocField = component$<FieldRendererProps>((props) => {
    const targetId = useComputed$(() => (props.value as AssetDocValue | null)?.targetId ?? '');
    const resolvedName = useSignal<string | null>(null);

    // Live resolution: fetch the target's name whenever the id changes (display only).
    useVisibleTask$(async ({ track }) => {
        const id = track(() => targetId.value);
        if (props.pendingMode || !id) {
            resolvedName.value = null;
            return;
        }
        await initializeStorage();
        const target = await resolveEdge(id, getElementQueries());
        resolvedName.value = target ? target.name : null;
    });

    // Composer: collect the target id as a raw string.
    if (props.pendingMode) {
        const onChange$: QRL<(value: DataFieldValue | null) => void> = props.pendingMode.onChange$;
        return (
            <input
                type="text"
                class={styles.datafieldValue}
                placeholder="Target element id"
                value={targetId.value}
                onInput$={$((_, el) =>
                    onChange$(el.value.trim() ? ({ targetId: el.value.trim() } as AssetDocValue) : null),
                )}
            />
        );
    }

    if (!targetId.value) {
        return <span class={styles.datafieldPlaceholder}>No link</span>;
    }
    return (
        <span class={styles.datafieldValue} title={targetId.value}>
            → {resolvedName.value ?? `(unresolved: ${targetId.value})`}
        </span>
    );
});
