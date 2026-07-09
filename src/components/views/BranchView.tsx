/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation.
 */

import { createMemo, For, Show } from 'solid-js';
import { TreeNode } from '../TreeNode/TreeNode';
import { useAppTransitions } from '../../state/appState';
import { useElementChildren, useElementById } from '../../hooks/useElementChildren';
import { useLensGather } from '../../hooks/useLensGather';
import { useLensPolicy } from '../../hooks/useLensPolicy';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { nodeRenderMode } from '../../kinds/renderMode';
import type { Kind } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = (props: BranchViewProps) => {
    const { navigateToNode, navigateUp } = useAppTransitions();

    // Data arrives via the storage event bus; navigation re-triggers loads
    // because the hooks track the parentId accessor.
    const { element: parentEl } = useElementById(() => props.parentId);
    const { children, isLoading } = useElementChildren(() => props.parentId, 'nodes');

    const parentNode = createMemo(() => {
        const el = parentEl();
        return el && isReRoot(el.kind) ? el : null;
    });

    // Re-rooted INTO a lens (Provision + typed Derivation, e.g. `jobs`): it "looks
    // like a parent" — the jobs it lenses render as Node-like CHILD cards (each with
    // its own expandable DataCard; clicking re-roots into that job). They are derived
    // (really children of the owning node), so we gather rather than read real
    // children. Generic off the manifest — `logbook` (#6c) inherits this.
    const lensTargetKind = (): Kind | null => {
        const el = parentEl();
        if (!el) return null;
        const mode = nodeRenderMode(el.kind);
        return mode.mode === 'lens' ? mode.targetKind : null;
    };
    const ownerId = () => parentEl()?.parentId ?? '';
    const derivedJobs = useLensGather(ownerId, lensTargetKind);
    // Re-rooted into a lens, `parentEl` IS the lens Element (carries the bound
    // policy Definition). No-ops to the pickerLabel fallback for plain nodes.
    // Read here keeps parity with the Qwik view; consumed by LensCreate in Phase IV.
    useLensPolicy(parentEl, lensTargetKind);

    // TODO(Phase IV): cancel in-flight construction on parentId change

    return (
        <Show
            when={!isLoading() && parentNode()}
            fallback={<main class="view-branch">Loading...</main>}
        >
            <main class="view-branch">
                {/* Parent node row */}
                <div class="branch-parent-row">
                    <div class="branch-parent-node">
                        <TreeNode
                            id={parentNode()!.id}
                            name={parentNode()!.name}
                            subtitle={parentNode()!.subtitle ?? ''}
                            nodeState="PARENT"
                            kind={parentNode()!.kind}
                            parentId={parentNode()!.parentId}
                            onNavigateUp={navigateUp}
                        />
                    </div>
                </div>

                {/* Children container with indent */}
                <div class="branch-children">
                    <Show
                        when={lensTargetKind()}
                        fallback={
                            <>
                                {/* Filter out lens-surfaced kinds, which live in their lens
                                    rollup, not as loose tree children. */}
                                <For each={children().filter(child => !isLensSurfaced(child.kind))}>
                                    {(child) => (
                                        <TreeNode
                                            id={child.id}
                                            name={child.name}
                                            subtitle={child.subtitle ?? ''}
                                            nodeState="CHILD"
                                            kind={child.kind}
                                            onNodeClick={() => navigateToNode(child.id)}
                                        />
                                    )}
                                </For>
                                {/* TODO(Phase IV): UC block + <CreateNodeButton variant="child"> */}
                            </>
                        }
                    >
                        {/* Lens parent: the derived jobs as Node-like CHILD cards (each owns
                            its expandable DataCard; click re-roots into that job). The lens's
                            own DataFields show in the PARENT card above. */}
                        <For each={derivedJobs()}>
                            {(job) => (
                                <TreeNode
                                    id={job.id}
                                    name={job.name}
                                    subtitle={job.subtitle ?? ''}
                                    nodeState="CHILD"
                                    kind={job.kind}
                                    onNodeClick={() => navigateToNode(job.id)}
                                />
                            )}
                        </For>
                        {/* TODO(Phase IV): <LensCreate> */}
                    </Show>
                </div>
            </main>
        </Show>
    );
};
