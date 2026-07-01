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

import { useSignal, $, type Signal, type QRL } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';
import { getInlineManifest } from '../kinds/registry';
import type {
    Kind,
    Definition,
    DefinitionConfig,
} from '../data/models';

export const DEFAULT_KIND: Kind = 'text-kv';

export function defaultConfigFor(kind: Kind): DefinitionConfig {
    return getInlineManifest(kind).defaultConfig();
}

const LABEL_MAX = 50;

export type UseDefinitionDraftResult = {
    kind: Signal<Kind>;
    label: Signal<string>;
    config: Signal<DefinitionConfig>;
    /** Error from the kind-specific config sub-form (e.g. invariant violations). */
    configError: Signal<string | null>;
    pickKind$: QRL<(kind: Kind) => void>;
    setLabel$: QRL<(value: string) => void>;
    setConfig$: QRL<(cfg: DefinitionConfig) => void>;
    /** Push a config-level error from the sub-form; null means valid. */
    setConfigError$: QRL<(error: string | null) => void>;
    cancel$: QRL<() => void>;
    /** Returns the new Definition, or null if save is gated (label empty or config error). */
    save$: QRL<() => Promise<Definition | null>>;
};

export function useDefinitionDraft(): UseDefinitionDraftResult {
    const kind = useSignal<Kind>(DEFAULT_KIND);
    const label = useSignal<string>('');
    const config = useSignal<DefinitionConfig>(defaultConfigFor(DEFAULT_KIND));
    const configError = useSignal<string | null>(null);

    const pickKind$ = $((next: Kind) => {
        kind.value = next;
        config.value = defaultConfigFor(next);
        configError.value = null;
    });

    const setLabel$ = $((value: string) => {
        label.value = value.slice(0, LABEL_MAX);
    });

    const setConfig$ = $((cfg: DefinitionConfig) => {
        config.value = cfg;
    });

    const setConfigError$ = $((error: string | null) => {
        configError.value = error;
    });

    const cancel$ = $(() => {
        kind.value = DEFAULT_KIND;
        label.value = '';
        config.value = defaultConfigFor(DEFAULT_KIND);
        configError.value = null;
    });

    const save$ = $(async (): Promise<Definition | null> => {
        const trimmed = label.value.trim();
        if (!trimmed || configError.value) return null;

        try {
            const result = await getCommandBus().execute({
                type: 'CREATE_DEFINITION',
                payload: {
                    id: `fd_user_${generateId()}`,
                    kind: kind.value,
                    label: trimmed,
                    config: config.value,
                },
            });
            label.value = '';
            config.value = defaultConfigFor(DEFAULT_KIND);
            kind.value = DEFAULT_KIND;
            configError.value = null;
            return result;
        } catch {
            return null;
        }
    });

    return {
        kind,
        label,
        config,
        configError,
        pickKind$,
        setLabel$,
        setConfig$,
        setConfigError$,
        cancel$,
        save$,
    };
}
