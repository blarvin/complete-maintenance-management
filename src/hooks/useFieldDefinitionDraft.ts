/**
 * useFieldDefinitionDraft - in-progress FieldDefinition authoring state.
 *
 * Distinct from `usePendingForms`: a pending FieldDefinition draft has no
 * DataField anchor yet — the FieldDefinition has to commit (Save → IDB +
 * sync queue) before a DataField draft can attach to it. No localStorage
 * persistence: dismissing the Composer drops the draft.
 *
 * Save returns the newly-created FieldDefinition so the caller can pre-check
 * a Composer row for it (per SPEC: "immediately materialises a checked
 * Composer row at the same position").
 */

import { useSignal, $, type Signal, type QRL } from '@builder.io/qwik';
import { getCommandBus } from '../data/commands';
import { generateId } from '../utils/id';
import { getInlineManifest } from '../kinds/registry';
import type {
    Kind,
    FieldDefinition,
    FieldDefinitionConfig,
} from '../data/models';

export const DEFAULT_KIND: Kind = 'text-kv';

export function defaultConfigFor(kind: Kind): FieldDefinitionConfig {
    return getInlineManifest(kind).defaultConfig();
}

const LABEL_MAX = 50;

export type UseFieldDefinitionDraftResult = {
    kind: Signal<Kind>;
    label: Signal<string>;
    config: Signal<FieldDefinitionConfig>;
    /** Error from the kind-specific config sub-form (e.g. invariant violations). */
    configError: Signal<string | null>;
    pickKind$: QRL<(kind: Kind) => void>;
    setLabel$: QRL<(value: string) => void>;
    setConfig$: QRL<(cfg: FieldDefinitionConfig) => void>;
    /** Push a config-level error from the sub-form; null means valid. */
    setConfigError$: QRL<(error: string | null) => void>;
    cancel$: QRL<() => void>;
    /** Returns the new FieldDefinition, or null if save is gated (label empty or config error). */
    save$: QRL<() => Promise<FieldDefinition | null>>;
};

export function useFieldDefinitionDraft(): UseFieldDefinitionDraftResult {
    const kind = useSignal<Kind>(DEFAULT_KIND);
    const label = useSignal<string>('');
    const config = useSignal<FieldDefinitionConfig>(defaultConfigFor(DEFAULT_KIND));
    const configError = useSignal<string | null>(null);

    const pickKind$ = $((next: Kind) => {
        kind.value = next;
        config.value = defaultConfigFor(next);
        configError.value = null;
    });

    const setLabel$ = $((value: string) => {
        label.value = value.slice(0, LABEL_MAX);
    });

    const setConfig$ = $((cfg: FieldDefinitionConfig) => {
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

    const save$ = $(async (): Promise<FieldDefinition | null> => {
        const trimmed = label.value.trim();
        if (!trimmed || configError.value) return null;

        try {
            const result = await getCommandBus().execute({
                type: 'CREATE_FIELD_DEFINITION',
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
