/**
 * useLensPolicy — resolve a lens Element's bound policy Definition (entry
 * label, staleness) into a LensPolicy accessor.
 *
 * The lens's `definitionId` was stamped at provision time (stamp-if-resolvable,
 * provisionLenses.ts); null (jobs, pre-existing lenses) or a missing Definition falls
 * back to the target kind's `pickerLabel` with staleness off. Definitions are
 * fork-not-mutate (no edit path), so no DEFINITION_WRITTEN subscription is
 * needed — the effect re-runs only when the lens element or target kind changes.
 *
 * First-paint note: the signal starts empty (`entryLabel: ''`); consumers
 * render `policy().entryLabel || pickerLabel` to cover the tick before the
 * effect resolves.
 */

import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { getDefinitionQueries } from '../data/queries';
import { getKindManifest } from '../kinds/registry';
import { initializeStorage } from '../data/storage/initStorage';
import { resolveLensPolicy, type LensPolicy } from '../kinds/lensPolicy';
import type { Element, Kind, LogbookConfig } from '../data/models';

export function useLensPolicy(
    lensEl: Accessor<Element | null>,
    targetKind: Accessor<Kind | null>,
): Accessor<LensPolicy> {
    const [policy, setPolicy] = createSignal<LensPolicy>({ entryLabel: '', staleness: 0 });

    createEffect(() => {
        const definitionId = lensEl()?.definitionId ?? null;
        const tk = targetKind();
        if (!tk) return; // not a lens (e.g. BranchView on a plain node)

        const fallback = getKindManifest(tk).pickerLabel;
        setPolicy(resolveLensPolicy(null, fallback));
        if (!definitionId) return;

        let disposed = false;
        onCleanup(() => {
            disposed = true;
        });
        void (async () => {
            await initializeStorage();
            const def = await getDefinitionQueries().getDefinitionById(definitionId);
            if (!disposed) setPolicy(resolveLensPolicy((def?.config as LogbookConfig) ?? null, fallback));
        })();
    });

    return policy;
}
