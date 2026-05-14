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
import type {
    ComponentType,
    FieldDefinition,
    FieldDefinitionConfig,
    TextKvConfig,
    EnumKvConfig,
    NumberKvConfig,
    SingleImageConfig,
} from '../data/models';

export type FieldDefinitionDraftPhase = 'idle' | 'authoring';

export const DEFAULT_COMPONENT_TYPE: ComponentType = 'text-kv';

export function defaultConfigFor(type: ComponentType): FieldDefinitionConfig {
    switch (type) {
        case 'text-kv':
            return {} as TextKvConfig;
        case 'enum-kv':
            return { options: [] } as EnumKvConfig;
        case 'number-kv':
            return { unitsSymbol: '' } as NumberKvConfig;
        case 'single-image':
            return { maxSizeMB: 5 } as SingleImageConfig;
    }
}

const LABEL_MAX = 50;

export type UseFieldDefinitionDraftResult = {
    phase: Signal<FieldDefinitionDraftPhase>;
    componentType: Signal<ComponentType>;
    label: Signal<string>;
    config: Signal<FieldDefinitionConfig>;
    /** Error from the component-specific config sub-form (e.g. invariant violations). */
    configError: Signal<string | null>;
    start$: QRL<() => void>;
    pickComponentType$: QRL<(type: ComponentType) => void>;
    setLabel$: QRL<(value: string) => void>;
    setConfig$: QRL<(cfg: FieldDefinitionConfig) => void>;
    /** Push a config-level error from the sub-form; null means valid. */
    setConfigError$: QRL<(error: string | null) => void>;
    cancel$: QRL<() => void>;
    /** Returns the new FieldDefinition, or null if save is gated (label empty or config error). */
    save$: QRL<() => Promise<FieldDefinition | null>>;
};

export function useFieldDefinitionDraft(): UseFieldDefinitionDraftResult {
    const phase = useSignal<FieldDefinitionDraftPhase>('idle');
    const componentType = useSignal<ComponentType>(DEFAULT_COMPONENT_TYPE);
    const label = useSignal<string>('');
    const config = useSignal<FieldDefinitionConfig>(defaultConfigFor(DEFAULT_COMPONENT_TYPE));
    const configError = useSignal<string | null>(null);

    const start$ = $(() => {
        phase.value = 'authoring';
        componentType.value = DEFAULT_COMPONENT_TYPE;
        label.value = '';
        config.value = defaultConfigFor(DEFAULT_COMPONENT_TYPE);
        configError.value = null;
    });

    const pickComponentType$ = $((type: ComponentType) => {
        componentType.value = type;
        config.value = defaultConfigFor(type);
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
        phase.value = 'idle';
        componentType.value = DEFAULT_COMPONENT_TYPE;
        label.value = '';
        config.value = defaultConfigFor(DEFAULT_COMPONENT_TYPE);
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
                    componentType: componentType.value,
                    label: trimmed,
                    config: config.value,
                },
            });
            phase.value = 'idle';
            label.value = '';
            config.value = defaultConfigFor(DEFAULT_COMPONENT_TYPE);
            componentType.value = DEFAULT_COMPONENT_TYPE;
            configError.value = null;
            return result;
        } catch {
            return null;
        }
    });

    return {
        phase,
        componentType,
        label,
        config,
        configError,
        start$,
        pickComponentType$,
        setLabel$,
        setConfig$,
        setConfigError$,
        cancel$,
        save$,
    };
}
