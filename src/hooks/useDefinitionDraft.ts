/**
 * useDefinitionDraft - in-progress Definition authoring state.
 *
 * Distinct from `usePendingForms`: a pending Definition draft has no
 * DataField anchor yet — the Definition has to commit (Save → IDB +
 * sync queue) before a DataField draft can attach to it. No localStorage
 * persistence: dismissing the Composer drops the draft.
 *
 * Save returns the newly-created Definition so the caller can pre-check
 * a Composer row for it (per SPEC: "immediately materialises a checked
 * Composer row at the same position").
 */

import { batch, createSignal, type Accessor } from 'solid-js';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';
import { getDefinitionAuthoring } from '../kinds/registry';
import type {
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
    pickKind: (kind: Kind) => void;
    setLabel: (value: string) => void;
    setConfig: (cfg: DefinitionConfig) => void;
    /** Push a config-level error from the sub-form; null means valid. */
    setConfigError: (error: string | null) => void;
    cancel: () => void;
    /** Returns the new Definition, or null if save is gated (label empty or config error). */
    save: () => Promise<Definition | null>;
};

export function useDefinitionDraft(): UseDefinitionDraftResult {
    const [kind, setKind] = createSignal<Kind>(DEFAULT_KIND);
    const [label, setLabelSignal] = createSignal<string>('');
    const [config, setConfigSignal] = createSignal<DefinitionConfig>(defaultConfigFor(DEFAULT_KIND));
    const [configError, setConfigErrorSignal] = createSignal<string | null>(null);

    // batch() so the <Dynamic> ConfigForm never mounts against the previous
    // kind's config (kind and config must flip in the same tick).
    const pickKind = (next: Kind) => {
        batch(() => {
            setKind(next);
            setConfigSignal(defaultConfigFor(next));
            setConfigErrorSignal(null);
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

    const cancel = () => {
        batch(() => {
            setKind(DEFAULT_KIND);
            setLabelSignal('');
            setConfigSignal(defaultConfigFor(DEFAULT_KIND));
            setConfigErrorSignal(null);
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

    return {
        kind,
        label,
        config,
        configError,
        pickKind,
        setLabel,
        setConfig,
        setConfigError,
        cancel,
        save,
    };
}
