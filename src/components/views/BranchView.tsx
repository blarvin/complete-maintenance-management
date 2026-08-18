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
import { LIBRARY_ROOT_ID } from '../../data/definitionIds';
import type { Element, Kind } from '../../data/models';

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

    /**
     * Inside the Library, "＋ Node" would mint a bare `node` with no self-reference
     * and no config subtree — a row that looks like a Definition, is listed as one
     * nowhere, and defines nothing. Definitions are coined through the Add Surface,
     * which writes both halves; the Library is where they are *read and changed*
     * (SPEC → *The Add Surface only ever adds*).
     *
     * Withheld only on the Library Node itself. A Definition's own card keeps its
     * create affordances — a Definition's card is open, and may carry Fields that
     * are not config at all.
     */
    const isLibraryRoot = () => props.parentId === LIBRARY_ROOT_ID;

    /**
     * A Definition's row shows its id where a subtitle would go. **Projected at
     * render, never stored**: storing it would put it in the sync stream and leak
     * an id into contexts that have no business with one. It is the placeholder
     * answer to telling two same-named Definitions apart (ISSUES → Features →
     * *namespace collision scheme*) until a byline exists to carry that.
     */
    const rowSubtitle = (child: Element): string =>
        child.definitionId === child.id ? child.id : (child.subtitle ?? '');

    /**
     * Filter out the UC node (dual render — see RootView) and lens-surfaced kinds,
     * which live in their lens rollup rather than as loose tree children.
     *
     * Inside the Library, sort by `name`: every Definition is minted at
     * `siblingOrder: 0`, so the adapter's order is really insertion order and a
     * catalogue you look things up in has to be alphabetical. `siblingOrder` should
     * come to mean here what it means everywhere else, which makes the Library the
     * second consumer of the still-undecided reorder gesture (SPEC → *Listing under
     * the Kind band*); until then this stands in for it.
     */
    const displayChildren = createMemo(() => {
        const shown = children().filter((child) => {
            const uc = ucNode();
            return (!uc || child.id !== uc.id) && !isLensSurfaced(child.kind);
        });
        return isLibraryRoot()
            ? [...shown].sort((a, b) => a.name.localeCompare(b.name))
            : shown;
    });

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
                            subtitle={rowSubtitle(parentNode()!)}
                            nodeState="PARENT"
                            kind={parentNode()!.kind}
                            parentId={parentNode()!.parentId}
                            definitionId={parentNode()!.definitionId}
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
                                <For each={displayChildren()}>
                                    {(child) => (
                                        <TreeNode
                                            id={child.id}
                                            name={child.name}
                                            subtitle={rowSubtitle(child)}
                                            nodeState="CHILD"
                                            kind={child.kind}
                                            parentId={child.parentId}
                                            definitionId={child.definitionId}
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
                                    minted from inside the Jobs container, never as loose tree siblings)
                                    — and withheld entirely inside the Library, where a bare `node` would
                                    be a Definition that defines nothing (see `isLibraryRoot`). */}
                                <Show when={!isLibraryRoot()}>
                                    <CreateNodeButton
                                        variant="child"
                                        availableKinds={reRootCreateKindsFor(parentNode()!.kind).filter((k) => !isLensSurfaced(k))}
                                        onClick={start}
                                    />
                                </Show>
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
                                    parentId={job.parentId}
                                    definitionId={job.definitionId}
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
