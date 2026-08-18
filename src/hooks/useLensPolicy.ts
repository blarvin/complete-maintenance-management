/**
 * useLensPolicy — resolve a lens Element's bound policy Definition (entry
 * label, staleness) into a LensPolicy accessor.
 *
 * The lens's `definitionId` was stamped at provision time (stamp-if-resolvable,
 * handlers.ts); null (jobs, pre-existing lenses) or a missing Definition falls
 * back to the target kind's `pickerLabel` with staleness off.
 *
 * **It re-resolves on a Definition write.** It used to have no subscription, and
 * that was correct for its reason: Definitions were fork-not-mutate, with no edit
 * path, so a resolved policy could not go stale. The Library retires that premise
 * (SPEC → *Edit / Delete Semantics*) — renaming the Logbook Policy's entry label
 * has to reach a mounted Logbook — so the resolve rides `useDefinitionConfig`
 * like every other Definition read.
 *
 * First-paint note: the signal starts empty (`entryLabel: ''`); consumers
 * render `policy().entryLabel || pickerLabel` to cover the tick before the
 * effect resolves.
 */

import { createMemo, type Accessor } from 'solid-js';
import { useDefinitionConfig } from './useDefinitionConfig';
import { getKindManifest } from '../kinds/registry';
import { resolveLensPolicy, type LensPolicy } from '../kinds/lensPolicy';
import type { Element, Kind, LogbookConfig } from '../data/models';

export function useLensPolicy(
    lensEl: Accessor<Element | null>,
    targetKind: Accessor<Kind | null>,
): Accessor<LensPolicy> {
    // Gated on `targetKind` so a plain node (BranchView on anything that is not a
    // lens) never fetches a Definition it has no use for.
    const { definition } = useDefinitionConfig(() =>
        targetKind() ? (lensEl()?.definitionId ?? null) : null,
    );

    const policy = createMemo((): LensPolicy => {
        const tk = targetKind();
        if (!tk) return { entryLabel: '', staleness: 0 };
        const fallback = getKindManifest(tk).pickerLabel;
        return resolveLensPolicy((definition()?.config as LogbookConfig) ?? null, fallback);
    });

    return policy;
}
