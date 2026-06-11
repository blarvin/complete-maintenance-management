/**
 * useElementChildren / useElementById — THE data-read model for views.
 *
 * Mental model: WRITES EMIT, READERS SUBSCRIBE.
 * Every successful write (local command or remote sync apply) emits on
 * storageEventBus from IDBAdapter. Views never thread reload callbacks
 * through props — they subscribe here and reload when a relevant event
 * lands. Relevance lives in src/data/storageEventRelevance.ts (pure, tested).
 *
 * Replaces: useRootViewData, useBranchViewData, useTreeNodeFields, the
 * window 'storage-change' CustomEvent, and the onDeleted$/onCreated$/
 * onCommitted$ reload threading. (Audit §2.3 + §4.4.)
 */

import { useSignal, useVisibleTask$, $, type Signal } from '@builder.io/qwik';
import { getElementQueries } from '../data/queries';
import { initializeStorage } from '../data/storage/initStorage';
import { storageEventBus } from '../data/storageEventBus';
import { affectsChildrenOf, affectsElement } from '../data/storageEventRelevance';
import { useAsyncOperation, runAsync } from './useAsyncOperation';
import type { Element } from '../data/models';

export type ChildKindFilter = 'nodes' | 'fields'; // 'fields' = kind !== 'node'

/** Trailing debounce so write bursts (composer commit, sync apply batch) coalesce into one reload. */
const RELOAD_DEBOUNCE_MS = 30;

export function useElementChildren(
    parentId: Signal<string | null>,
    filter: ChildKindFilter,
): { children: Signal<Element[]>; isLoading: Signal<boolean> } {
    const children = useSignal<Element[]>([]);
    const op = useAsyncOperation();

    const load$ = $(async () => {
        // Awaiting init closes the race where a view's first load runs before
        // initializeQueries(); the init promise resolves on failure too.
        await initializeStorage();
        await runAsync(op, async () => {
            const q = getElementQueries(); // runtime lookup inside $() — never captured
            const pid = parentId.value;
            const els = pid === null ? await q.getRootElements() : await q.getChildren(pid);
            // Adapter already excludes deleted rows and sorts by siblingOrder.
            children.value = els.filter(e => (filter === 'nodes') === (e.kind === 'node'));
            console.log('[useElementChildren] Loaded', children.value.length, filter, 'under', pid ?? 'ROOT');
        });
    });

    useVisibleTask$(({ track, cleanup }) => {
        track(() => parentId.value); // navigation re-runs this task → fresh subscription + reload
        // Subscribe BEFORE the first load so events emitted during init/startup
        // sync aren't missed. Debounce state is client-only closure state.
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsub = storageEventBus.subscribe((event) => {
            if (!affectsChildrenOf(event, parentId.value)) return;
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                load$();
            }, RELOAD_DEBOUNCE_MS);
        });
        cleanup(() => {
            unsub();
            if (timer !== null) clearTimeout(timer);
        });
        load$();
    });

    return { children, isLoading: op.isLoading };
}

export function useElementById(
    id: Signal<string>,
): { element: Signal<Element | null>; isLoading: Signal<boolean> } {
    const element = useSignal<Element | null>(null);
    const op = useAsyncOperation();

    const load$ = $(async () => {
        await initializeStorage();
        await runAsync(op, async () => {
            element.value = await getElementQueries().getElementById(id.value);
        });
    });

    useVisibleTask$(({ track, cleanup }) => {
        track(() => id.value);
        // No debounce — single-row fetch. Refetches rather than patching from
        // the event payload (ELEMENT_WRITTEN omits subtitle).
        const unsub = storageEventBus.subscribe((event) => {
            if (!affectsElement(event, id.value)) return;
            load$();
        });
        cleanup(() => unsub());
        load$();
    });

    return { element, isLoading: op.isLoading };
}
