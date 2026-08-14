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
 */

import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { Definition, DefinitionConfig } from '../../data/models';
import { useDefinitionDraft } from '../../hooks/useDefinitionDraft';
import { getKindManifest, getDefinitionAuthoring, FIELD_KINDS } from '../../kinds/registry';
import { ConfigDraftForm } from '../ConfigDraftForm/ConfigDraftForm';
import styles from './DefinitionAuthoringForm.module.css';

const COMPONENT_CHOICES = FIELD_KINDS.map((type) => ({
    type,
    label: getKindManifest(type).pickerLabel,
}));

export type DefinitionAuthoringFormProps = {
    /** Called with the freshly-created Definition so the parent Composer
     *  can pre-check a row for it. */
    onCreated: (def: Definition) => void;
    /** Called when the user cancels — parent collapses back to affordance. */
    onCancel: () => void;
};

export const DefinitionAuthoringForm = (props: DefinitionAuthoringFormProps) => {
    const {
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
    } = useDefinitionDraft();

    const handleCancel = () => {
        cancel();
        props.onCancel();
    };

    const handleSave = async () => {
        const def = await save();
        if (def) props.onCreated(def);
    };

    return (
        <div class={styles.form}>
            <div class={styles.section}>
                <span class={styles.sectionLabel}>Component</span>
                <div class={styles.segmented} role="radiogroup" aria-label="Pick a FieldComponent">
                    <For each={COMPONENT_CHOICES}>
                        {(c) => (
                            <button
                                type="button"
                                role="radio"
                                aria-checked={kind() === c.type}
                                classList={{
                                    [styles.segment]: true,
                                    [styles.segmentActive]: kind() === c.type,
                                }}
                                onClick={() => pickKind(c.type)}
                            >
                                {c.label}
                            </button>
                        )}
                    </For>
                </div>
            </div>

            <label class={styles.section}>
                <span class={styles.sectionLabel}>Label</span>
                <input
                    type="text"
                    class={styles.labelInput}
                    value={label()}
                    maxLength={50}
                    placeholder="e.g. Serial Number"
                    onInput={(e) => setLabel(e.currentTarget.value)}
                    autofocus
                />
            </label>

            <div class={styles.section}>
                <span class={styles.sectionLabel}>Config</span>
                <div class={styles.configHost}>
                    {/* A ConfigForm is an optional override; absent means the
                        generic ConfigDraftForm builds rows from the kind's
                        configSchema. <Dynamic> swaps the override reactively on a
                        kind pick; the draft hook batches kind+config so the new
                        form never sees the previous kind's config.

                        This surface is dormant (ENABLED_ADD_FIELD_SURFACES), but
                        it is kept working rather than left to rot — restoring a
                        roster id has to bring the surface back intact. */}
                    <Show
                        when={getDefinitionAuthoring(kind())?.ConfigForm}
                        fallback={
                            <ConfigDraftForm
                                kind={kind()}
                                config={config()}
                                onChange={(cfg: DefinitionConfig, error?: string | null) => {
                                    setConfig(cfg);
                                    setConfigError(error ?? null);
                                }}
                            />
                        }
                    >
                        {(ConfigForm) => (
                            <Dynamic
                                component={ConfigForm()}
                                config={config()}
                                onChange={(cfg: DefinitionConfig, error?: string | null) => {
                                    setConfig(cfg);
                                    setConfigError(error ?? null);
                                }}
                            />
                        )}
                    </Show>
                </div>
            </div>

            <div class={styles.actions}>
                <button type="button" class={styles.cancelBtn} onClick={handleCancel}>
                    Cancel
                </button>
                <button
                    type="button"
                    class={styles.saveBtn}
                    disabled={!label().trim() || !!configError()}
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </div>
    );
};
