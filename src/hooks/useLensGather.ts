/**
 * useLensGather — the derived-children read for a lens (Derivation + Provision).
 *
 * Gathers the lens's owning-node subtree (the `ownerId` = `lens.parentId`) filtered
 * to the lens's `targetKind` — the `job`s a `jobs` lens rolls up — re-gathered on a
 * debounced `storageEventBus` subscription so the rollup stays roughly live.
 *
 * Shared by the two surfaces that show the rollup: the compact in-card summary
 * (`LensRollup`, NavigableRows) and the re-rooted parent view (`BranchView`, where
 * the jobs render as Node-like CHILD cards). Both read one gather, so they agree.
 * Best-effort (subscribes to all writes); navigating always refreshes.
 */

import { useSignal, useVisibleTask$, type Signal } from '@builder.io/qwik';
import { getElementQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { storageEventBus } from '../data/storageEventBus';
import { gatherDescendants } from '../data/services/capabilityEngine';
import type { Element, Kind } from '../data/models';

export function useLensGather(
    ownerId: Signal<string>,
    targetKind: Signal<Kind | null>,
): Signal<Element[]> {
    const gathered = useSignal<Element[]>([]);

    useVisibleTask$(({ track, cleanup }) => {
        const oid = track(() => ownerId.value);
        const tk = track(() => targetKind.value);
        if (!oid || !tk) {
            gathered.value = [];
            return;
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const regather = async () => {
            await initializeStorage();
            const all = await gatherDescendants(oid, getElementQueries());
            gathered.value = all.filter((e) => e.kind === tk);
        };
        const unsub = storageEventBus.subscribe(() => {
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(regather, 50);
        });
        cleanup(() => {
            unsub();
            if (timer !== null) clearTimeout(timer);
        });
        void regather();
    });

    return gathered;
}
