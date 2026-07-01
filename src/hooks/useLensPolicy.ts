/**
 * useLensPolicy — resolve a lens Element's bound policy Definition (entry
 * label, staleness) into a LensPolicy signal.
 *
 * The lens's `definitionId` was stamped at provision time (stamp-if-resolvable,
 * handlers.ts); null (jobs, pre-existing lenses) or a missing Definition falls
 * back to the target kind's `pickerLabel` with staleness off. Definitions are
 * fork-not-mutate (no edit path), so no DEFINITION_WRITTEN subscription is
 * needed — the task re-runs only when the lens element or target kind changes.
 *
 * First-paint note: the signal starts empty (`entryLabel: ''`); consumers
 * render `policy.value.entryLabel || pickerLabel` to cover the tick before the
 * task resolves.
 */

import { useSignal, useVisibleTask$, type Signal } from '@builder.io/qwik';
import { getDefinitionQueries } from '../data/queries';
import { getKindManifest } from '../kinds/registry';
import { initializeStorage } from '../data/storage/initStorage';
import { resolveLensPolicy, type LensPolicy } from '../kinds/lensPolicy';
import type { Element, Kind, LogbookConfig } from '../data/models';

export function useLensPolicy(
    lensEl: Signal<Element | null>,
    targetKind: Signal<Kind | null>,
): Signal<LensPolicy> {
    const policy = useSignal<LensPolicy>({ entryLabel: '', staleness: 0 });

    useVisibleTask$(async ({ track }) => {
        const definitionId = track(() => lensEl.value?.definitionId ?? null);
        const tk = track(() => targetKind.value);
        if (!tk) return; // not a lens (e.g. BranchView on a plain node)

        const fallback = getKindManifest(tk).pickerLabel;
        policy.value = resolveLensPolicy(null, fallback);
        if (!definitionId) return;

        await initializeStorage();
        const def = await getDefinitionQueries().getDefinitionById(definitionId);
        policy.value = resolveLensPolicy((def?.config as LogbookConfig) ?? null, fallback);
    });

    return policy;
}
