/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation and construction.
 */

import { createMemo, For, Show } from 'solid-js';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useElementChildren } from '../../hooks/useElementChildren';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { RE_ROOT_CREATE_KINDS } from '../../kinds/registry';

export const RootView = () => {
    const appState = useAppState();
    const { navigateToNode } = useAppTransitions();

    // Root = children of null, which is the business-tree roots **plus the Field
    // Library Node** (`listRootElements`). The Library sorts first on its seeded
    // `siblingOrder: -1` and passes the `isReRoot` filter like any other `node`,
    // so it needs no special case here — being a place in the tree is the whole
    // point (SPEC → *The Library*). Reloads arrive via the storage event bus.
    const { children: nodes, isLoading } = useElementChildren(() => null, 'nodes');

    const { ucNode, start, cancel, complete } = useNodeCreation(() => null);

    // Filter out the UC node from the list to prevent dual rendering — the bus
    // reload can land the newly created node in `nodes` while `underConstruction`
    // is still set (complete() awaits CREATE_ELEMENT + the draft commit before
    // completeConstruction). In Solid it is this filter, not a namespaced key,
    // that prevents the dual render: the UC card renders in its own <Show>
    // position and is never identity-matched against the <For> rows. Plus any
    // lens-surfaced kinds — jobs live in a lens, never as stray roots.
    const displayNodes = createMemo(() => nodes().filter(n => {
        const uc = ucNode();
        return (!uc || n.id !== uc.id) && !isLensSurfaced(n.kind);
    }));

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
                            parentId={n.parentId}
                            definitionId={n.definitionId}
                            onNodeClick={() => navigateToNode(n.id)}
                        />
                    )}
                </For>
                <Show when={ucNode()} keyed>
                    {(uc) => (
                        <TreeNode
                            id={uc.id}
                            name={uc.name}
                            subtitle={uc.subtitle}
                            nodeState="UNDER_CONSTRUCTION"
                            onCancel={cancel}
                            onCreate={complete}
                        />
                    )}
                </Show>
                <CreateNodeButton
                    variant="root"
                    availableKinds={RE_ROOT_CREATE_KINDS.filter((k) => !isLensSurfaced(k))}
                    onClick={start}
                />
            </main>
        </Show>
    );
};
