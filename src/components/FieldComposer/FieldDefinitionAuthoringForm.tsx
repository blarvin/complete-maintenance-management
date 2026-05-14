/**
 * FieldDefinitionAuthoringForm - inline form expanded in place of the
 * "+ New Field Definition…" affordance.
 *
 * Three steps stacked vertically (no wizard navigation — all visible at once):
 *  1. Pick FieldComponent (segmented control of 4)
 *  2. Label (required, max 50 chars)
 *  3. Component-specific config sub-form
 *
 * Save commits via CREATE_FIELD_DEFINITION and reports the new FieldDefinition
 * back to the caller so the Composer can materialise a pre-checked row.
 * The `number-kv` sub-form is a stub here — full form lands in PR 6.
 */

import { component$, $, type PropFunction } from '@builder.io/qwik';
import type { ComponentType, EnumKvConfig, FieldDefinition, FieldDefinitionConfig, NumberKvConfig, SingleImageConfig, TextKvConfig } from '../../data/models';
import { useFieldDefinitionDraft } from '../../hooks/useFieldDefinitionDraft';
import { TextKvConfigForm } from './configForms/TextKvConfigForm';
import { EnumKvConfigForm } from './configForms/EnumKvConfigForm';
import { NumberKvConfigForm } from './configForms/NumberKvConfigForm';
import { SingleImageConfigForm } from './configForms/SingleImageConfigForm';
import styles from './FieldDefinitionAuthoringForm.module.css';

const COMPONENT_CHOICES: { type: ComponentType; label: string }[] = [
    { type: 'text-kv', label: 'Text' },
    { type: 'enum-kv', label: 'Enum' },
    { type: 'number-kv', label: 'Number' },
    { type: 'single-image', label: 'Image' },
];

export type FieldDefinitionAuthoringFormProps = {
    /** Called with the freshly-created FieldDefinition so the parent Composer
     *  can pre-check a row for it. */
    onCreated$: PropFunction<(def: FieldDefinition) => void>;
    /** Called when the user cancels — parent collapses back to affordance. */
    onCancel$: PropFunction<() => void>;
};

export const FieldDefinitionAuthoringForm = component$<FieldDefinitionAuthoringFormProps>((props) => {
    const {
        componentType,
        label,
        config,
        errorMessage,
        pickComponentType$,
        setLabel$,
        setConfig$,
        cancel$,
        save$,
    } = useFieldDefinitionDraft();

    const handleCancel$ = $(async () => {
        await cancel$();
        await props.onCancel$();
    });

    const handleSave$ = $(async () => {
        const def = await save$();
        if (def) await props.onCreated$(def);
    });

    return (
        <div class={styles.form}>
            <p class={styles.privacy}>
                Field definitions you create are shared with all users of this app.
            </p>

            <div class={styles.section}>
                <span class={styles.sectionLabel}>Component</span>
                <div class={styles.segmented} role="radiogroup" aria-label="Pick a FieldComponent">
                    {COMPONENT_CHOICES.map((c) => (
                        <button
                            key={c.type}
                            type="button"
                            role="radio"
                            aria-checked={componentType.value === c.type}
                            class={[
                                styles.segment,
                                componentType.value === c.type && styles.segmentActive,
                            ]}
                            onClick$={() => pickComponentType$(c.type)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            <label class={styles.section}>
                <span class={styles.sectionLabel}>Label</span>
                <input
                    type="text"
                    class={styles.labelInput}
                    value={label.value}
                    maxLength={50}
                    placeholder="e.g. Serial Number"
                    onInput$={(e) => setLabel$((e.target as HTMLInputElement).value)}
                    autoFocus
                />
            </label>

            <div class={styles.section}>
                <span class={styles.sectionLabel}>Config</span>
                <div class={styles.configHost}>
                    {componentType.value === 'text-kv' && (
                        <TextKvConfigForm
                            config={config.value as TextKvConfig}
                            onChange$={$((cfg: FieldDefinitionConfig) => setConfig$(cfg))}
                        />
                    )}
                    {componentType.value === 'enum-kv' && (
                        <EnumKvConfigForm
                            config={config.value as EnumKvConfig}
                            onChange$={$((cfg: FieldDefinitionConfig) => setConfig$(cfg))}
                        />
                    )}
                    {componentType.value === 'number-kv' && (
                        <NumberKvConfigForm
                            config={config.value as NumberKvConfig}
                            onChange$={$((cfg: FieldDefinitionConfig) => setConfig$(cfg))}
                        />
                    )}
                    {componentType.value === 'single-image' && (
                        <SingleImageConfigForm
                            config={config.value as SingleImageConfig}
                            onChange$={$((cfg: FieldDefinitionConfig) => setConfig$(cfg))}
                        />
                    )}
                </div>
            </div>

            {errorMessage.value && (
                <div class={styles.error} role="alert">{errorMessage.value}</div>
            )}

            <div class={styles.actions}>
                <button type="button" class={styles.cancelBtn} onClick$={handleCancel$}>
                    Cancel
                </button>
                <button
                    type="button"
                    class={styles.saveBtn}
                    onClick$={handleSave$}
                >
                    Save
                </button>
            </div>
        </div>
    );
});
