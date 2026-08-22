/**
 * AddFieldSurface — the DataCard's create affordance (SPEC → The Add Surface).
 *
 * **It is a Field row that has not decided what it is yet.** Same grid tracks,
 * same chevron column, same expandable band region as a persisted Field — it
 * wears `DataField.module.css`'s `.datafieldWrapper` rather than imitating it,
 * which is what makes the row a true preview instead of a second rendering path
 * obliged to resemble the first. What differs is only what fills each slot: a
 * `＋` for the disclosure triangle, a chrome-less name input for the static
 * label, the *draft* kind's Renderer (in `pendingMode`) for the value, and bands
 * **Config · Kind · Tools** in place of History · Config · Tools.
 *
 * Typing a name authors a Definition; the Kind band reaches the Library for an
 * existing one. `Create` commits — authoring writes the Definition then mints an
 * instance, picking mints only, and in both the drafted value rides along as the
 * new Field's initial value. `Cancel` discards. **Collapsing keeps the draft**,
 * and the row wears the under-construction tint the whole time it holds one, so
 * an unfinished Field can neither be mistaken for a real one nor lost among
 * them. The draft is in memory: it does not survive a reload.
 *
 * Keyboard support is deliberately out of scope for this pass (SPEC → Keyboard
 * & Accessibility); the roving-tabindex tree the old LibraryPicker carried went
 * with it rather than being half-ported.
 *
 * Ships as one of several roster entries (see ../FieldList/addFieldSurfaces),
 * so it shares the `activeSurface` mutex — opening it closes the others.
 */

import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { getCommandBus } from '../../data/commands';
import { getDefinitionQueries } from '../../data/queries';
import { commitWithUndo } from '../../data/services/commitWithUndo';
import { useDefinitionDraft } from '../../hooks/useDefinitionDraft';
import { getInlineManifest, getKindManifest, FIELD_KINDS } from '../../kinds/registry';
import { isInline } from '../../kinds/placement';
import { valueForKind } from '../../kinds/valueCompat';
import { generateId } from '../../utils/id';
import { formatTimestampShort } from '../../utils/time';
import { ConfigRows } from '../ConfigRows/ConfigRows';
import { ConfigSummary } from '../ConfigSummary/ConfigSummary';
import { DetailBands, type DetailBand } from '../DetailBands/DetailBands';
import type { ActiveSurface } from '../FieldList/addFieldSurfaces';
import type { Definition, Element, Kind } from '../../data/models';
import type { Accessor } from 'solid-js';
import chevron from '../../styles/disclosure.module.css';
import bandStyles from '../DetailBands/DetailBands.module.css';
import df from '../DataField/DataField.module.css';
import styles from './AddFieldSurface.module.css';

export type AddFieldSurfaceProps = {
    nodeId: string;
    /** Field kinds this node admits — `allowedChildKinds ∩ FIELD_KINDS`. */
    admittedKinds: Kind[];
    /** Max `siblingOrder` among already-persisted fields; the new Field lands one past it. */
    baseOrder: number;
    activeSurface: Accessor<ActiveSurface>;
    setActiveSurface: (s: ActiveSurface) => void;
};

const SURFACE_ID = 'add-surface' as const;

/** Mirrors `LABEL_MAX` in useDefinitionDraft, which is the enforcing half. */
const NAME_MAX = 40;

/**
 * Sentinel for a failed fetch. Not because `createResource` lacks an error
 * channel — Solid 1.x `Resource<T>` carries `.error` and `state: 'errored'` —
 * but because *reading* an errored resource rethrows, so the `.error` route
 * obliges every caller to guard before touching `definitions()` and wants an
 * `<ErrorBoundary>` above it. Catching in the fetcher keeps failure a value the
 * render can branch on, which is all this surface needs to tell a broken Library
 * from an empty one.
 */
const FAILED = Symbol('failed');

export const AddFieldSurface = (props: AddFieldSurfaceProps) => {
    const isOpen = () => props.activeSurface() === SURFACE_ID;

    // Keyed by node: the draft outlives a reload, and each card keeps its own.
    const draft = useDefinitionDraft(() => props.nodeId);

    // The row ref is owned here so outside-click detection inside the value
    // Renderer covers the whole row, exactly as DataField does it.
    const [rootEl, setRootEl] = createSignal<HTMLElement>();

    /**
     * One id per draft. The value slot is a real Renderer, and `useFieldEdit`
     * tracks edit state by element id — same reason ComposerRow passes its
     * pending form's id. A fresh id per draft is also what retires the previous
     * slot: keyed on it below, so a committed or cancelled draft cannot leave a
     * buffered value behind in a renderer that seeds at mount.
     */
    const [draftId, setDraftId] = createSignal(generateId());

    const manifest = createMemo(() => getInlineManifest(draft.kind()));
    const authoringMemo = () => getKindManifest(draft.kind()).authoringMemo;

    // Also keyed on `valueEpoch`: the slot's Renderer buffers its value from
    // mount, so a value written behind its back — the Config band's `default`
    // mirror, or seeding from a picked Definition — is only visible once the
    // slot re-mounts. Edits made *in* the slot don't bump it.
    const slotKey = () => `${draftId()}:${draft.kind()}:${draft.valueEpoch()}`;

    const open = () => props.setActiveSurface(SURFACE_ID);
    const close = () => props.setActiveSurface('none');
    const toggle = () => (isOpen() ? close() : open());

    /** Create is gated on the same rule the draft derives from the live config,
     *  so the button never promises a commit the validator would reject. A picked
     *  Definition is already coherent — nothing here can block it. */
    const blocker = (): string | null => {
        if (draft.picked()) return null;
        if (!draft.label().trim()) return 'Needs a name';
        return draft.configError();
    };

    const create = async () => {
        const parentId = props.nodeId;
        const siblingOrder = props.baseOrder + 1;
        await commitWithUndo({
            message: (result) => (result ? 'Field added' : null),
            execute: () => draft.commit(parentId, siblingOrder),
            undo: (result) => {
                const created = result as Element | null;
                if (!created) return;
                return getCommandBus().execute({
                    type: 'DELETE_ELEMENT',
                    payload: { id: created.id },
                }) as Promise<void>;
            },
        });
        // `commit` resets the draft on success and leaves it standing otherwise,
        // so this is the honest success test — a gated or failed Create keeps the
        // row open with everything the user typed still in it.
        if (!draft.isDirty()) {
            setDraftId(generateId());
            close();
        }
    };

    const cancel = () => {
        draft.reset();
        setDraftId(generateId());
        close();
    };

    /**
     * Config and Tools carry **no heading and no chevron**: on a draft row they
     * are not one region among several to be chosen between, they are the row's
     * whole reason to be open. Hiding the knobs you came to set, or the button
     * that commits them, behind a disclosure the user must find first is a
     * toggle that only ever has one useful position. The Config band's memo
     * ("Creating a Number field…") already says what the rows are, which is what
     * a `CONFIG` heading would have been for.
     *
     * Kind keeps both, because it *is* optional: the draft starts as `text-kv`
     * and the shortest path through the surface never opens it.
     */
    const bands = (): DetailBand[] => [
        {
            id: 'config',
            title: null,
            present: true,
            collapsible: false,
            defaultOpen: true,
            body: () => (
                <div class={bandStyles.sectionBody}>
                    <Show
                        when={draft.picked()}
                        fallback={
                            <>
                                {/* Authoring chrome, never a config sub-field: it
                                    names what is being made and points at the
                                    band that changes it. */}
                                <Show when={authoringMemo()}>
                                    <div class={styles.memo}>{authoringMemo()}</div>
                                </Show>
                                <ConfigRows
                                    kind={draft.kind()}
                                    config={draft.config()}
                                    onChange={draft.setConfig}
                                />
                            </>
                        }
                    >
                        {/* Read-only by contract: config is `delegated`, so
                            altering what an existing Definition means is not this
                            surface's job (SPEC → The bands). */}
                        {(def) => <ConfigSummary definitionId={def().id} source={def().label} />}
                    </Show>
                </div>
            ),
        },
        {
            id: 'kind',
            title: 'Kind',
            present: true,
            collapsible: true,
            defaultOpen: true,
            body: () => (
                <div class={bandStyles.sectionBody}>
                    <KindBand
                        admittedKinds={props.admittedKinds}
                        selectedKind={draft.kind()}
                        pickedId={draft.picked()?.id ?? null}
                        onPickKind={draft.pickKind}
                        onPickDefinition={draft.pickDefinition}
                    />
                </div>
            ),
        },
        {
            id: 'tools',
            title: null,
            present: true,
            collapsible: false,
            defaultOpen: true,
            body: () => (
                <div classList={{ [bandStyles.sectionBody]: true, 'no-caret': true }}>
                    <Show when={blocker() && draft.label().trim()}>
                        <div class={styles.error} role="alert">{blocker()}</div>
                    </Show>
                    <div class={styles.toolsRow}>
                        <button
                            type="button"
                            class={styles.createButton}
                            disabled={!!blocker()}
                            onClick={() => void create()}
                        >
                            Create
                        </button>
                        <button type="button" class={styles.cancelButton} onClick={cancel}>
                            Cancel
                        </button>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div
            ref={setRootEl}
            classList={{
                [df.datafieldWrapper]: true,
                // The two tints are exclusive rather than stacked: which one wins
                // would otherwise come down to CSS-module source order.
                [df.datafieldWrapperExpanded]: isOpen() && !draft.isDirty(),
                [styles.constructing]: draft.isDirty(),
                'no-caret': true,
            }}
        >
            <button
                type="button"
                class={styles.plusGlyph}
                onClick={toggle}
                aria-expanded={isOpen()}
                aria-label={isOpen() ? 'Collapse the new field row' : 'Expand the new field row'}
            >
                {/* A plus, not a triangle: this row makes something rather than
                    revealing what is already there. Rotating 45° turns it into an
                    × rather than losing the state the triangle used to carry. The
                    glyph rotates inside the button, so it stays put in the column. */}
                <span
                    classList={{ [styles.plusMark]: true, [styles.plusMarkOpen]: isOpen() }}
                    aria-hidden="true"
                >
                    +
                </span>
            </button>

            {/* The name is an input at rest, with no box chrome — it reads as a
                label, not a form control. `size={1}` is the pre-`field-sizing`
                fallback: without it the intrinsic ~20ch width would widen the
                shared `label` track for every row in the card. */}
            <input
                class={styles.nameInput}
                type="text"
                size={1}
                value={draft.label()}
                maxLength={NAME_MAX}
                placeholder="Add Field"
                aria-label="New field name"
                // A picked Definition owns its name — the mint snapshots
                // `definition.label`, so an edit here would be a lie.
                readOnly={!!draft.picked()}
                onInput={(e) => draft.setLabel(e.currentTarget.value)}
            />

            {/* The value slot is the draft kind's real Renderer, buffering its
                edits instead of writing them: what is on screen while drafting is
                what the Field becomes. Keyed so a new draft gets a new slot. */}
            <Show when={slotKey()} keyed>
                <Dynamic
                    component={manifest().Renderer}
                    id={draftId()}
                    definitionId={draft.picked()?.id ?? ''}
                    config={draft.config()}
                    value={valueForKind(draft.value(), draft.kind())}
                    updatedAt={0}
                    rootRef={rootEl}
                    pendingMode={{ onChange: draft.setValue }}
                />
            </Show>

            <Show when={isOpen()}>
                {/* Keyed by node, not by `draftId`: the draft row is a fresh id
                    per draft, so a per-draft key would strand a `uiPrefs` entry
                    on every Create and never restore the user's band choices. */}
                <DetailBands bands={bands()} persistKey={`add-surface:${props.nodeId}`} />
            </Show>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────────────────────
 * The Kind band — one row per admitted kind, expanding to that kind's Library
 * Definitions. A **view** over the `library` tree, never a re-parenting: the
 * Definitions are gathered by their `kind` and drawn beneath it, so Definition
 * identity (`isDefinitionRow` — a non-chrome library root) is untouched
 * (SPEC → Listing under the Kind band).
 * ──────────────────────────────────────────────────────────────────────────── */

type KindBandProps = {
    admittedKinds: Kind[];
    selectedKind: Kind;
    pickedId: string | null;
    onPickKind: (kind: Kind) => void;
    onPickDefinition: (definition: Definition) => void;
};

const KindBand = (props: KindBandProps) => {
    // Mounts with the band, so re-opening the row re-reads the Library and a
    // just-authored Definition takes its alphabetical place without any
    // invalidation plumbing.
    const [definitions] = createResource<Definition[] | typeof FAILED>(async () => {
        try {
            return await getDefinitionQueries().listDefinitions();
        } catch {
            return FAILED;
        }
    });

    /** A node cannot offer a kind it would refuse as a child. */
    const kinds = () => FIELD_KINDS.filter((k) => props.admittedKinds.includes(k));

    /** `isInline` drops the re-root policy Definitions (logbook) that share the
     *  library tree; the kind match is what groups the rest. */
    const definitionsFor = (kind: Kind): Definition[] => {
        const list = definitions();
        if (!list || list === FAILED) return [];
        return list
            .filter((d) => d.kind === kind && isInline(d.kind))
            .sort((a, b) => a.label.localeCompare(b.label));
    };

    return (
        <div class={styles.kindRows} role="group">
            <Show when={definitions() === FAILED}>
                <div class={styles.notice}>Could not load the Library</div>
            </Show>
            <For each={kinds()}>
                {(k) => (
                    <KindRow
                        kind={k}
                        selected={props.selectedKind === k}
                        pickedId={props.pickedId}
                        definitions={definitionsFor(k)}
                        loading={definitions.loading}
                        onPickKind={props.onPickKind}
                        onPickDefinition={props.onPickDefinition}
                    />
                )}
            </For>
        </div>
    );
};

type KindRowProps = {
    kind: Kind;
    selected: boolean;
    pickedId: string | null;
    definitions: Definition[];
    loading: boolean;
    onPickKind: (kind: Kind) => void;
    onPickDefinition: (definition: Definition) => void;
};

const KindRow = (props: KindRowProps) => {
    const [open, setOpen] = createSignal(false);

    const label = () => getKindManifest(props.kind).pickerLabel;

    return (
        <div class={styles.row}>
            <div class={styles.rowHead}>
                {/* Two targets, two acts: the chevron reveals this kind's Library
                    Definitions, the name selects the kind itself. */}
                <button
                    type="button"
                    classList={{
                        [chevron.chevron]: true,
                        [chevron.chevronDown]: open(),
                        [chevron.chevronRight]: !open(),
                    }}
                    aria-expanded={open()}
                    aria-label={`${open() ? 'Hide' : 'Show'} ${label()} definitions`}
                    onClick={() => setOpen(!open())}
                />
                <button
                    type="button"
                    classList={{
                        [styles.rowName]: true,
                        [styles.rowNameSelected]: props.selected,
                    }}
                    aria-pressed={props.selected}
                    onClick={() => props.onPickKind(props.kind)}
                >
                    {label()}
                </button>
                {/* Draft state, not browser focus — which is transient and would
                    be lost to the next tap (SPEC → The bands). */}
                <Show when={props.selected}>
                    <span class={styles.selectedMarker} aria-hidden="true">●</span>
                </Show>
            </div>

            <Show when={open()}>
                <div class={styles.nested} role="group">
                    <Show when={!props.loading} fallback={<div class={styles.notice}>Loading…</div>}>
                        <Show
                            when={props.definitions.length > 0}
                            fallback={<div class={styles.notice}>Nothing in the Library yet</div>}
                        >
                            <For each={props.definitions}>
                                {(def) => (
                                    <div class={styles.defEntry}>
                                        <div class={styles.rowHead}>
                                            <span class={chevron.chevronSpacer} aria-hidden="true" />
                                            <button
                                                type="button"
                                                classList={{
                                                    [styles.rowName]: true,
                                                    [styles.rowNameSelected]: props.pickedId === def.id,
                                                }}
                                                aria-pressed={props.pickedId === def.id}
                                                onClick={() => props.onPickDefinition(def)}
                                            >
                                                {def.label}
                                            </button>
                                        </div>
                                        {/* Provenance, outside the button on purpose: the label is
                                            the pick target and its accessible name must stay the
                                            Definition's name. This is information, not an act. */}
                                        <div class={styles.defMeta}>
                                            <span>{`Coined ${formatTimestampShort(def.updatedAt)} by ${def.authorId}`}</span>
                                            <code class={styles.defId}>{def.id}</code>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </Show>
                    </Show>
                </div>
            </Show>
        </div>
    );
};
