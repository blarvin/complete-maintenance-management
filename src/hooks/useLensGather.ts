/**
 * useLensGather — the derived-children read for a lens (Derivation + Provision).
 *
 * Runs the lens kind's own `derivation` descriptor against the lens's owning node
 * (the `ownerId` = `lens.parentId`) — both halves, traversal and target kind — so
 * the `job`s a `jobs` lens rolls up are the ones the manifest says it rolls up.
 * Re-gathered on a debounced `storageEventBus` subscription so it stays roughly live.
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
import { gatherByDerivation } from '../data/services/capabilityEngine';
import type { DerivationSpec } from '../kinds/types';
import type { Element } from '../data/models';

export function useLensGather(
    ownerId: Accessor<string>,
    derivation: Accessor<DerivationSpec | null>,
): Accessor<Element[]> {
    const [gathered, setGathered] = createSignal<Element[]>([]);

    createEffect(() => {
        const oid = ownerId();
        const spec = derivation();
        if (!oid || !spec) {
            setGathered([]);
            return;
        }
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const regather = async () => {
            await initializeStorage();
            const all = await gatherByDerivation(oid, spec, getElementQueries());
            if (!disposed) setGathered(all);
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
