/**
 * useElementChildren / useElementById — THE data-read model for views.
 *
 * Mental model: WRITES EMIT, READERS SUBSCRIBE.
 * Every successful write (local command or remote sync apply) emits on
 * storageEventBus from IDBAdapter. Views never thread reload callbacks
 * through props — they subscribe here and reload when a relevant event
 * lands. Relevance lives in src/data/storageEventRelevance.ts (pure, tested).
 *
 * Solid contract: Accessor in, accessors out. Call sites pass thunks
 * (`useElementChildren(() => props.parentId, 'nodes')`); the effect re-runs
 * when the tracked accessor changes — fresh subscription + reload.
 *
 * Replaces: useRootViewData, useBranchViewData, useTreeNodeFields, the
 * window 'storage-change' CustomEvent, and the onDeleted$/onCreated$/
 * onCommitted$ reload threading. (Audit §2.3 + §4.4.)
 */

import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { getElementQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { storageEventBus } from '../data/storageEventBus';
import { affectsChildrenOf, affectsElement } from '../data/storageEventRelevance';
import { effectiveChildren } from '../data/effectiveChildren';
import { isReRoot } from '../kinds/placement';
import { devLog } from '../utils/devMode';
import { getCurrentUserId } from '../context/userContext';
import type { Element } from '../data/models';

export type ChildKindFilter = 'nodes' | 'fields'; // 'nodes' = re-root kinds, 'fields' = inline kinds

/** Trailing debounce so write bursts (composer commit, sync apply batch) coalesce into one reload. */
const RELOAD_DEBOUNCE_MS = 30;

export function useElementChildren(
    parentId: Accessor<string | null>,
    filter: ChildKindFilter,
): { children: Accessor<Element[]>; isLoading: Accessor<boolean> } {
    const [children, setChildren] = createSignal<Element[]>([]);
    const [isLoading, setIsLoading] = createSignal(false);

    createEffect(() => {
        const pid = parentId(); // tracked read, once, into a local
        // Stale-async guard: an in-flight load from a previous parentId must
        // not land after navigation (effects capture their values at run time).
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const load = async () => {
            // Awaiting init closes the race where a view's first load runs before
            // initializeQueries(); the init promise resolves on failure too.
            await initializeStorage();
            setIsLoading(true);
            try {
                const q = getElementQueries(); // runtime lookup inside the async body — never captured
                const els = pid === null ? await q.getRootElements() : await q.getChildren(pid);
                // Adapter already excludes deleted rows and sorts by siblingOrder.
                // Route through the per-viewer chokepoint (pass-through in Phase 1).
                const effective = effectiveChildren(els, getCurrentUserId());
                if (!disposed) {
                    const next = effective.filter(e => (filter === 'nodes') === isReRoot(e.kind));
                    setChildren(next);
                    devLog('[useElementChildren] Loaded', next.length, filter, 'under', pid ?? 'ROOT');
                }
            } finally {
                setIsLoading(false);
            }
        };
        // Subscribe BEFORE the first load so events emitted during init/startup
        // sync aren't missed. Debounce state is plain closure state.
        const unsub = storageEventBus.subscribe((event) => {
            if (!affectsChildrenOf(event, pid)) return;
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                void load();
            }, RELOAD_DEBOUNCE_MS);
        });
        onCleanup(() => {
            disposed = true;
            unsub();
            if (timer !== null) clearTimeout(timer);
        });
        void load();
    });

    return { children, isLoading };
}

/**
 * The soft-deleted Fields under a node, newest tombstone first — what the
 * details panel's restore list reads.
 *
 * A third function rather than a `deleted` flag on `useElementChildren`: this
 * reads a different query, wants no `effectiveChildren` overlay (a deleted row
 * is not part of any viewer's effective card), and is mounted by exactly one
 * surface. A flag would put "show me the dead ones" one typo away from every
 * card in the app.
 *
 * Same subscribe-and-debounce shape as its live sibling above, because the
 * events it cares about are the same ones: a delete and a restore both emit
 * `ELEMENT_WRITTEN` for a child of this node.
 */
export function useDeletedFields(
    parentId: Accessor<string>,
): { deleted: Accessor<Element[]> } {
    const [deleted, setDeleted] = createSignal<Element[]>([]);

    createEffect(() => {
        const pid = parentId();
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const load = async () => {
            await initializeStorage();
            const els = await getElementQueries().getDeletedChildren(pid);
            if (disposed) return;
            setDeleted(els.filter((e) => !isReRoot(e.kind)));
        };
        const unsub = storageEventBus.subscribe((event) => {
            if (!affectsChildrenOf(event, pid)) return;
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                void load();
            }, RELOAD_DEBOUNCE_MS);
        });
        onCleanup(() => {
            disposed = true;
            unsub();
            if (timer !== null) clearTimeout(timer);
        });
        void load();
    });

    return { deleted };
}

export function useElementById(
    id: Accessor<string>,
): { element: Accessor<Element | null>; isLoading: Accessor<boolean> } {
    const [element, setElement] = createSignal<Element | null>(null);
    const [isLoading, setIsLoading] = createSignal(false);

    createEffect(() => {
        const eid = id(); // tracked read, once, into a local
        let disposed = false;
        const load = async () => {
            await initializeStorage();
            setIsLoading(true);
            try {
                const el = await getElementQueries().getElementById(eid);
                if (!disposed) setElement(el);
            } finally {
                setIsLoading(false);
            }
        };
        // No debounce — single-row fetch. Refetches rather than patching from
        // the event payload (ELEMENT_WRITTEN omits subtitle).
        const unsub = storageEventBus.subscribe((event) => {
            if (!affectsElement(event, eid)) return;
            void load();
        });
        onCleanup(() => {
            disposed = true;
            unsub();
        });
        void load();
    });

    return { element, isLoading };
}
