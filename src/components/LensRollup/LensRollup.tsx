/**
 * LensRollup — the compact, in-card summary of a lens's derived rollup (#5
 * container half). Rendered inside a Jobs container's DataCard when it is shown as
 * a CHILD (a row under a node): a "Jobs (N)" section header, each rolled-up job as
 * a `NavigableRow` (the field-row skin; name re-roots, chevron peeks fields), and
 * the `LensCreate` affordance.
 *
 * The *re-rooted* view of the same lens is NOT this — there the jobs render as
 * Node-like CHILD cards via `BranchView`, where each job's own DataCard expands.
 * Both surfaces share one gather (`useLensGather`) and one create (`LensCreate`).
 *
 * Kind-agnostic — driven by `targetKind`, so `logbook`/`log-entry` (#6c) reuses it.
 */

import { component$, useComputed$ } from '@builder.io/qwik';
import { getKindManifest } from '../../kinds/registry';
import { useElementById } from '../../hooks/useElementChildren';
import { useLensGather } from '../../hooks/useLensGather';
import { NavigableRow } from '../NavigableRow/NavigableRow';
import { LensCreate } from '../LensCreate/LensCreate';
import type { Kind } from '../../data/models';
import styles from './LensRollup.module.css';

export type LensRollupProps = { lensId: string; targetKind: Kind };

export const LensRollup = component$<LensRollupProps>((props) => {
    // The lens rolls up its *owning node's* subtree (lens.parentId), where jobs live.
    const lensIdSig = useComputed$(() => props.lensId);
    const { element: lensEl } = useElementById(lensIdSig);
    const ownerIdSig = useComputed$(() => lensEl.value?.parentId ?? '');
    const targetKindSig = useComputed$<Kind | null>(() => props.targetKind);
    const gathered = useLensGather(ownerIdSig, targetKindSig);

    const pickerLabel = getKindManifest(props.targetKind).pickerLabel;

    return (
        <div class={styles.rollup}>
            <div class={styles.sectionHeader}>
                {pickerLabel} ({gathered.value.length})
            </div>

            {gathered.value.map((j) => (
                <NavigableRow key={j.id} id={j.id} name={j.name} />
            ))}
            {gathered.value.length === 0 && <div class={styles.empty}>none yet</div>}

            <LensCreate ownerId={ownerIdSig.value} targetKind={props.targetKind} />
        </div>
    );
});
