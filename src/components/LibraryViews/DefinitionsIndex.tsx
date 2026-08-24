/**
 * DefinitionsIndex — the Library's "Field Definitions" lens: every field-like
 * Definition drawn as a normal CHILD node card (they really are Nodes in most
 * respects): NodeHeader carries the Definition's name + id in the subtitle slot,
 * and the DataCard holds one unfilled instance of the Definition itself.
 *
 * The preview mounts a real `<DataField preview>` — a live **microcosm**: the
 * Renderer runs in pendingMode over local state, seeded from the manifest's
 * `previewSeed` (enum-kv opens on its first option), so the value is switchable
 * and threshold/state colors compute — but nothing ever reaches the command bus
 * or sync, and Tools' Delete is disabled. The field-details bands are live; the
 * Config band renders schema-complete (unset knobs as "—"). Expand state rides
 * the same FSM state as
 * real nodes (keyed by Definition id). A pure gather over `listDefinitions()` —
 * no storage change, no editing (SPEC → The Library).
 */

import { createResource, createSignal, For, Show, Suspense } from 'solid-js';
import { getDefinitionQueries } from '../../data/queries';
import { isFieldLikeDefinitionKind } from '../../data/libraryChrome';
import { DataField } from '../DataField/DataField';
import { getInlineManifest } from '../../kinds/registry';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useRevealOnArrival } from '../../hooks/useRevealOnArrival';
import type { Definition } from '../../data/models';
import nodeStyles from '../TreeNode/TreeNode.module.css';
import styles from './LibraryViews.module.css';

const DefinitionNode = (props: { def: Definition }) => {
    const appState = useAppState();
    const { toggleCardExpanded } = useAppTransitions();
    const isExpanded = () => selectors.getDataCardState(appState, props.def.id) === 'EXPANDED';

    // The receiving half of a Field's *from <Definition>* line: arriving here
    // centres and flashes the Definition's card, the same way a Field row
    // answers an `internal-link`'s `→`. Without it the reveal would land on the
    // lens with nothing to say which of thirty rows it meant.
    const [wrapperEl, setWrapperEl] = createSignal<HTMLElement>();
    const isRevealed = useRevealOnArrival(() => props.def.id, wrapperEl);

    return (
        <div
            ref={setWrapperEl}
            classList={{
                [nodeStyles.nodeWrapper]: true,
                [nodeStyles.nodeWrapperRevealed]: isRevealed(),
            }}
            style={{ '--datacard-indent': '18px' }}
        >
            <NodeHeader
                id={props.def.id}
                titleId={`node-title-${props.def.id}`}
                isExpanded={isExpanded()}
                name={props.def.label}
                subtitle={props.def.id}
                onExpand={(e) => { e?.stopPropagation(); toggleCardExpanded(props.def.id); }}
            />
            <DataCard isOpen={isExpanded()}>
                <div class={styles.previewGrid}>
                    <DataField
                        id={`library-preview::${props.def.id}`}
                        name={props.def.label}
                        definitionId={props.def.id}
                        kind={props.def.kind}
                        value={getInlineManifest(props.def.kind).previewSeed?.(props.def.config) ?? null}
                        preview
                    />
                </div>
            </DataCard>
        </div>
    );
};

export const DefinitionsIndex = () => {
    // listDefinitions is chrome-excluded and name-sorted at the adapter; the
    // remaining filter drops policy Definitions (logbook) — a Definition of a
    // re-root kind belongs to its lens, not this index.
    const [defs] = createResource(async () =>
        (await getDefinitionQueries().listDefinitions()).filter((d) => isFieldLikeDefinitionKind(d.kind)),
    );

    return (
        <Suspense fallback={<div class={styles.empty}>Loading…</div>}>
            <Show when={defs()?.length === 0}>
                <div class={styles.empty}>No Definitions</div>
            </Show>
            <For each={defs() ?? []}>{(d) => <DefinitionNode def={d} />}</For>
        </Suspense>
    );
};
