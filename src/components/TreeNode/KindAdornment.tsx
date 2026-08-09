/**
 * KindAdornment — the manifest-driven header chip for an *untyped* Derivation
 * kind (`org`): a descendant-node count, read from the kind's capability (not its
 * kind string), so the shell varies by composed behaviour.
 *
 *   - Derivation, no Provision (`org`) → a descendant-node count chip.
 *   - Lens (Derivation + Provision, e.g. `jobs`) → nothing here: its rollup +
 *     create surface now render inside its DataCard (LensRollup), so the header
 *     stays quiet.
 *   - no Derivation (`node`, `job`) → nothing.
 *
 * Self-fetches the element (child rows aren't handed `kind`/`parentId`). Re-gathers
 * on storage writes (debounced) so the count stays roughly live.
 */

import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { nodeRenderMode } from '../../kinds/renderMode';
import { isReRoot } from '../../kinds/placement';
import { isProvisionedLens } from '../../kinds/provisionPolicy';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { storageEventBus } from '../../data/storageEventBus';
import { gatherDescendants } from '../../data/services/capabilityEngine';
import { useElementById } from '../../hooks/useElementChildren';
import type { Element } from '../../data/models';

export type KindAdornmentProps = { id: string; isParent: boolean };

export const KindAdornment = (props: KindAdornmentProps) => {
    const { element } = useElementById(() => props.id);
    const [gathered, setGathered] = createSignal<Element[] | null>(null);

    createEffect(() => {
        const el = element();
        if (!el) {
            setGathered(null);
            return;
        }
        // Only the untyped rollup (`org`) draws a header chip. A lens (Provision)
        // renders its rollup in its DataCard (LensRollup), so it gathers nothing here.
        if (nodeRenderMode(el.kind).mode !== 'derivation-chip') {
            setGathered(null);
            return;
        }

        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const regather = async () => {
            await initializeStorage();
            const all = await gatherDescendants(el.id, getElementQueries());
            // Count descendant nodes, excluding the auto-provisioned lens containers
            // (`jobs`/`logbook`, noise) — generic so new lens kinds drop out too.
            if (!disposed) setGathered(all.filter((e) => isReRoot(e.kind) && !isProvisionedLens(e.kind)));
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

    const chipStyle =
        'display:inline-block;margin:2px 0 0 0;padding:1px 8px;border-radius:10px;' +
        'background:var(--surface-2,#eee);color:var(--text-muted);font-size:var(--text-sm);';

    return (
        <Show when={element() && nodeRenderMode(element()!.kind).mode === 'derivation-chip'}>
            <span style={chipStyle}>
                {(gathered() ?? []).length} descendant{(gathered() ?? []).length === 1 ? '' : 's'}
            </span>
        </Show>
    );
};
