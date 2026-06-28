/**
 * KindAdornment — the manifest-driven stub UI for the node-like kinds (#6b).
 *
 * The first consumer that *reads a capability to draw*: it branches on the
 * element's manifest (not its kind string), so the shell varies by composed
 * behaviour — a tiny prefiguring of chrome entailment (#5).
 *   - Derivation, no Provision (`org`) → a descendant-node count chip.
 *   - Derivation + Provision (`jobs`, the lens) → the gathered list of its
 *     parent's `job` descendants (full list when re-rooted into, a count chip
 *     as a child row to keep lists compact).
 *   - no Derivation (`node`, `job`) → nothing.
 *
 * Self-fetches the element (child rows aren't handed `kind`/`parentId`). Re-gathers
 * on storage writes (debounced) so the rollup stays roughly live — best-effort;
 * navigating into the node always refreshes it.
 */

import { component$, useComputed$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { getKindManifest } from '../../kinds/registry';
import { isReRoot } from '../../kinds/placement';
import { getElementQueries } from '../../data/queries';
import { initializeStorage } from '../../data/storage/initStorage';
import { storageEventBus } from '../../data/storageEventBus';
import { gatherDescendants } from '../../data/services/capabilityEngine';
import { useElementById } from '../../hooks/useElementChildren';
import type { Element } from '../../data/models';

export type KindAdornmentProps = { id: string; isParent: boolean };

export const KindAdornment = component$<KindAdornmentProps>((props) => {
    const idSig = useComputed$(() => props.id);
    const { element } = useElementById(idSig);
    const gathered = useSignal<Element[] | null>(null);

    useVisibleTask$(({ track, cleanup }) => {
        const el = track(() => element.value);
        if (!el) {
            gathered.value = null;
            return;
        }
        const manifest = getKindManifest(el.kind);
        if (!manifest.derivation) {
            gathered.value = null;
            return;
        }
        const isLens = !!manifest.provision;
        const rootId = isLens ? el.parentId : el.id; // a lens rolls up its parent's subtree
        const targetKind = manifest.derivation.targetKind;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const regather = async () => {
            if (!rootId) {
                gathered.value = [];
                return;
            }
            await initializeStorage();
            const all = await gatherDescendants(rootId, getElementQueries());
            // Lens: filter to the target kind. Untyped rollup (org): count descendant
            // nodes, excluding the auto-provisioned `jobs` lenses (noise).
            gathered.value = targetKind
                ? all.filter((e) => e.kind === targetKind)
                : all.filter((e) => isReRoot(e.kind) && e.kind !== 'jobs');
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

    const el = element.value;
    if (!el) return null;
    const manifest = getKindManifest(el.kind);
    if (!manifest.derivation) return null;

    const items = gathered.value ?? [];
    const isLens = !!manifest.provision;
    const chipStyle =
        'display:inline-block;margin:2px 0 0 0;padding:1px 8px;border-radius:10px;' +
        'background:var(--surface-2,#eee);color:var(--text-muted);font-size:var(--text-sm);';

    // Lens, re-rooted into: the full gathered list.
    if (isLens && props.isParent) {
        return (
            <div style="margin:2px 0 0 0;color:var(--text-muted);font-size:var(--text-sm);">
                <div style="font-weight:600;">{manifest.pickerLabel} ({items.length})</div>
                {items.length === 0 ? (
                    <div>none yet</div>
                ) : (
                    <ul style="margin:var(--space-1) 0 0 0;padding-left:var(--space-4);">
                        {items.map((j) => (
                            <li key={j.id}>{j.name}</li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    // Lens as a child row → compact count; org → descendant-node count.
    return (
        <span style={chipStyle}>
            {isLens
                ? `${manifest.pickerLabel} (${items.length})`
                : `${items.length} descendant${items.length === 1 ? '' : 's'}`}
        </span>
    );
});
