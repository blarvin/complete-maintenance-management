/**
 * DefinitionAuthoringForm - inline form expanded in place of the
 * "+ New Field Definition…" affordance.
 *
 * Three steps stacked vertically (no wizard navigation — all visible at once):
 *  1. Pick FieldComponent (segmented control of 4)
 *  2. Label (required, max 50 chars)
 *  3. Component-specific config sub-form
 *
 * Save commits via CREATE_DEFINITION and reports the new Definition
 * back to the caller so the Composer can materialise a pre-checked row.
 * The `number-kv` sub-form is a stub here — full form lands in PR 6.
 */

import { component$, $, type PropFunction } from '@builder.io/qwik';
import type { Definition, DefinitionConfig } from '../../data/models';
import { useDefinitionDraft } from '../../hooks/useDefinitionDraft';
import { getInlineManifest, FIELD_KINDS } from '../../kinds/registry';
import styles from './DefinitionAuthoringForm.module.css';

const COMPONENT_CHOICES = FIELD_KINDS.map((type) => ({
    type,
    label: getInlineManifest(type).pickerLabel,
}));

export type DefinitionAuthoringFormProps = {
    /** Called with the freshly-created Definition so the parent Composer
     *  can pre-check a row for it. */
    onCreated$: PropFunction<(def: Definition) => void>;
    /** Called when the user cancels — parent collapses back to affordance. */
    onCancel$: PropFunction<() => void>;
};

export const DefinitionAuthoringForm = component$<DefinitionAuthoringFormProps>((props) => {
    const {
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
    } = useDefinitionDraft();

    const handleCancel$ = $(async () => {
        await cancel$();
        await props.onCancel$();
    });

    const handleSave$ = $(async () => {
        const def = await save$();
        if (def) await props.onCreated$(def);
    });

    const ConfigForm = getInlineManifest(kind.value).ConfigForm;

    return (
        <div class={styles.form}>
            <div class={styles.section}>
                <span class={styles.sectionLabel}>Component</span>
                <div class={styles.segmented} role="radiogroup" aria-label="Pick a FieldComponent">
                    {COMPONENT_CHOICES.map((c) => (
                        <button
                            key={c.type}
                            type="button"
                            role="radio"
                            aria-checked={kind.value === c.type}
                            class={[
                                styles.segment,
                                kind.value === c.type && styles.segmentActive,
                            ]}
                            onClick$={() => pickKind$(c.type)}
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
                    <ConfigForm
                        config={config.value}
                        onChange$={$((cfg: DefinitionConfig, error?: string | null) => {
                            setConfig$(cfg);
                            setConfigError$(error ?? null);
                        })}
                    />
                </div>
            </div>

            <div class={styles.actions}>
                <button type="button" class={styles.cancelBtn} onClick$={handleCancel$}>
                    Cancel
                </button>
                <button
                    type="button"
                    class={styles.saveBtn}
                    disabled={!label.value.trim() || !!configError.value}
                    onClick$={handleSave$}
                >
                    Save
                </button>
            </div>
        </div>
    );
});
