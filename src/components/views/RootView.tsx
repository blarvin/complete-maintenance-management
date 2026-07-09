/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation.
 */

import { createMemo, For, Show } from 'solid-js';
import { TreeNode } from '../TreeNode/TreeNode';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useElementChildren } from '../../hooks/useElementChildren';
import { isLensSurfaced } from '../../kinds/childrenPolicy';

export const RootView = () => {
    const appState = useAppState();
    const { navigateToNode } = useAppTransitions();

    // Root = children of null. Reloads arrive via the storage event bus.
    const { children: nodes, isLoading } = useElementChildren(() => null, 'nodes');

    // Lens-surfaced kinds live in a lens, never as stray roots. (No UC
    // filtering — nothing mints UC nodes until Phase IV.)
    const displayNodes = createMemo(() => nodes().filter(n => !isLensSurfaced(n.kind)));

    // Mirror BranchView's loading guard so the root list doesn't flash empty
    // before data resolves. Guard on empty nodes so background reloads don't
    // replace the live list with "Loading...".
    return (
        <Show
            when={!(isLoading() && nodes().length === 0)}
            fallback={<main class="view-root">Loading...</main>}
        >
            <main class="view-root">
                <For each={displayNodes()}>
                    {(n) => (
                        <TreeNode
                            id={n.id}
                            name={n.name}
                            subtitle={n.subtitle ?? ''}
                            nodeState={selectors.getDisplayNodeState(appState, n.id)}
                            kind={n.kind}
                            onNodeClick={() => navigateToNode(n.id)}
                        />
                    )}
                </For>
                {/* TODO(Phase IV): UC TreeNode (namespaced-key note carries) +
                    <CreateNodeButton variant="root"> (useNodeCreation) */}
            </main>
        </Show>
    );
};
