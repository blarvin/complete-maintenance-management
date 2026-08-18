/**
 * FieldList - Renders persisted DataFields for a node and mounts the
 * add-field surfaces enabled in ENABLED_ADD_FIELD_SURFACES.
 *
 * Hosts the `activeSurface` mutex shared by all display-mode add-field
 * surfaces — opening one closes the others. Surface contract and roster
 * live in ./addFieldSurfaces.ts.
 *
 * The roster gates construction mode too: with it empty, a node under
 * construction renders its persisted fields only (there are none yet) and the
 * defaults arrive anyway — useNodeCreation seeds and commits the pending draft
 * itself, so nothing here has to be mounted for that to happen.
 *
 * Data arrives via useElementChildren (writes emit; readers subscribe) —
 * no reload callbacks are threaded to children. Composer orchestration
 * (open/restore plumbing) lives inside FieldComposerSlot.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { DataField } from '../DataField/DataField';
import { FieldComposerSlot } from '../FieldComposer/FieldComposerSlot';
import { CreateDataField } from '../CreateDataField/CreateDataField';
import { AddFieldSurface } from '../AddFieldSurface/AddFieldSurface';
import { useElementChildren } from '../../hooks/useElementChildren';
import { useDefinitionConfig } from '../../hooks/useDefinitionConfig';
import { allowedChildKinds } from '../../kinds/childrenPolicy';
import { FIELD_KINDS } from '../../kinds/registry';
import { CONFIG_SCHEMAS } from '../../kinds/configSchema';
import { configChildId, DEFINED_KIND_KEY } from '../../kinds/configElements';
import type { ConfigSubField } from '../../kinds/types';
import { ENABLED_ADD_FIELD_SURFACES } from '../../constants';
import type { ActiveSurface } from './addFieldSurfaces';
import type { DefinitionConfig, Element, Kind } from '../../data/models';
import styles from './FieldList.module.css';

export type FieldListProps = {
    nodeId: string;
    /**
     * The owning node's kind, which entails whether an Add Surface renders at
     * all (SPEC → The Add Surface). Optional because a read-only peek
     * (`hideAddSurfaces`) has no create affordance to gate.
     */
    kind?: Kind;
    /**
     * This node is a **FieldDefinition**, so its Fields *are* its config
     * (SPEC → *Everything in the Library is a Node with Fields*). Config rows are
     * bound to no Definition of their own, so each needs its schema entry handed
     * to it — see `configFor` below. The node's id is its `definitionId`, which is
     * what makes this a boolean rather than an id.
     */
    isDefinition?: boolean;
    /** When true, operates in construction mode (composer open by default). */
    isConstruction?: boolean;
    /** Definition IDs to pre-populate as locked-in composer rows (construction defaults). */
    initialDefinitionIds?: readonly string[];
    /** When true, suppress the add-field surfaces — a read-only peek of existing fields. */
    hideAddSurfaces?: boolean;
};

/** Module-level so its identity is stable — see `configByChildId`. */
const EMPTY_CONFIG: DefinitionConfig = {};

export const FieldList = (props: FieldListProps) => {
    const { children: fields } = useElementChildren(() => props.nodeId, 'fields');

    /* ────────────────────────────────────────────────────────────────────────
     * A Definition's card: its Fields are its config
     *
     * Required rather than polish. `DataField` hands its Renderer only a
     * `definitionId`, and a config Field's is `null` — so without this every
     * `enum-kv` config row (`Affix position`, `Display format`, `Nominal mode`
     * and `Kind` itself) would draw an empty dropdown, and the text/number rows
     * would sit on a resource that never resolves.
     *
     * The schema is keyed by **forward-constructed** ids (`configChildId`), never
     * by parsing `::cfg::` back out of a child id — that is `configElements`' own
     * contract, and the reason the ids are deterministic in the first place.
     * ──────────────────────────────────────────────────────────────────────── */

    // The Definition read-model view resolves the defined kind off the `::cfg::kind`
    // child, so this is also how the card learns which schema to apply. Subscribed
    // to DEFINITION_WRITTEN, so editing one knob re-reads the vocabulary another
    // knob offers (enum-kv's `default` over its `options`).
    const { definition } = useDefinitionConfig(() => (props.isDefinition ? props.nodeId : null));

    /** The `kind` row is write-once: set at mint, read-only for life. */
    const kindChildId = createMemo(() =>
        props.isDefinition ? configChildId(props.nodeId, DEFINED_KIND_KEY) : null,
    );

    /**
     * Each config row's `config`, by child id — built as **one map per Definition
     * read** rather than per row, so the objects have stable identity. That is
     * load-bearing, not tidiness: `TextKvField` and `NumberKvField` key their body
     * on `<Show when={config()} keyed>`, so a fresh object per read would remount
     * the editor under the user's cursor.
     *
     * `dynamicOptions` wins over `options` for the same reason it does in the Add
     * Surface: a sub-field whose vocabulary *is* another knob's value must offer
     * what that knob currently says, not a fixed list.
     */
    const configByChildId = createMemo<Map<string, DefinitionConfig>>(() => {
        const map = new Map<string, DefinitionConfig>();
        const def = definition();
        if (!def) return map;
        // The Kind row's vocabulary is the closed kind catalogue. It never opens,
        // so this is what it reads *from* rather than what it offers.
        map.set(configChildId(def.id, DEFINED_KIND_KEY), { options: FIELD_KINDS } as DefinitionConfig);
        const flat = def.config as Record<string, unknown>;
        const schema: ConfigSubField[] = CONFIG_SCHEMAS[def.kind] ?? [];
        for (const sub of schema) {
            const options = sub.dynamicOptions ? sub.dynamicOptions(flat) : sub.options;
            map.set(configChildId(def.id, sub.key), (options ? { options } : {}) as DefinitionConfig);
        }
        return map;
    });

    /**
     * What a row's Renderer gets as `config`.
     *
     * **A Definition's card is open**, so not every row on it is config: it may
     * carry notes, ownership, or an ordinary Field of any kind (SPEC → *A
     * Definition's card is open*). The identity column tells them apart without a
     * lookup — a config Field is bound to nothing, an instance names its
     * Definition — and getting this wrong is not cosmetic: handing an instance a
     * config of `{}` overrides the fetch it needed, so a `12.34 kg` Weight sitting
     * on the Weight Definition's own card silently rendered with default units and
     * decimals. Found in the 2026-08-18 hand-test.
     *
     * For a genuine config row the answer is always an object, never `undefined`:
     * a renderer treats `config` as the override for its `createResource`, and a
     * config Field has no Definition to fall back to fetching.
     */
    const configFor = (field: Element): DefinitionConfig | undefined => {
        if (!props.isDefinition || field.definitionId !== null) return undefined;
        return configByChildId().get(field.id) ?? EMPTY_CONFIG;
    };

    const maxPersistedCardOrder = createMemo(() => {
        if (fields().length === 0) return -1;
        return Math.max(...fields().map(f => f.siblingOrder));
    });

    // Shared mutex for the display-mode add-field surfaces.
    const [activeSurface, setActiveSurface] = createSignal<ActiveSurface>('none');

    const mode = () => props.isConstruction ? 'construction' : 'display';

    /**
     * The Add Surface is entailed, not declared: it renders iff this kind admits
     * at least one field-like child (SPEC → The Add Surface). A kind with no
     * `children` capability yields `[]` and gets no create affordance, exactly as
     * a content-free lens offers no "Add".
     *
     * Construction is excluded because the node does not exist yet, so nothing
     * can be parented to it — its defaults arrive with the node itself
     * (SPEC → Node Creation).
     */
    const admittedFieldKinds = createMemo<Kind[]>(() => {
        if (!props.kind) return [];
        return allowedChildKinds(props.kind).filter((k) => FIELD_KINDS.includes(k));
    });

    const showAddSurface = () =>
        !props.hideAddSurfaces
        && !props.isConstruction
        && ENABLED_ADD_FIELD_SURFACES.includes('add-surface')
        && admittedFieldKinds().length > 0;

    return (
        <div class={styles.fieldList}>
            <For each={fields()}>
                {(field) => (
                    <DataField
                        id={field.id}
                        name={field.name}
                        definitionId={field.definitionId}
                        kind={field.kind}
                        value={field.value}
                        updatedAt={field.updatedAt}
                        config={configFor(field)}
                        readOnly={field.id === kindChildId()}
                    />
                )}
            </For>

            <Show when={showAddSurface()}>
                <AddFieldSurface
                    nodeId={props.nodeId}
                    admittedKinds={admittedFieldKinds()}
                    baseOrder={maxPersistedCardOrder()}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('composer')}>
                <FieldComposerSlot
                    nodeId={props.nodeId}
                    mode={mode()}
                    currentMaxCardOrder={maxPersistedCardOrder()}
                    initialDefinitionIds={props.initialDefinitionIds}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>

            <Show when={!props.hideAddSurfaces && ENABLED_ADD_FIELD_SURFACES.includes('legacy') && !props.isConstruction}>
                <CreateDataField
                    nodeId={props.nodeId}
                    currentMaxCardOrder={maxPersistedCardOrder()}
                    activeSurface={activeSurface}
                    setActiveSurface={setActiveSurface}
                />
            </Show>
        </div>
    );
};
