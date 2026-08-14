/**
 * BranchView - Displays a parent node with its children.
 * Uses centralized FSM state for navigation.
 */

import { createEffect, createMemo, For, on, Show } from 'solid-js';
import { TreeNode } from '../TreeNode/TreeNode';
import { CreateNodeButton } from '../CreateNodeButton/CreateNodeButton';
import { LensCreate } from '../LensCreate/LensCreate';
import { useAppState, useAppTransitions } from '../../state/appState';
import { useNodeCreation } from '../../hooks/useNodeCreation';
import { useElementChildren, useElementById } from '../../hooks/useElementChildren';
import { useLensGather } from '../../hooks/useLensGather';
import { useLensPolicy } from '../../hooks/useLensPolicy';
import { isReRoot } from '../../kinds/placement';
import { isLensSurfaced } from '../../kinds/childrenPolicy';
import { reRootCreateKindsFor } from '../../kinds/registry';
import { derivationOf, nodeRenderMode } from '../../kinds/renderMode';
import type { Kind } from '../../data/models';

export type BranchViewProps = {
    parentId: string;
};

export const BranchView = (props: BranchViewProps) => {
    const appState = useAppState();
    const { navigateToNode, navigateUp, cancelConstruction } = useAppTransitions();

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
    // The lens kind's own descriptor drives the gather. Gated on `lensTargetKind` so
    // an `org` (Derivation without Provision) doesn't run a subtree walk it never
    // renders — its rollup is a header chip, not this view.
    const lensDerivation = () => (lensTargetKind() ? derivationOf(parentEl()?.kind) : null);
    const derivedJobs = useLensGather(ownerId, lensDerivation);
    // Re-rooted into a lens, `parentEl` IS the lens Element (carries the bound
    // policy Definition). No-ops to the pickerLabel fallback for plain nodes.
    const lensPolicy = useLensPolicy(parentEl, lensTargetKind);

    // Navigating to a new branch cancels any in-flight construction. Defensive
    // only — guards.notUnderConstruction blocks navigation while UC is open.
    // `on()` is load-bearing: its callback runs untracked, so the
    // `underConstruction` read never becomes a dependency — a plain effect would
    // re-run on startConstruction and cancel the construction it just opened.
    // Calls the raw transition (not the hook's cancel) so the localStorage draft
    // survives navigation, as pre-migration.
    createEffect(on(() => props.parentId, () => {
        if (appState.underConstruction) {
            cancelConstruction();
        }
    }));

    const { ucNode, start, cancel, complete } = useNodeCreation(() => props.parentId);

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
                                {/* Filter out the UC node (dual render — see RootView) +
                                    lens-surfaced kinds, which live in their lens rollup,
                                    not as loose tree children. */}
                                <For each={children().filter(child => {
                                    const uc = ucNode();
                                    return (!uc || child.id !== uc.id) && !isLensSurfaced(child.kind);
                                })}>
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

                                {/* Under construction node */}
                                <Show when={ucNode()} keyed>
                                    {(uc) => (
                                        <div class="branch-child-row">
                                            <TreeNode
                                                id={uc.id}
                                                name={uc.name}
                                                subtitle={uc.subtitle}
                                                nodeState="UNDER_CONSTRUCTION"
                                                isChildConstruction={true}
                                                onCancel={cancel}
                                                onCreate={complete}
                                            />
                                        </div>
                                    )}
                                </Show>

                                {/* Normal node-create picker, trimmed of lens-surfaced kinds (jobs are
                                    minted from inside the Jobs container, never as loose tree siblings). */}
                                <CreateNodeButton
                                    variant="child"
                                    availableKinds={reRootCreateKindsFor(parentNode()!.kind).filter((k) => !isLensSurfaced(k))}
                                    onClick={start}
                                />
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
                        <LensCreate
                            ownerId={ownerId()}
                            targetKind={lensTargetKind()!}
                            entryLabel={lensPolicy().entryLabel || undefined}
                        />
                    </Show>
                </div>
            </main>
        </Show>
    );
};
