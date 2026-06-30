/**
 * RootView - Displays top-level tree nodes.
 * Uses centralized FSM state for navigation and construction.
 */

import { component$, useSignal } from '@builder.io/qwik';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useElementChildren } from '../../hooks/useElementChildren';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { RE_ROOT_CREATE_KINDS } from '../../kinds/registry';

export const RootView = component$(() => {
    const appState = useAppState();
    const { navigateToNode$ } = useAppTransitions();

    // Root = children of null. Reloads arrive via the storage event bus.
    const rootParent = useSignal<string | null>(null);
    const { children: nodes, isLoading } = useElementChildren(rootParent, 'nodes');

    // Use the extracted hook for creation flow
    const { ucNode, start$, cancel$, complete$ } = useNodeCreation({
        parentId: null,
    });

    // Filter out the UC node from the list to prevent dual rendering
    // (UC node is rendered separately below with UNDER_CONSTRUCTION state), plus any
    // lens-surfaced kinds — jobs live in a lens, never as stray roots.
    const displayNodes = (ucNode
        ? nodes.value.filter(n => n.id !== ucNode.id)
        : nodes.value
    ).filter(n => !isLensSurfaced(n.kind));

    // Mirror BranchView's loading guard so the root list doesn't flash empty
    // before data resolves. Guard on empty nodes so background reloads don't
    // replace the live list with "Loading...".
    if (isLoading.value && nodes.value.length === 0) {
        return <main class="view-root">Loading...</main>;
    }

    return (
        <main class="view-root">
            {displayNodes.map((n) => (
                <TreeNode
                    key={n.id}
                    id={n.id}
                    name={n.name}
                    subtitle={n.subtitle ?? ''}
                    nodeState={selectors.getDisplayNodeState(appState, n.id)}
                    kind={n.kind}
                    onNodeClick$={() => navigateToNode$(n.id)}
                />
            ))}
            {ucNode ? (
                <TreeNode
                    // Key is namespaced so Qwik never identity-matches this vnode with
                    // the display TreeNode of the same id: the bus reload can put the
                    // newly created node into `nodes` while construction is still open,
                    // and a shared key would make the reconciler reuse the construction
                    // instance instead of unmounting it.
                    key={`uc-${ucNode.id}`}
                    id={ucNode.id}
                    name={ucNode.name}
                    subtitle={ucNode.subtitle}
                    nodeState="UNDER_CONSTRUCTION"
                    onCancel$={cancel$}
                    onCreate$={complete$}
                />
            ) : null}
            <CreateNodeButton variant="root" availableKinds={RE_ROOT_CREATE_KINDS.filter((k) => !isLensSurfaced(k))} onClick$={start$} />
        </main>
    );
});
