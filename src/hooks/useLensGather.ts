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
 * Best-effort (subscribes to all writes — deliberately no relevance filter, a
 * gather spans the whole subtree); navigating always refreshes.
 */

import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { getElementQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { storageEventBus } from '../data/storageEventBus';
import { gatherDescendants } from '../data/services/capabilityEngine';
import type { Element, Kind } from '../data/models';

export function useLensGather(
    ownerId: Accessor<string>,
    targetKind: Accessor<Kind | null>,
): Accessor<Element[]> {
    const [gathered, setGathered] = createSignal<Element[]>([]);

    createEffect(() => {
        const oid = ownerId();
        const tk = targetKind();
        if (!oid || !tk) {
            setGathered([]);
            return;
        }
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const regather = async () => {
            await initializeStorage();
            const all = await gatherDescendants(oid, getElementQueries());
            if (!disposed) setGathered(all.filter((e) => e.kind === tk));
        };
        const unsub = storageEventBus.subscribe(() => {
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => void regather(), 50);
        });
        onCleanup(() => {
            disposed = true;
            unsub();
            if (timer !== null) clearTimeout(timer);
        });
        void regather();
    });

    return gathered;
}
