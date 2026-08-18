/**
 * useDefinitionConfig — a Definition, live.
 *
 * **Why this exists, and why it is not just a fetch.** Every consumer of a
 * Definition used to hold a near-identical `createResource` keyed on
 * `definitionId` — which does not change when the Definition's *config* does. That
 * was correct while Definitions were fork-never-mutate: a Definition could not
 * change, so a resource keyed on its id could not go stale.
 *
 * The Library retires that premise (SPEC → *Edit / Delete Semantics*): a
 * Definition is edited in place and the edit reaches every instance bound to it.
 * Downstream propagation is the whole reason the Library exists as a place, and it
 * does not happen for free — so the subscription lives here, once, instead of
 * being remembered at four call sites.
 *
 * **Subscribe before the first fetch.** The bus subscription is registered during
 * component setup, ahead of the resource's first read, so a write landing in the
 * gap between mount and first fetch cannot be missed. Same ordering as
 * `FieldComposer` and `DataFieldDetails`.
 *
 * Accessor in, accessor out (the repo's Solid contract): pass a thunk, and the
 * hook refetches when it changes. A `null` id fetches nothing and yields `null` —
 * which is what a draft row (no Definition yet) and a config Field (never one)
 * both want.
 */

import { createResource, createSignal, onCleanup, type Accessor } from 'solid-js';
import { getDefinitionQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { storageEventBus } from '../data/storageEventBus';
import type { Definition } from '../data/models';

export type UseDefinitionConfigResult = {
    definition: Accessor<Definition | null>;
    /**
     * True only while a fetch is genuinely in flight. Callers need it because
     * `definition()` says `null` for three different situations — not started, not
     * found, and failed — and a row that shows its "no config" state during the
     * first tick flickers on every mount.
     */
    loading: Accessor<boolean>;
};

export function useDefinitionConfig(
    definitionId: Accessor<string | null | undefined>,
): UseDefinitionConfigResult {
    const [refreshKey, setRefreshKey] = createSignal(0);

    // Registered before the resource below, so nothing lands in the gap. The
    // `definitionId()` read here is deliberately untracked — the callback runs
    // from the bus, outside any reactive scope, and is only comparing ids.
    const unsubscribe = storageEventBus.subscribe((event) => {
        if (event.type !== 'DEFINITION_WRITTEN') return;
        if (event.definition.id !== definitionId()) return;
        setRefreshKey((k) => k + 1);
    });
    onCleanup(() => unsubscribe());

    const [definition] = createResource(
        () => {
            const id = definitionId();
            // A falsy source skips the fetch entirely — the resource stays
            // unresolved rather than fetching a Definition that does not exist.
            return id ? ([id, refreshKey()] as const) : null;
        },
        async ([id]): Promise<Definition | null> => {
            try {
                // The init promise resolves on failure too, so a storage problem
                // degrades to a null config rather than a throwing resource (there
                // is no ErrorBoundary above these rows).
                await initializeStorage();
                return await getDefinitionQueries().getDefinitionById(id);
            } catch {
                return null;
            }
        },
    );

    return {
        definition: () => definition() ?? null,
        loading: () => definition.loading,
    };
}
