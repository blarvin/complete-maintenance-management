/**
 * useDefinitionDraft - in-progress Definition authoring state.
 *
 * Distinct from `usePendingForms`: a pending Definition draft has no
 * DataField anchor yet — the Definition has to commit (Save → IDB +
 * sync queue) before a DataField draft can attach to it.
 *
 * Pass `persistFor` (a node id) and the draft survives a reload, via
 * `addFieldDraft.ts`. Without it the draft is session-only, which is what the
 * dormant composer's `DefinitionAuthoringForm` has always had.
 *
 * Save returns the newly-created Definition so the caller can pre-check
 * a Composer row for it (per SPEC: "immediately materialises a checked
 * Composer row at the same position").
 *
 * The Add Surface (SPEC → The Add Surface) drafts a Definition *and* the
 * instance's first value in one motion, so the draft also carries `value`, the
 * `picked` Library Definition when there is one, and `commit` — the two Create
 * branches (author-then-mint / mint-only) written once.
 */

import { batch, createEffect, createSignal, type Accessor } from 'solid-js';
import { getCommandBus } from '../data/commands';
import { getDefinitionQueries } from '../data/queries';
import {
    clearAddFieldDraft,
    loadAddFieldDraft,
    saveAddFieldDraft,
} from '../data/services/addFieldDraft';
import { generateId } from '../utils/id';
import { getDefinitionAuthoring } from '../kinds/registry';
import { CONFIG_SCHEMAS, CONFIG_VALIDATORS } from '../kinds/configSchema';
import type {
    DataFieldValue,
    Element,
    Kind,
    Definition,
    DefinitionConfig,
} from '../data/models';

export const DEFAULT_KIND: Kind = 'text-kv';

/** Flat view of a config object — the `default` knob is read by key. */
type Flat = Record<string, unknown>;

/**
 * The kinds whose config declares a `default` sub-field, and whose draft
 * therefore mirrors it against the value slot. Derived from the schemas rather
 * than listed, so a kind that gains a `default` joins without an edit here.
 */
const DEFAULT_MIRRORED_KINDS: ReadonlySet<Kind> = new Set(
    (Object.keys(CONFIG_SCHEMAS) as Kind[]).filter((k) =>
        (CONFIG_SCHEMAS[k] ?? []).some((s) => s.key === 'default'),
    ),
);

export function defaultConfigFor(kind: Kind): DefinitionConfig {
    const authoring = getDefinitionAuthoring(kind);
    if (!authoring) throw new Error(`Kind carries no Definition-authoring contract: ${kind}`);
    return authoring.defaultConfig();
}

/**
 * The hard stop, behind `AddFieldSurface`'s matching `maxLength` — paste and
 * programmatic writes don't go through the input attribute. Keep the two equal.
 *
 * Not the same number as `--label-width`: the column is a width and this is a
 * character count, and the two only coincide for one string. 40 M's render ~370px
 * at `--text-sm`, 40 spaces ~120px.
 */
const LABEL_MAX = 40;

export type UseDefinitionDraftResult = {
    kind: Accessor<Kind>;
    label: Accessor<string>;
    config: Accessor<DefinitionConfig>;
    /**
     * The kind's cross-field config violation, or null. **Derived, not stored** —
     * a pure function of `(kind, config)`, so it cannot drift out of step with
     * the config the way a cached copy could.
     */
    configError: Accessor<string | null>;
    /** The instance's initial value, buffered by the row's Renderer in pendingMode. */
    value: Accessor<DataFieldValue | null>;
    /** Bumps when `value` is set from outside the value slot; the host keys the
     *  slot on it so a buffering Renderer re-seeds. See the field's own comment. */
    valueEpoch: Accessor<number>;
    /** The Library Definition this draft was loaded from, if any. */
    picked: Accessor<Definition | null>;
    pickKind: (kind: Kind) => void;
    /** Load a Library Definition into the draft — name and config mirror it for display. */
    pickDefinition: (definition: Definition) => void;
    setLabel: (value: string) => void;
    setConfig: (cfg: DefinitionConfig) => void;
    setValue: (value: DataFieldValue | null) => void;
    /** Whether anything has been entered — drives the under-construction tint. */
    isDirty: () => boolean;
    cancel: () => void;
    /** `cancel()` plus the value and the picked Definition. */
    reset: () => void;
    /** Returns the new Definition, or null if save is gated (label empty or config error). */
    save: () => Promise<Definition | null>;
    /**
     * Create, both branches: authoring writes the Definition then mints an
     * instance from it; picking mints only. Both pass the drafted value as
     * `initialValue`, so creation writes one history row carrying it rather than
     * a null create followed by an update. Resets the draft on success.
     * Returns the created Element, or null if the Definition save was gated.
     *
     * An untouched value slot passes `undefined` rather than `null`, which is
     * what lets the Definition's `default` fill in at mint while a *cleared*
     * slot still mints empty.
     */
    commit: (parentId: string, siblingOrder: number) => Promise<Element | null>;
};

/**
 * Read a stored draft back, or null. A kind that has left the registry cannot
 * seed one — `defaultConfigFor` would throw and the surface would never mount —
 * so a stale draft is dropped rather than carried.
 */
function restoreDraft(nodeId: string) {
    const stored = loadAddFieldDraft(nodeId);
    if (!stored) return null;
    if (!getDefinitionAuthoring(stored.kind)) {
        clearAddFieldDraft(nodeId);
        return null;
    }
    return stored;
}

/**
 * @param persistFor The node whose Add Surface this draft belongs to. Given
 * one, the draft is written to localStorage on every change and read back at
 * mount; omitted, nothing is stored.
 */
export function useDefinitionDraft(persistFor?: Accessor<string>): UseDefinitionDraftResult {
    // Read once, before the signals exist, so the slot's Renderer mounts against
    // the restored value rather than seeding empty and being corrected.
    const restored = persistFor ? restoreDraft(persistFor()) : null;

    const [kind, setKind] = createSignal<Kind>(restored?.kind ?? DEFAULT_KIND);
    const [label, setLabelSignal] = createSignal<string>(restored?.label ?? '');
    const [config, setConfigSignal] = createSignal<DefinitionConfig>(
        restored?.config ?? defaultConfigFor(DEFAULT_KIND),
    );
    /** Derived: the same call `ConfigRows` used to make and hand back on every
     *  write, which meant two copies of one fact and a stale window between them. */
    const configError = (): string | null =>
        CONFIG_VALIDATORS[kind()]?.(config()) ?? null;
    // `setValue` takes a function-shaped payload too (single-image values are
    // objects), so wrap the setter to stop Solid reading one as an updater.
    const [value, setValueSignal] = createSignal<DataFieldValue | null>(restored?.value ?? null);
    const [picked, setPickedSignal] = createSignal<Definition | null>(null);

    // A picked Definition is stored by id and resolved back asynchronously —
    // the Library is the owner, and a copy in localStorage would be a second
    // one. Set straight onto the signal rather than through `pickDefinition`,
    // which would overwrite the restored label/config/value with the
    // Definition's own. A Definition that has since gone leaves the draft
    // standing as an authoring draft, which is the honest fallback.
    if (restored?.pickedId) {
        void getDefinitionQueries()
            .getDefinitionById(restored.pickedId)
            .then((def) => { if (def) setPickedSignal(def); })
            .catch(() => { /* leave it as an authoring draft */ });
    }
    /**
     * Whether the user has said anything about the value slot — including
     * saying *empty*. `value() === null` cannot carry that on its own, and the
     * difference decides whether the Definition's `default` fills in at mint:
     * untouched means "nothing said, use the standing default", cleared means
     * "this one starts empty". Without it a defaulted Definition could never
     * mint an empty instance, which is the strongest argument against having
     * defaults at all.
     */
    const [valueTouched, setValueTouched] = createSignal(restored?.valueTouched ?? false);
    /**
     * Bumped whenever the value is set by something *other than the value slot* —
     * the `default` mirror, or seeding from a picked Definition.
     *
     * The slot's Renderer buffers: it seeds `currentValue` from `props.value` at
     * mount and owns it thereafter, which is what makes it an editor rather than
     * a display. So a value written behind its back is invisible until it
     * remounts, and this epoch is what the host keys the slot on. Writes coming
     * *from* the slot deliberately don't bump it — remounting the thing the user
     * is typing into would be absurd.
     */
    const [valueEpoch, setValueEpoch] = createSignal(0);
    const reseedSlot = () => setValueEpoch((n) => n + 1);

    // batch() so the <Dynamic> Renderer and the config rows never mount against
    // the previous kind's config (kind and config must flip in the same tick).
    const pickKind = (next: Kind) => {
        batch(() => {
            setKind(next);
            setConfigSignal(defaultConfigFor(next));
            // Choosing a kind is choosing to author one, not to keep using the
            // Definition that was loaded.
            setPickedSignal(null);
        });
    };

    const pickDefinition = (definition: Definition) => {
        const standing = (definition.config as Flat).default;
        batch(() => {
            setKind(definition.kind);
            setLabelSignal(definition.label);
            setConfigSignal(definition.config);
            setPickedSignal(definition);
            // The row is the Field (SPEC → Preview fidelity): if this Definition
            // says what a new instance starts as, the preview shows it rather
            // than reporting Empty and filling in on commit. Left alone when
            // there is no default, so an already-entered value survives the pick.
            if (standing !== undefined) {
                setValueSignal(() => standing as DataFieldValue);
                setValueTouched(false);
                reseedSlot();
            }
        });
    };

    const setLabel = (value: string) => {
        setLabelSignal(value.slice(0, LABEL_MAX));
    };

    /**
     * The `default` knob and the value slot are **two views of one thing** while
     * authoring, and mirror each other: picking a default fills the preview row,
     * and choosing in the preview row sets the default. Neither is the copy.
     *
     * A picked Definition is excluded: its config is `delegated` and read-only,
     * so there is nothing to mirror *into* (SPEC → The bands).
     *
     * Written through the raw signal setters on both sides, so the mirror can
     * never re-enter.
     */
    const mirrorsDefault = () => !picked() && DEFAULT_MIRRORED_KINDS.has(kind());

    const setConfig = (cfg: DefinitionConfig) => {
        const before = (config() as Flat).default;
        const after = (cfg as Flat).default;
        batch(() => {
            setConfigSignal(cfg);
            if (mirrorsDefault() && after !== before) {
                setValueSignal(() => (after ?? null) as DataFieldValue | null);
                // Setting a *default* is not touching the slot: it says what
                // every instance starts as, so the mint fallback still applies.
                setValueTouched(false);
                reseedSlot();
            }
        });
    };

    const setValue = (next: DataFieldValue | null) => {
        batch(() => {
            setValueSignal(() => next);
            setValueTouched(true);
            if (mirrorsDefault()) {
                const cfg = { ...(config() as Flat) };
                if (next === null) delete cfg.default;
                else cfg.default = next;
                setConfigSignal(cfg as DefinitionConfig);
            }
        });
    };

    /** Structural compare against the kind's fresh default — cheap, and the only
     *  way to tell "left alone" from "typed back to the same thing". */
    const configTouched = () =>
        JSON.stringify(config()) !== JSON.stringify(defaultConfigFor(kind()));

    const isDirty = () =>
        label().trim() !== '' || value() !== null || picked() !== null || configTouched();

    /**
     * Persist on every change, and clear the moment the draft stops being dirty.
     *
     * `isDirty` doing the clearing is what makes Create and Cancel need no code
     * of their own: both run `reset()`, which empties the same signals this
     * effect tracks, so the stored copy goes with them. One rule instead of
     * three call sites that could each forget.
     */
    if (persistFor) {
        createEffect(() => {
            const nodeId = persistFor();
            if (!isDirty()) {
                clearAddFieldDraft(nodeId);
                return;
            }
            saveAddFieldDraft(nodeId, {
                kind: kind(),
                label: label(),
                config: config(),
                value: value(),
                valueTouched: valueTouched(),
                pickedId: picked()?.id ?? null,
            });
        });
    }

    const cancel = () => {
        batch(() => {
            setKind(DEFAULT_KIND);
            setLabelSignal('');
            setConfigSignal(defaultConfigFor(DEFAULT_KIND));
        });
    };

    const reset = () => {
        batch(() => {
            cancel();
            setValueTouched(false);
            setValueSignal(() => null);
            setPickedSignal(null);
        });
    };

    const save = async (): Promise<Definition | null> => {
        const trimmed = label().trim();
        if (!trimmed || configError()) return null;

        try {
            const result = await getCommandBus().execute({
                type: 'CREATE_DEFINITION',
                payload: {
                    id: `fd_user_${generateId()}`,
                    kind: kind(),
                    label: trimmed,
                    config: config(),
                },
            });
            batch(() => {
                setLabelSignal('');
                setConfigSignal(defaultConfigFor(DEFAULT_KIND));
                setKind(DEFAULT_KIND);
            });
            return result;
        } catch {
            return null;
        }
    };

    const commit = async (parentId: string, siblingOrder: number): Promise<Element | null> => {
        // Read before `save()`, which clears the authoring half of the draft.
        //
        // `undefined` where the slot was never touched, so the mint falls back to
        // the Definition's `default`; an explicit `null` where the user cleared
        // it, which mints empty *despite* a default. The command payload already
        // distinguishes the two — this is what makes the difference reachable.
        const initialValue = valueTouched() ? value() : undefined;
        const definition = picked() ?? (await save());
        if (!definition) return null;

        const created = await getCommandBus().execute({
            type: 'CREATE_ELEMENT_FROM_DEFINITION',
            payload: { parentId, definitionId: definition.id, initialValue, siblingOrder },
        });
        reset();
        return created;
    };

    return {
        kind,
        label,
        config,
        configError,
        value,
        valueEpoch,
        picked,
        pickKind,
        pickDefinition,
        setLabel,
        setConfig,
        setValue,
        isDirty,
        cancel,
        reset,
        save,
        commit,
    };
}
