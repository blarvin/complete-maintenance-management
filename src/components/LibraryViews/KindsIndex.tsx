/**
 * KindsIndex — the Library's "Kinds" lens: one Node per user-mintable field kind.
 *
 * **A kind is an archetype, not an object**, so unlike a Definition it has no
 * canonical instance to show: with no config authored there is no label, no
 * units, no options — nothing that makes an instance mean anything. What a kind
 * *does* have is the pair the Add Surface already draws — a live instance row
 * plus the knobs that shape it — so that is what each Kind node holds: the
 * kind's Renderer in `pendingMode` over local state, above `ConfigRows` over a
 * local config seeded from the manifest's `defaultConfig()`.
 *
 * Turning a knob re-renders the instance above it (type options, watch the enum
 * gain them), because the Renderer takes `config` as a prop — the same wiring
 * that lets an Add Surface draft preview options being typed. Nothing here is
 * stored: no Definition, no Element, no command, no sync. It is the authoring
 * surface's preview with the authoring removed.
 *
 * The Add Surface's `authoringMemo` is deliberately not shown — it points at a
 * Kind band ("pick a different Kind below") that exists only while minting.
 */

import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { FIELD_KINDS, getInlineManifest } from '../../kinds/registry';
import { ConfigRows } from '../ConfigRows/ConfigRows';
import { NodeHeader } from '../NodeHeader/NodeHeader';
import { DataCard } from '../DataCard/DataCard';
import { useAppState, useAppTransitions, selectors } from '../../state/appState';
import { useRevealOnArrival } from '../../hooks/useRevealOnArrival';
import { kindArchetypeId } from '../../data/definitionIds';
import { isUnfilled } from '../../data/models';
import type { DataFieldValue, DefinitionConfig, Kind } from '../../data/models';
import nodeStyles from '../TreeNode/TreeNode.module.css';
import chevron from '../../styles/disclosure.module.css';
import df from '../DataField/DataField.module.css';
import styles from './LibraryViews.module.css';

const KindNode = (props: { kind: Kind }) => {
    const appState = useAppState();
    const { toggleCardExpanded } = useAppTransitions();

    const manifest = () => getInlineManifest(props.kind);
    // One archetype id per kind: `useFieldEdit` tracks edit state by element id,
    // so two kind rows must not share one. Shared with the Config band's
    // *from <Kind>* link, which aims a reveal at exactly this id.
    const rowId = () => kindArchetypeId(props.kind);
    const isExpanded = () => selectors.getDataCardState(appState, rowId()) === 'EXPANDED';

    // Local from mount on: the archetype's whole point is that turning a knob
    // changes the instance above it and nothing else, anywhere.
    const [config, setConfig] = createSignal<DefinitionConfig>(manifest().defaultConfig());
    const [value, setValue] = createSignal<DataFieldValue | null>(null);

    const [rowEl, setRowEl] = createSignal<HTMLElement>();

    // The receiving half of a Field's *from <Kind>* line, the same wiring
    // `DefinitionNode` has for the Definition half. `rowId()` is a synthetic
    // archetype id rather than an Element id — which the reveal does not mind:
    // `revealedElementId` is a string compared in a selector, and a kind is an
    // archetype with no row in storage to point at.
    const [wrapperEl, setWrapperEl] = createSignal<HTMLElement>();
    const isRevealed = useRevealOnArrival(rowId, wrapperEl);

    // The arrangement law, read the same way DataField reads it: composite
    // renderers own their sub-structure, so the generic label is suppressed.
    const shape = () => manifest().ownValue?.shape ?? 'scalar';

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
                id={rowId()}
                titleId={`node-title-${rowId()}`}
                isExpanded={isExpanded()}
                name={manifest().pickerLabel}
                subtitle={props.kind}
                onExpand={(e) => { e?.stopPropagation(); toggleCardExpanded(rowId()); }}
            />
            <DataCard isOpen={isExpanded()}>
                {/* Filled surface on purpose: a ConfigRows control is drawn as a
                    hole in its background rather than a bordered widget, so it
                    only reads as somewhere-to-put-something over a fill. */}
                <div class={styles.archetype}>
                    <div class={styles.previewGrid}>
                        <div
                            ref={setRowEl}
                            classList={{
                                [df.datafieldWrapper]: true,
                                [df.datafieldWrapperBlock]: shape() !== 'scalar',
                                [df.datafieldWrapperUnfilled]: isUnfilled(value()),
                                'no-caret': true,
                            }}
                        >
                            {/* No details chevron: an archetype has no history to
                                show, no Definition to read config from, and
                                nothing to delete. The spacer keeps the label in
                                the column its instance would sit in. */}
                            <span class={chevron.chevronSpacer} aria-hidden="true" />
                            <Show when={shape() !== 'composite'}>
                                <label class={df.datafieldLabel}>{manifest().pickerLabel}:</label>
                            </Show>
                            <Dynamic
                                component={manifest().Renderer}
                                id={rowId()}
                                definitionId=""
                                config={config()}
                                value={value()}
                                updatedAt={0}
                                rootRef={rowEl}
                                pendingMode={{ onChange: setValue }}
                            />
                        </div>
                    </div>
                    <ConfigRows kind={props.kind} config={config()} onChange={setConfig} />
                </div>
            </DataCard>
        </div>
    );
};

export const KindsIndex = () => (
    <For each={FIELD_KINDS}>{(kind) => <KindNode kind={kind} />}</For>
);
