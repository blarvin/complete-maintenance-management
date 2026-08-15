/**
 * useDefinitionDraft - in-progress Definition authoring state.
 *
 * Distinct from `usePendingForms`: a pending Definition draft has no
 * DataField anchor yet — the Definition has to commit (Save → IDB +
 * sync queue) before a DataField draft can attach to it. No localStorage
 * persistence: dismissing the surface drops the draft.
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

import { batch, createSignal, type Accessor } from 'solid-js';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';
import { getDefinitionAuthoring } from '../kinds/registry';
import type {
    DataFieldValue,
    Element,
    Kind,
    Definition,
    DefinitionConfig,
} from '../data/models';

export const DEFAULT_KIND: Kind = 'text-kv';

export function defaultConfigFor(kind: Kind): DefinitionConfig {
    const authoring = getDefinitionAuthoring(kind);
    if (!authoring) throw new Error(`Kind carries no Definition-authoring contract: ${kind}`);
    return authoring.defaultConfig();
}

const LABEL_MAX = 50;

export type UseDefinitionDraftResult = {
    kind: Accessor<Kind>;
    label: Accessor<string>;
    config: Accessor<DefinitionConfig>;
    /** Error from the kind-specific config sub-form (e.g. invariant violations). */
    configError: Accessor<string | null>;
    /** The instance's initial value, buffered by the row's Renderer in pendingMode. */
    value: Accessor<DataFieldValue | null>;
    /** The Library Definition this draft was loaded from, if any. */
    picked: Accessor<Definition | null>;
    pickKind: (kind: Kind) => void;
    /** Load a Library Definition into the draft — name and config mirror it for display. */
    pickDefinition: (definition: Definition) => void;
    setLabel: (value: string) => void;
    setConfig: (cfg: DefinitionConfig) => void;
    /** Push a config-level error from the sub-form; null means valid. */
    setConfigError: (error: string | null) => void;
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
     */
    commit: (parentId: string, siblingOrder: number) => Promise<Element | null>;
};

export function useDefinitionDraft(): UseDefinitionDraftResult {
    const [kind, setKind] = createSignal<Kind>(DEFAULT_KIND);
    const [label, setLabelSignal] = createSignal<string>('');
    const [config, setConfigSignal] = createSignal<DefinitionConfig>(defaultConfigFor(DEFAULT_KIND));
    const [configError, setConfigErrorSignal] = createSignal<string | null>(null);
    // `setValue` takes a function-shaped payload too (single-image values are
    // objects), so wrap the setter to stop Solid reading one as an updater.
    const [value, setValueSignal] = createSignal<DataFieldValue | null>(null);
    const [picked, setPickedSignal] = createSignal<Definition | null>(null);

    // batch() so the <Dynamic> Renderer and the config rows never mount against
    // the previous kind's config (kind and config must flip in the same tick).
    const pickKind = (next: Kind) => {
        batch(() => {
            setKind(next);
            setConfigSignal(defaultConfigFor(next));
            setConfigErrorSignal(null);
            // Choosing a kind is choosing to author one, not to keep using the
            // Definition that was loaded.
            setPickedSignal(null);
        });
    };

    const pickDefinition = (definition: Definition) => {
        batch(() => {
            setKind(definition.kind);
            setLabelSignal(definition.label);
            setConfigSignal(definition.config);
            setConfigErrorSignal(null);
            setPickedSignal(definition);
        });
    };

    const setLabel = (value: string) => {
        setLabelSignal(value.slice(0, LABEL_MAX));
    };

    const setConfig = (cfg: DefinitionConfig) => {
        setConfigSignal(cfg);
    };

    const setConfigError = (error: string | null) => {
        setConfigErrorSignal(error);
    };

    const setValue = (next: DataFieldValue | null) => {
        setValueSignal(() => next);
    };

    /** Structural compare against the kind's fresh default — cheap, and the only
     *  way to tell "left alone" from "typed back to the same thing". */
    const configTouched = () =>
        JSON.stringify(config()) !== JSON.stringify(defaultConfigFor(kind()));

    const isDirty = () =>
        label().trim() !== '' || value() !== null || picked() !== null || configTouched();

    const cancel = () => {
        batch(() => {
            setKind(DEFAULT_KIND);
            setLabelSignal('');
            setConfigSignal(defaultConfigFor(DEFAULT_KIND));
            setConfigErrorSignal(null);
        });
    };

    const reset = () => {
        batch(() => {
            cancel();
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
                setConfigErrorSignal(null);
            });
            return result;
        } catch {
            return null;
        }
    };

    const commit = async (parentId: string, siblingOrder: number): Promise<Element | null> => {
        // Read before `save()`, which clears the authoring half of the draft.
        const initialValue = value();
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
        picked,
        pickKind,
        pickDefinition,
        setLabel,
        setConfig,
        setConfigError,
        setValue,
        isDirty,
        cancel,
        reset,
        save,
        commit,
    };
}
