/**
 * LensRollup — the compact, in-card summary of a lens's derived rollup (#5
 * container half). Rendered inside a Jobs container's DataCard when it is shown as
 * a CHILD (a row under a node): a "Jobs (N)" section header, each rolled-up job as
 * a `NavigableRow` (the field-row skin; name re-roots, chevron peeks fields).
 *
 * The *re-rooted* view of the same lens is NOT this — there the jobs render as
 * Node-like CHILD cards via `BranchView`, where each job's own DataCard expands.
 * Both surfaces share one gather (`useLensGather`).
 *
 * Kind-agnostic — driven by `targetKind`, so `logbook`/`log-entry` (#6c) reuses it.
 */

import { createMemo, For, Show } from 'solid-js';
import { getKindManifest } from '../../kinds/registry';
import { derivationOf } from '../../kinds/renderMode';
import { useElementById } from '../../hooks/useElementChildren';
import { useLensGather } from '../../hooks/useLensGather';
import { useLensPolicy } from '../../hooks/useLensPolicy';
import { isLensStale } from '../../kinds/lensPolicy';
import { NavigableRow } from '../NavigableRow/NavigableRow';
import { LensCreate } from '../LensCreate/LensCreate';
import type { Kind } from '../../data/models';
import styles from './LensRollup.module.css';

export type LensRollupProps = { lensId: string; targetKind: Kind };

export const LensRollup = (props: LensRollupProps) => {
    // The lens rolls up its *owning node's* subtree (lens.parentId), where jobs live.
    const { element: lensEl } = useElementById(() => props.lensId);
    const ownerId = () => lensEl()?.parentId ?? '';
    const targetKind = (): Kind | null => props.targetKind;
    // The gather runs the lens kind's own descriptor, not a hardcoded subtree walk.
    // Both this and `ownerId` wait on `lensEl`, so they arrive on the same tick.
    const gathered = useLensGather(ownerId, () => derivationOf(lensEl()?.kind));

    // The bound policy Definition (entry label, staleness); `|| pickerLabel`
    // covers the first-paint tick before the policy effect resolves.
    const policy = useLensPolicy(lensEl, targetKind);
    const entryLabel = () => policy().entryLabel || getKindManifest(props.targetKind).pickerLabel;

    const newestUpdatedAt = createMemo(() =>
        gathered().length ? Math.max(...gathered().map((e) => e.updatedAt)) : null);
    const isStale = () => isLensStale(newestUpdatedAt(), policy().staleness, Date.now());

    return (
        <div class={styles.rollup}>
            <div class={styles.sectionHeader}>
                {entryLabel()} ({gathered().length})
                <Show when={isStale()}>
                    <span class={styles.staleBadge}>stale</span>
                </Show>
            </div>

            <For each={gathered()}>
                {(j) => <NavigableRow id={j.id} name={j.name} />}
            </For>
            <Show when={gathered().length === 0}>
                <div class={styles.empty}>none yet</div>
            </Show>

            <LensCreate ownerId={ownerId()} targetKind={props.targetKind} entryLabel={entryLabel()} />
        </div>
    );
};
